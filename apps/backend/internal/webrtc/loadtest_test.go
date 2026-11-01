//go:build loadtest

// Teste de carga real do SFU (001/T034). Fica fora do `go test ./...` normal por ser pesado.
//
// Execução:
//
//	go test -tags loadtest -run TestLoad_SFUFanout -v -count=1 -timeout 10m ./internal/webrtc/
//
// O teste sobe o SFUService real (mesma configuração de produção, faixa UDP padrão), conecta um
// publisher Pion que envia RTP VP8 sintético no bitrate/FPS do perfil 1080p@30 e N assinantes Pion
// que recebem pelo SFU. Tudo roda no mesmo processo e na mesma máquina; o tráfego passa pela pilha
// UDP do sistema operacional (IP físico detectado, igual à produção).
//
// O que ele mede de verdade: FPS e bitrate recebidos por assinante, perda pós-NACK, tempo de entrada
// (oferta do SFU → primeiro pacote), latência de encaminhamento do SFU, upload do publisher e CPU/memória
// do processo. O que ele NÃO mede: RTT e latência ponta a ponta em rede real, captura/encode/decode do
// vídeo e CPU isolada do backend (o processo inclui os clientes). Esses itens seguem como medição manual.
//
// Parâmetros por ENV (padrões entre parênteses):
//
//	MLAB_LOADTEST_SUBSCRIBERS (40)  MLAB_LOADTEST_SECONDS (20)  MLAB_LOADTEST_FPS (30)
//	MLAB_LOADTEST_MBPS (4)          MLAB_LOADTEST_OUT (vazio; caminho para salvar o resultado em JSON)
//	MLAB_LOADTEST_SFU_LOGS (vazio; "1" mantém os logs do SFU)
package webrtc

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"runtime"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v3"
)

const (
	loadRoomID      = "room-loadtest"
	loadPublisherID = "prof-loadtest"
	rtpPayloadMax   = 1100
	// payload: [descritor VP8 (1)] [envio em ns (8)] [índice do pacote (4)] [índice do quadro (4)] [preenchimento]
	payloadHeaderLen = 1 + 8 + 4 + 4
)

func envInt(name string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(name)); err == nil && v > 0 {
		return v
	}
	return def
}

type pktRecord struct {
	arrival  int64
	sent     int64
	pktIndex uint32
	frame    uint32
	size     int
	marker   bool
}

type subscriberProbe struct {
	id         string
	joinStart  time.Time
	firstPkt   atomic.Int64 // ns
	offerTook  time.Duration
	mu         sync.Mutex
	records    []pktRecord
	pc         *webrtc.PeerConnection
	connectErr error
}

func (s *subscriberProbe) add(r pktRecord) {
	s.mu.Lock()
	s.records = append(s.records, r)
	s.mu.Unlock()
}

type sendWindow struct {
	mu      sync.Mutex
	sent    map[uint32]int64 // índice do pacote → envio em ns
	frames  int
	bytes   int64
	packets int
}

