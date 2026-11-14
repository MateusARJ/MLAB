//go:build smoke

// Casos do smoke de backend (004/T403). Cada subteste leva o ID do item da matriz de smoke
// (Anexo A de spec-kit/docs/plano-remediacao-speckit-seguranca.md) ou da task de segurança (S2, S6, S9).
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"
)

type chatPayload struct {
	MessageID     string `json:"message_id"`
	ParticipantID string `json:"participant_id"`
	Content       string `json:"content"`
	IsPrivate     bool   `json:"is_private"`
}

type handPayload struct {
	ParticipantID string `json:"participant_id"`
	Raised        bool   `json:"raised"`
}

type errorPayload struct {
	Code string `json:"code"`
}

func isChatWith(content string) func(wsMsg) bool {
	return func(m wsMsg) bool {
		if m.Type != "chat-message" {
			return false
		}
		var p chatPayload
		_ = json.Unmarshal(m.Payload, &p)
		return strings.Contains(p.Content, content)
	}
}

func TestSmoke(t *testing.T) {
	t.Run("A0_S2_sem_login_e_sessao_com_chave_de_host", func(t *testing.T) {
		e := newSmokeEnv(t)
		if code, _ := e.postJSON("/auth/login", "", map[string]string{"email": "professor@screenshare.local", "password": "professor123"}, nil); code != http.StatusNotFound {
			t.Errorf("POST /auth/login: esperado 404, obtido %d", code)
		}
		if code, _ := e.postJSON("/auth/session", "", map[string]string{"name": "Prof"}, nil); code != http.StatusForbidden {
			t.Errorf("sessão sem chave: esperado 403, obtido %d", code)
		}
		if code, _ := e.postJSON("/auth/session", "", map[string]string{"name": "Prof"}, map[string]string{"X-MLab-Host-Key": "errada"}); code != http.StatusForbidden {
			t.Errorf("sessão com chave errada: esperado 403, obtido %d", code)
		}
		if tok := e.profSession("Prof"); tok == "" {
			t.Error("sessão com chave válida não devolveu token")
		}
	})

	t.Run("A9_sala_ativa_e_validacao_de_matricula", func(t *testing.T) {
		e := newSmokeEnv(t)
		prof := e.profSession("Prof A9")
		r := e.createRoom(prof, "Aula A9")

		code, data, _ := e.do(http.MethodGet, "/rooms/active", "", nil, "", nil)
		if code != http.StatusOK {
			t.Fatalf("GET /rooms/active: %d %s", code, data)
		}
		active := mustDecode[smokeRoom](t, data)
		if active.ID != r.ID || active.Slug != r.Slug {
			t.Errorf("sala ativa %+v, esperada %+v", active, r)
		}
		if code, _ := e.join(r.ID, "Aluno", "abc"); code != http.StatusBadRequest {
			t.Errorf("matrícula inválida: esperado 400, obtido %d", code)
		}
		if code, _ := e.join(r.ID, "", smokeValidStudent); code != http.StatusBadRequest {
			t.Errorf("nome vazio: esperado 400, obtido %d", code)
		}
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		if j.Token == "" || j.RoomID != r.ID {
			t.Errorf("join válido devolveu %+v", j)
		}
		// Entrada pelo link fixo /{sala}/{professor}
		if code, _ := e.join(r.Slug, "Aluno Slug", "2025116TADS0002"); code != http.StatusOK {
			t.Errorf("join pelo slug %s: esperado 200, obtido %d", r.Slug, code)
		}
	})

	t.Run("A10_midia_chega_ao_aluno_pela_SFU", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A10")
		r := e.createRoom(profTok, "Aula A10")
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		student := e.mustWS("aluno", r.ID, j.Token)
		prof := e.mustWS("professor", r.ID, profTok)

		startPublisher(t, prof)
		student.expect("stream-started", 15*time.Second)
		_, packets := subscribe(t, student)
		if !waitCount(packets, 60, 15*time.Second) {
			t.Fatalf("aluno recebeu só %d pacotes RTP em 15 s", packets.Load())
		}
	})

	t.Run("A13_arquivos_com_token_e_limites", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A13")
		r := e.createRoom(profTok, "Aula A13")
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		student := e.mustWS("aluno", r.ID, j.Token)

		other := e.createRoom(e.profSession("Outro Prof"), "Outra Aula")
		jOther := e.mustJoin(other.ID, "Intruso", "2025116TADS0009")

		if code, _ := e.upload(r.ID, "", "x.txt", []byte("x")); code != http.StatusUnauthorized {
			t.Errorf("upload sem token: esperado 401, obtido %d", code)
		}
		if code, _ := e.upload(r.ID, j.Token, "x.txt", []byte("x")); code == http.StatusCreated {
			t.Errorf("upload por aluno: não deveria ser aceito (obtido %d)", code)
		}

		content := []byte("conteudo do material da aula")
		code, data := e.upload(r.ID, profTok, "material.txt", content)
		if code != http.StatusCreated {
			t.Fatalf("upload do professor: %d %s", code, data)
		}
		file := mustDecode[struct {
			ID  string `json:"id"`
			URL string `json:"url"`
		}](t, data)
		student.expect("file-shared", 5*time.Second)

		list := "/rooms/" + r.ID + "/files"
		if code, _, _ := e.do(http.MethodGet, list, "", nil, "", nil); code != http.StatusUnauthorized {
			t.Errorf("listagem sem token: esperado 401, obtido %d", code)
		}
		if code, _, _ := e.do(http.MethodGet, list, jOther.Token, nil, "", nil); code != http.StatusForbidden {
			t.Errorf("listagem com token de outra sala: esperado 403, obtido %d", code)
		}
		code, data, _ = e.do(http.MethodGet, list, j.Token, nil, "", nil)
		if code != http.StatusOK || !strings.Contains(string(data), file.ID) {
			t.Errorf("listagem do aluno: %d %s", code, data)
		}
		code, data, hdr := e.do(http.MethodGet, file.URL+"?token="+j.Token, "", nil, "", nil)
		if code != http.StatusOK || !bytes.Equal(data, content) {
			t.Errorf("download do aluno via ?token=: %d (%d bytes)", code, len(data))
		}
		if hdr.Get("X-Content-Type-Options") != "nosniff" {
			t.Errorf("download sem X-Content-Type-Options: nosniff")
		}
		if code, _, _ := e.do(http.MethodGet, file.URL, "", nil, "", nil); code != http.StatusUnauthorized {
			t.Errorf("download sem token: esperado 401, obtido %d", code)
		}

		for i := 2; i <= smokeFilesMaxCnt; i++ {
			if code, d := e.upload(r.ID, profTok, fmt.Sprintf("f%d.txt", i), []byte("y")); code != http.StatusCreated {
				t.Fatalf("upload %d: %d %s", i, code, d)
			}
		}
		if code, _ := e.upload(r.ID, profTok, "excedente.txt", []byte("z")); code != http.StatusRequestEntityTooLarge {
			t.Errorf("upload acima do limite de %d arquivos: esperado 413, obtido %d", smokeFilesMaxCnt, code)
		}
	})

	t.Run("A3_encerrar_sala_notifica_alunos_e_libera_arquivos", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A3")
		r := e.createRoom(profTok, "Aula A3")
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		student := e.mustWS("aluno", r.ID, j.Token)
		student.expect("session-state", 5*time.Second)

		code, data := e.upload(r.ID, profTok, "a.txt", []byte("a"))
		if code != http.StatusCreated {
			t.Fatalf("upload: %d %s", code, data)
		}
		fileURL := mustDecode[struct {
			URL string `json:"url"`
		}](t, data).URL

		if code, data := e.postJSON("/rooms/"+r.ID+"/close", profTok, map[string]string{}, nil); code != http.StatusOK {
			t.Fatalf("POST /rooms/{id}/close: %d %s", code, data)
		}
		student.expect("room-closed", 5*time.Second)
		if _, closed := student.waitClosed(5 * time.Second); !closed {
			t.Error("WebSocket do aluno continuou aberto após o encerramento")
		}
		if code, _, _ := e.do(http.MethodGet, fileURL+"?token="+j.Token, "", nil, "", nil); code == http.StatusOK {
			t.Error("arquivo continuou disponível após o encerramento da sala")
		}
	})

	t.Run("A14_chat_mascara_privado_fixacao_e_historico", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A14")
		r := e.createRoom(profTok, "Aula A14")
		prof := e.mustWS("professor", r.ID, profTok)
		j1 := e.mustJoin(r.ID, "Aluno 1", "2025116TADS0011")
		j2 := e.mustJoin(r.ID, "Aluno 2", "2025116TADS0012")
		s1 := e.mustWS("aluno1", r.ID, j1.Token)
		s2 := e.mustWS("aluno2", r.ID, j2.Token)

		// Palavrão mascarado para todos
		s1.send("chat-message", map[string]any{"content": "que porra de exemplo"})
		m, ok := s2.waitFor(isChatWith("exemplo"), 5*time.Second)
		if !ok {
			t.Fatal("aluno 2 não recebeu a mensagem pública")
		}
		if strings.Contains(payloadField[chatPayload](t, m).Content, "porra") {
			t.Errorf("palavrão não foi mascarado: %s", m.Payload)
		}

		// Privada do aluno: só o professor (e o próprio aluno) recebem
		s1.send("chat-message", map[string]any{"content": "duvida privada XYZ", "is_private": true})
		if _, ok := prof.waitFor(isChatWith("XYZ"), 5*time.Second); !ok {
			t.Error("professor não recebeu a mensagem privada")
		}
		if _, ok := s2.waitFor(isChatWith("XYZ"), 800*time.Millisecond); ok {
			t.Error("outro aluno recebeu a mensagem privada")
		}

		// Professor fixa até 3 mensagens públicas
		var ids []string
		for i := 1; i <= 4; i++ {
			prof.send("chat-message", map[string]any{"content": fmt.Sprintf("aviso numero %d", i)})
			pm, ok := prof.waitFor(isChatWith(fmt.Sprintf("aviso numero %d", i)), 5*time.Second)
			if !ok {
				t.Fatalf("eco do aviso %d não chegou", i)
			}
			ids = append(ids, payloadField[chatPayload](t, pm).MessageID)
		}
		for i := 0; i < 3; i++ {
			prof.send("pin-message", map[string]any{"message_id": ids[i], "pinned": true})
			s2.expect("chat-message-pinned", 5*time.Second)
		}
		prof.send("pin-message", map[string]any{"message_id": ids[3], "pinned": true})
		em := prof.expect("error", 5*time.Second)
		if payloadField[errorPayload](t, em).Code != "PIN_LIMIT_REACHED" {
			t.Errorf("4ª fixação: esperado PIN_LIMIT_REACHED, obtido %s", em.Payload)
		}

		// Aluno atrasado recebe o histórico público (sem a privada)
		j3 := e.mustJoin(r.ID, "Aluno 3", "2025116TADS0013")
		s3 := e.mustWS("aluno3", r.ID, j3.Token)
		h := s3.expect("chat-history", 5*time.Second)
		hist := string(h.Payload)
		if !strings.Contains(hist, "aviso numero 1") || !strings.Contains(hist, "exemplo") {
			t.Errorf("histórico incompleto: %s", hist)
		}
		if strings.Contains(hist, "XYZ") {
			t.Error("histórico contém mensagem privada")
		}
	})

	t.Run("A15_mao_levantada_em_ordem_e_professor_abaixa", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A15")
		r := e.createRoom(profTok, "Aula A15")
		prof := e.mustWS("professor", r.ID, profTok)
		j1 := e.mustJoin(r.ID, "Aluno 1", "2025116TADS0021")
		j2 := e.mustJoin(r.ID, "Aluno 2", "2025116TADS0022")
		s1 := e.mustWS("aluno1", r.ID, j1.Token)
		s2 := e.mustWS("aluno2", r.ID, j2.Token)
		s1.expect("session-state", 5*time.Second)
		s2.expect("session-state", 5*time.Second)

		s1.send("raise-hand", map[string]any{"raised": true})
		first := payloadField[handPayload](t, prof.expect("hand-updated", 5*time.Second))
		s2.send("raise-hand", map[string]any{"raised": true})
		second := payloadField[handPayload](t, prof.expect("hand-updated", 5*time.Second))
		if first.ParticipantID != j1.ParticipantID || second.ParticipantID != j2.ParticipantID || !first.Raised || !second.Raised {
			t.Errorf("ordem/estado das mãos incorreto: %+v, %+v", first, second)
		}

		prof.send("lower-hand", map[string]any{"participant_id": j1.ParticipantID})
		m, ok := s1.waitFor(func(m wsMsg) bool {
			if m.Type != "hand-updated" {
				return false
			}
			p := payloadField[handPayload](t, m)
			return p.ParticipantID == j1.ParticipantID && !p.Raised
		}, 5*time.Second)
		if !ok {
			t.Errorf("aluno 1 não recebeu a mão abaixada pelo professor (%s)", m.Payload)
		}
	})

	t.Run("A20_rate_limit_do_chat_sem_desconectar", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A20")
		r := e.createRoom(profTok, "Aula A20")
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		s := e.mustWS("aluno", r.ID, j.Token)
		for i := 1; i <= 6; i++ {
			s.send("chat-message", map[string]any{"content": fmt.Sprintf("msg %d", i)})
		}
		em := s.expect("error", 5*time.Second)
		if payloadField[errorPayload](t, em).Code != "CHAT_RATE_LIMITED" {
			t.Errorf("esperado CHAT_RATE_LIMITED, obtido %s", em.Payload)
		}
		// Continua conectado: recebe a entrada de outro aluno
		s.drain()
		e.mustWS("aluno2", r.ID, e.mustJoin(r.ID, "Aluno 2", "2025116TADS0032").Token)
		s.expect("participants-update", 5*time.Second)
		if !s.isOpen() {
			t.Error("aluno foi desconectado pelo rate limit")
		}
	})

	t.Run("S6_websocket_recusa_origem_desconhecida", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof S6")
		r := e.createRoom(profTok, "Aula S6")
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)

		_, resp, err := e.dialWS("evil", r.ID, j.Token, http.Header{"Origin": {"https://site-malicioso.example"}})
		if err == nil {
			t.Error("WebSocket aceitou origem desconhecida")
		} else if resp != nil && resp.StatusCode != http.StatusForbidden {
			t.Errorf("origem desconhecida: esperado 403, obtido %d", resp.StatusCode)
		}
		if _, _, err := e.dialWS("local", r.ID, j.Token, http.Header{"Origin": {"http://localhost:5173"}}); err != nil {
			t.Errorf("WebSocket recusou origem localhost: %v", err)
		}
	})

	t.Run("S9_request_keyframe_em_rajada_nao_derruba_o_aluno", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof S9")
		r := e.createRoom(profTok, "Aula S9")
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		s := e.mustWS("aluno", r.ID, j.Token)
		for i := 0; i < 20; i++ {
			s.send("request-keyframe", map[string]any{})
		}
		s.expectNone("error", 500*time.Millisecond)
		s.send("chat-message", map[string]any{"content": "ainda conectado"})
		if _, ok := s.waitFor(isChatWith("ainda conectado"), 5*time.Second); !ok {
			t.Error("aluno não recebeu o eco do chat após a rajada de keyframes")
		}
	})

	t.Run("A19_sessao_unica_por_aluno", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A19")
		r := e.createRoom(profTok, "Aula A19")

		// Matrícula conectada recusa a nova entrada com 409 e o aluno conectado continua (RN-04, ADR 0010 — 027).
		first := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		ws1 := e.mustWS("aba1", r.ID, first.Token)
		ws1.expect("session-state", 5*time.Second)
		if code, _ := e.join(r.ID, "Outro", strings.ToLower(smokeValidStudent)); code != http.StatusConflict {
			t.Errorf("RN-04: nova entrada com a matrícula conectada respondeu %d, esperado 409", code)
		}
		ws1.send("chat-message", map[string]any{"content": "ainda na sala"})
		if _, ok := ws1.waitFor(isChatWith("ainda na sala"), 5*time.Second); !ok {
			t.Error("RN-04: o aluno conectado deveria continuar na sala após a recusa")
		}

		// Mesmo token reconectando: a conexão antiga deve cair com 4001.
		ws3 := e.mustWS("token1", r.ID, first.Token)
		ws3.expect("session-state", 5*time.Second)
		e.mustWS("token2", r.ID, first.Token)
		code, closed := ws3.waitClosed(3 * time.Second)
		switch {
		case !closed:
			t.Error("reconexão com o mesmo token não derrubou a conexão anterior")
		case code != 4001:
			t.Errorf("reconexão com o mesmo token: conexão anterior caiu com close code %d, esperado 4001 (-1 = sem close frame)", code)
		}
	})

	t.Run("A18_professor_cai_reconnecting_e_timeout_de_30s", func(t *testing.T) {
		e := newSmokeEnv(t)
		profTok := e.profSession("Prof A18")
		r := e.createRoom(profTok, "Aula A18")
		prof := e.mustWS("professor", r.ID, profTok)
		prof.send("publish-request", nil)
		prof.expect("publish-approved", 5*time.Second)
		j := e.mustJoin(r.ID, "Aluno", smokeValidStudent)
		s := e.mustWS("aluno", r.ID, j.Token)
		s.expect("session-state", 5*time.Second)

		isState := func(status string) func(wsMsg) bool {
			return func(m wsMsg) bool {
				return m.Type == "session-state" && strings.Contains(string(m.Payload), `"`+status+`"`)
			}
		}

		// 1) Queda e volta antes de 30 s
		_ = prof.conn.Close()
		if _, ok := s.waitFor(isState("reconnecting"), 5*time.Second); !ok {
			t.Fatal("aluno não recebeu session-state reconnecting após a queda do professor")
		}
		prof2 := e.mustWS("professor-volta", r.ID, profTok)
		prof2.send("publish-request", nil)
		prof2.expect("publish-approved", 5*time.Second)
		if _, ok := s.waitFor(isState("publishing"), 5*time.Second); !ok {
			t.Error("aluno não recebeu session-state publishing após a volta do professor")
		}

		// 2) Queda sem volta: sala encerrada após 30 s
		_ = prof2.conn.Close()
		if _, ok := s.waitFor(isState("reconnecting"), 5*time.Second); !ok {
			t.Fatal("aluno não recebeu reconnecting na segunda queda")
		}
		if _, ok := s.waitFor(func(m wsMsg) bool { return m.Type == "room-closed" }, 40*time.Second); !ok {
			t.Error("sala não foi encerrada após o timeout de reconexão de 30 s")
		}
	})
}
