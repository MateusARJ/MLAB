package signaling

import "time"

// Limite de request-keyframe por aluno (002/S9, RNF-SEC-09, C-204).
// A rajada cobre o pedido duplo do web app ao conectar (imediato + 300 ms); a recarga de 1/s
// acompanha o watchdog de congelamento do aluno. O professor não passa por este limite.
const (
	studentKeyFrameBurst    = 3
	studentKeyFrameInterval = time.Second
)

// keyframeLimiter é um token bucket simples. O valor zero é válido e começa com a rajada cheia.
// Acessado somente pela goroutine do hub, então dispensa mutex.
type keyframeLimiter struct {
	tokens float64
	last   time.Time
}

func (l *keyframeLimiter) allow(now time.Time) bool {
	if l.last.IsZero() {
		l.tokens = studentKeyFrameBurst
	} else if elapsed := now.Sub(l.last); elapsed > 0 {
		l.tokens += float64(elapsed) / float64(studentKeyFrameInterval)
		if l.tokens > studentKeyFrameBurst {
			l.tokens = studentKeyFrameBurst
		}
	}
	l.last = now

	if l.tokens < 1 {
		return false
	}
	l.tokens--
	return true
}

// onRequestKeyFrame repassa o pedido de keyframe à SFU. Pedidos de aluno acima do limite são
// descartados em silêncio: o web app não trata erro desta mensagem e o aluno não deve ver aviso.
func (h *Hub) onRequestKeyFrame(c *Client, now time.Time) {
	if h.sfu == nil {
		return
	}
	if c.role != RoleProfessor && !c.keyframeLimit.allow(now) {
		return
	}
	_ = h.sfu.RequestKeyFrame(h.roomID)
}