// LoadResult é o resultado agregado gravado em JSON.
type LoadResult struct {
	Date                 string    `json:"date"`
	GoOS                 string    `json:"goos"`
	NumCPU               int       `json:"num_cpu"`
	Subscribers          int       `json:"subscribers"`
	Connected            int       `json:"connected"`
	WindowSeconds        float64   `json:"window_seconds"`
	TargetFPS            int       `json:"target_fps"`
	TargetMbps           float64   `json:"target_mbps"`
	PublisherSentMbps    float64   `json:"publisher_sent_mbps"`
	FPSMin               float64   `json:"fps_min"`
	FPSMean              float64   `json:"fps_mean"`
	MbpsMin              float64   `json:"mbps_min"`
	MbpsMean             float64   `json:"mbps_mean"`
	LossMaxPct           float64   `json:"loss_max_pct"`
	LossMeanPct          float64   `json:"loss_mean_pct"`
	SFUEgressMbps        float64   `json:"sfu_egress_mbps"`
	ForwardLatencyP50ms  float64   `json:"forward_latency_p50_ms"`
	ForwardLatencyP95ms  float64   `json:"forward_latency_p95_ms"`
	ForwardLatencyP99ms  float64   `json:"forward_latency_p99_ms"`
	ForwardLatencyMaxms  float64   `json:"forward_latency_max_ms"`
	JoinP50ms            float64   `json:"join_p50_ms"`
	JoinP95ms            float64   `json:"join_p95_ms"`
	JoinMaxms            float64   `json:"join_max_ms"`
	OfferP50ms           float64   `json:"sfu_offer_p50_ms"`
	OfferMaxms           float64   `json:"sfu_offer_max_ms"`
	ProcessCPUPctOfHost  float64   `json:"process_cpu_pct_of_host"`
	ProcessCPUCores      float64   `json:"process_cpu_cores"`
	HeapAllocMB          float64   `json:"heap_alloc_mb"`
	Goroutines           int       `json:"goroutines"`
	PerSubscriberFPS     []float64 `json:"per_subscriber_fps"`
	PerSubscriberLossPct []float64 `json:"per_subscriber_loss_pct"`
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return math.NaN()
	}
	idx := int(math.Ceil(p/100*float64(len(sorted)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

func waitConnected(pc *webrtc.PeerConnection, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		switch pc.ConnectionState() {
		case webrtc.PeerConnectionStateConnected:
			return nil
		case webrtc.PeerConnectionStateFailed, webrtc.PeerConnectionStateClosed:
			return fmt.Errorf("estado %s", pc.ConnectionState())
		}
		time.Sleep(20 * time.Millisecond)
	}
	return fmt.Errorf("timeout aguardando conexão (estado %s)", pc.ConnectionState())
}

func TestLoad_SFUFanout(t *testing.T) {
	subscribers := envInt("MLAB_LOADTEST_SUBSCRIBERS", 40)
	seconds := envInt("MLAB_LOADTEST_SECONDS", 20)
	fps := envInt("MLAB_LOADTEST_FPS", 30)
	mbps := float64(envInt("MLAB_LOADTEST_MBPS", 4))

	if os.Getenv("MLAB_LOADTEST_SFU_LOGS") != "1" {
		log.SetOutput(io.Discard)
	}

	sfu, err := NewSFUService(Config{}) // faixa UDP padrão de produção (50000–50100)
	if err != nil {
		t.Fatalf("NewSFUService: %v", err)
	}
	defer func() { _ = sfu.RoomClosed(loadRoomID) }()

	trackReady := make(chan struct{}, 1)
	sfu.SetOnTrackReady(func(string) {
		select {
		case trackReady <- struct{}{}:
		default:
		}
	})

	// ── Publisher ────────────────────────────────────────────────────────────
	pubPC, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("publisher PC: %v", err)
	}
	defer pubPC.Close()

	pubTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8, ClockRate: 90000}, "video", "loadtest")
	if err != nil {
		t.Fatalf("track: %v", err)
	}
	pubSender, err := pubPC.AddTrack(pubTrack)
	if err != nil {
		t.Fatalf("AddTrack: %v", err)
	}
	var plisReceived atomic.Int64
	go func() {
		for {
			pkts, _, rtcpErr := pubSender.ReadRTCP()
			if rtcpErr != nil {
				return
			}
			for _, p := range pkts {
				if _, isPLI := p.(*rtcp.PictureLossIndication); isPLI {
					plisReceived.Add(1)
				}
			}
		}
	}()

	offer, err := pubPC.CreateOffer(nil)
	if err != nil {
		t.Fatalf("CreateOffer: %v", err)
	}
	gather := webrtc.GatheringCompletePromise(pubPC)
	if err := pubPC.SetLocalDescription(offer); err != nil {
		t.Fatalf("SetLocalDescription: %v", err)
	}
	<-gather
	answerSDP, err := sfu.HandlePublisherOffer(loadRoomID, loadPublisherID, pubPC.LocalDescription().SDP)
	if err != nil {
		t.Fatalf("HandlePublisherOffer: %v", err)
	}
	if err := pubPC.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answerSDP}); err != nil {
		t.Fatalf("SetRemoteDescription publisher: %v", err)
	}
	if err := waitConnected(pubPC, 15*time.Second); err != nil {
		t.Fatalf("publisher não conectou ao SFU: %v", err)
	}

	// Envio de RTP sintético: um quadro a cada 1/fps, bytes por quadro = bitrate/8/fps.
	frameBytes := int(mbps * 1_000_000 / 8 / float64(fps))
	sw := &sendWindow{sent: make(map[uint32]int64, fps*seconds*20)}
	var recordSend atomic.Bool
	stopSend := make(chan struct{})
	sendDone := make(chan struct{})
	go func() {
		defer close(sendDone)
		ticker := time.NewTicker(time.Second / time.Duration(fps))
		defer ticker.Stop()
		var seq uint16
		var pktIndex, frame uint32
		ts := uint32(0)
		buf := make([]byte, rtpPayloadMax)
		for {
			select {
			case <-stopSend:
				return
			case <-ticker.C:
			}
			remaining := frameBytes
			first := true
			for remaining > 0 {
				n := rtpPayloadMax
				if remaining < n {
					n = remaining
				}
				if n < payloadHeaderLen {
					n = payloadHeaderLen
				}
				remaining -= n
				if first {
					buf[0] = 0x10 // VP8: S=1 (início da partição)
				} else {
					buf[0] = 0x00
				}
				now := time.Now().UnixNano()
				binary.BigEndian.PutUint64(buf[1:9], uint64(now))
				binary.BigEndian.PutUint32(buf[9:13], pktIndex)
				binary.BigEndian.PutUint32(buf[13:17], frame)
				pkt := &rtp.Packet{
					Header: rtp.Header{
						Version:        2,
						PayloadType:    96,
						SequenceNumber: seq,
						Timestamp:      ts,
						Marker:         remaining <= 0,
					},
					Payload: buf[:n],
				}
				if err := pubTrack.WriteRTP(pkt); err == nil && recordSend.Load() {
					sw.mu.Lock()
					sw.sent[pktIndex] = now
					sw.packets++
					sw.bytes += int64(n + 12)
					if pkt.Marker {
						sw.frames++
					}
					sw.mu.Unlock()
				}
				seq++
				pktIndex++
				first = false
			}
			frame++
			ts += 90000 / uint32(fps)
		}
	}()
	defer func() {
		select {
		case <-stopSend:
		default:
			close(stopSend)
		}
		<-sendDone
	}()

	select {
	case <-trackReady:
	case <-time.After(15 * time.Second):
		t.Fatal("SFU não sinalizou a track do publisher")
	}

	// ── Assinantes ───────────────────────────────────────────────────────────
	probes := make([]*subscriberProbe, subscribers)
	var wg sync.WaitGroup
	for i := 0; i < subscribers; i++ {
		p := &subscriberProbe{id: fmt.Sprintf("aluno-%02d", i+1), records: make([]pktRecord, 0, fps*seconds*16)}
		probes[i] = p
		wg.Add(1)
		go func(p *subscriberProbe) {
			defer wg.Done()
			p.joinStart = time.Now()
			offerSDP, err := sfu.CreateSubscriberOffer(loadRoomID, p.id, loadPublisherID)
			p.offerTook = time.Since(p.joinStart)
			if err != nil {
				p.connectErr = fmt.Errorf("CreateSubscriberOffer: %w", err)
				return
			}
			pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
			if err != nil {
				p.connectErr = err
				return
			}
			p.pc = pc
			pc.OnTrack(func(tr *webrtc.TrackRemote, rcv *webrtc.RTPReceiver) {
				go func() {
					for {
						if _, _, e := rcv.ReadRTCP(); e != nil {
							return
						}
					}
				}()
				for {
					pkt, _, e := tr.ReadRTP()
					if e != nil {
						return
					}
					arrival := time.Now().UnixNano()
					if len(pkt.Payload) < payloadHeaderLen {
						continue
					}
					p.firstPkt.CompareAndSwap(0, arrival)
					p.add(pktRecord{
						arrival:  arrival,
						sent:     int64(binary.BigEndian.Uint64(pkt.Payload[1:9])),
						pktIndex: binary.BigEndian.Uint32(pkt.Payload[9:13]),
						frame:    binary.BigEndian.Uint32(pkt.Payload[13:17]),
						size:     len(pkt.Payload) + 12,
						marker:   pkt.Marker,
					})
				}
			})
			if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: offerSDP}); err != nil {
				p.connectErr = fmt.Errorf("SetRemoteDescription: %w", err)
				return
			}
			answer, err := pc.CreateAnswer(nil)
			if err != nil {
				p.connectErr = fmt.Errorf("CreateAnswer: %w", err)
				return
			}
			g := webrtc.GatheringCompletePromise(pc)
			if err := pc.SetLocalDescription(answer); err != nil {
				p.connectErr = fmt.Errorf("SetLocalDescription: %w", err)
				return
			}
			<-g
			if err := sfu.HandleSubscriberAnswer(loadRoomID, p.id, pc.LocalDescription().SDP); err != nil {
				p.connectErr = fmt.Errorf("HandleSubscriberAnswer: %w", err)
			}
		}(p)
	}
	wg.Wait()
	defer func() {
		for _, p := range probes {
			if p.pc != nil {
				_ = p.pc.Close()
			}
		}
	}()

	// Aguarda o primeiro pacote em todos (ou timeout).
	joinDeadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(joinDeadline) {
		all := true
		for _, p := range probes {
			if p.connectErr == nil && p.firstPkt.Load() == 0 {
				all = false
				break
			}
		}
		if all {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	// ── Janela de medição ────────────────────────────────────────────────────
	time.Sleep(2 * time.Second) // aquecimento
	cpuStart := processCPUTime()
	recordSend.Store(true)
	winStart := time.Now()
	time.Sleep(time.Duration(seconds) * time.Second)
	recordSend.Store(false)
	winEnd := time.Now()
	cpuEnd := processCPUTime()
	time.Sleep(500 * time.Millisecond) // pacotes em trânsito / retransmissões tardias
	close(stopSend)
	<-sendDone

	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	window := winEnd.Sub(winStart).Seconds()
	sw.mu.Lock()
	sentInWindow := sw.sent
	sentFrames := sw.frames
	sentBytes := sw.bytes
	sw.mu.Unlock()

	res := LoadResult{
		Date:              time.Now().Format(time.RFC3339),
		GoOS:              runtime.GOOS,
		NumCPU:            runtime.NumCPU(),
		Subscribers:       subscribers,
		WindowSeconds:     window,
		TargetFPS:         fps,
		TargetMbps:        mbps,
		PublisherSentMbps: float64(sentBytes) * 8 / window / 1e6,
		HeapAllocMB:       float64(mem.HeapAlloc) / (1 << 20),
		Goroutines:        runtime.NumGoroutine(),
	}
	cpu := (cpuEnd - cpuStart).Seconds()
	res.ProcessCPUCores = cpu / window
	res.ProcessCPUPctOfHost = 100 * res.ProcessCPUCores / float64(runtime.NumCPU())

	var latencies, joins, offers []float64
	var fpsSum, mbpsSum, lossSum, egressBytes float64
	res.FPSMin, res.MbpsMin = math.Inf(1), math.Inf(1)
	for _, p := range probes {
		if p.connectErr != nil {
			t.Errorf("%s: falha ao conectar: %v", p.id, p.connectErr)
			continue
		}
		first := p.firstPkt.Load()
		if first == 0 {
			t.Errorf("%s: nenhum pacote recebido", p.id)
			continue
		}
		res.Connected++
		joins = append(joins, float64(first-p.joinStart.UnixNano())/1e6)
		offers = append(offers, float64(p.offerTook)/1e6)

		p.mu.Lock()
		recs := p.records
		p.mu.Unlock()
		unique := make(map[uint32]struct{}, len(sentInWindow))
		frames := make(map[uint32]struct{})
		var bytes int
		for _, r := range recs {
			if _, inWin := sentInWindow[r.pktIndex]; !inWin {
				continue
			}
			if _, dup := unique[r.pktIndex]; dup {
				continue
			}
			unique[r.pktIndex] = struct{}{}
			bytes += r.size
			if r.marker {
				frames[r.frame] = struct{}{}
			}
			latencies = append(latencies, float64(r.arrival-r.sent)/1e6)
		}
		subFPS := float64(len(frames)) / window
		subMbps := float64(bytes) * 8 / window / 1e6
		lossPct := 0.0
		if len(sentInWindow) > 0 {
			lossPct = 100 * float64(len(sentInWindow)-len(unique)) / float64(len(sentInWindow))
		}
		res.PerSubscriberFPS = append(res.PerSubscriberFPS, math.Round(subFPS*10)/10)
		res.PerSubscriberLossPct = append(res.PerSubscriberLossPct, math.Round(lossPct*1000)/1000)
		fpsSum += subFPS
		mbpsSum += subMbps
		lossSum += lossPct
		egressBytes += float64(bytes)
		res.FPSMin = math.Min(res.FPSMin, subFPS)
		res.MbpsMin = math.Min(res.MbpsMin, subMbps)
		res.LossMaxPct = math.Max(res.LossMaxPct, lossPct)
	}
	if res.Connected > 0 {
		n := float64(res.Connected)
		res.FPSMean = fpsSum / n
		res.MbpsMean = mbpsSum / n
		res.LossMeanPct = lossSum / n
		res.SFUEgressMbps = egressBytes * 8 / window / 1e6
	}
	sort.Float64s(latencies)
	sort.Float64s(joins)
	res.ForwardLatencyP50ms = percentile(latencies, 50)
	res.ForwardLatencyP95ms = percentile(latencies, 95)
	res.ForwardLatencyP99ms = percentile(latencies, 99)
	if len(latencies) > 0 {
		res.ForwardLatencyMaxms = latencies[len(latencies)-1]
	}
	sort.Float64s(offers)
	res.OfferP50ms = percentile(offers, 50)
	if len(offers) > 0 {
		res.OfferMaxms = offers[len(offers)-1]
	}
	res.JoinP50ms = percentile(joins, 50)
	res.JoinP95ms = percentile(joins, 95)
	if len(joins) > 0 {
		res.JoinMaxms = joins[len(joins)-1]
	}

	t.Logf("Ambiente: %s, %d CPUs lógicas; janela de %.1fs; quadros enviados na janela: %d; PLIs recebidos pelo publisher: %d",
		res.GoOS, res.NumCPU, window, sentFrames, plisReceived.Load())
	t.Logf("Assinantes conectados: %d/%d", res.Connected, res.Subscribers)
	t.Logf("FPS recebido: mín %.1f, média %.1f (alvo %d)", res.FPSMin, res.FPSMean, fps)
	t.Logf("Bitrate recebido por assinante: mín %.2f, média %.2f Mbps (alvo %.1f)", res.MbpsMin, res.MbpsMean, mbps)
	t.Logf("Perda pós-NACK: máx %.3f%%, média %.3f%%", res.LossMaxPct, res.LossMeanPct)
	t.Logf("Upload do publisher: %.2f Mbps (uma única upstream); saída total do SFU: %.1f Mbps",
		res.PublisherSentMbps, res.SFUEgressMbps)
	t.Logf("Latência de encaminhamento (publisher→SFU→assinante, loopback): p50 %.2f, p95 %.2f, p99 %.2f, máx %.2f ms",
		res.ForwardLatencyP50ms, res.ForwardLatencyP95ms, res.ForwardLatencyP99ms, res.ForwardLatencyMaxms)
	t.Logf("Tempo de entrada (pedido de oferta→1º pacote, entradas simultâneas): p50 %.0f, p95 %.0f, máx %.0f ms", res.JoinP50ms, res.JoinP95ms, res.JoinMaxms)
	t.Logf("Duração de CreateSubscriberOffer no SFU: p50 %.0f, máx %.0f ms", res.OfferP50ms, res.OfferMaxms)
	t.Logf("CPU do processo (SFU + publisher + %d assinantes): %.2f núcleos = %.1f%% do host; heap %.1f MB; goroutines %d",
		res.Connected, res.ProcessCPUCores, res.ProcessCPUPctOfHost, res.HeapAllocMB, res.Goroutines)

	if out := os.Getenv("MLAB_LOADTEST_OUT"); out != "" {
		if data, err := json.MarshalIndent(res, "", "  "); err == nil {
			if err := os.WriteFile(out, data, 0o644); err != nil {
				t.Errorf("falha ao gravar %s: %v", out, err)
			}
		}
	}

	// Critérios da T034 (RNF-02/RNF-03): todos recebem, FPS ≥ 25 e perda < 2% por assinante.
	if res.Connected != subscribers {
		t.Errorf("esperado %d assinantes recebendo mídia, obtido %d", subscribers, res.Connected)
	}
	if res.Connected > 0 && res.FPSMin < 25 {
		t.Errorf("FPS mínimo %.1f abaixo de 25", res.FPSMin)
	}
	if res.LossMaxPct >= 2 {
		t.Errorf("perda máxima %.3f%% não está abaixo de 2%%", res.LossMaxPct)
	}
}
