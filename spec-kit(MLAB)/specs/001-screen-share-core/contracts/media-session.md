# Contract: Media Session

Status: READY
Feature: `001-screen-share-core`

## Purpose

Definir a semântica completa da publicação de tela e áudio pelo professor e da
assinatura pelos alunos via SFU (Pion WebRTC).

## Producer

Professor autorizado — somente um professor por sala pode publicar no escopo inicial.

## Consumer

Alunos autorizados — recebem a mídia via subscribe na SFU, sem publicar de volta.

## Transport

WebRTC via SFU (Pion WebRTC). O SFU encaminha pacotes RTP sem decode/encode.

---

## Regras de Publicação

- Exatamente **uma upstream ativa por sala** no escopo inicial.
- Somente participante com `role: professor` e dono da sala pode emitir `publish-request`.
- A SFU valida o papel via JWT antes de aceitar qualquer track de publicação.
- A upstream contém **dois tracks**: vídeo (tela via `desktopCapturer`) e áudio (microfone).
- O professor pode pausar/retomar o áudio sem interromper o vídeo (mute lógico).
- O professor pode encerrar a publicação inteira (`publish-stop`), o que sinaliza `room-status: waiting` para todos os assinantes.

## Regras de Assinatura (Subscribe)

- Somente participantes com JWT válido e `room_id` correspondente podem assinar.
- A SFU **não** cria uma upstream individual do professor para cada aluno; encaminha os mesmos pacotes RTP a todos os assinantes.
- Aluno que entra enquanto a publicação está ativa começa a receber mídia automaticamente após o handshake WebRTC.
- Aluno que entra enquanto a publicação está pausada recebe o estado `waiting` e aguarda novo sinal de publicação.

## Codecs

| Track | Codec preferencial | Fallback |
|---|---|---|
| Vídeo (tela) | VP9 | VP8 / H.264 |
| Áudio (microfone) | Opus | — |

A escolha final de codec é negociada via SDP durante o handshake; o servidor oferece na ordem acima. Mudança de codec padrão exige ADR.

## Ciclo de vida da sessão de mídia

```text
[Professor]                    [SFU/Backend]               [Aluno]
    │                               │                          │
    ├─ publish-request ────────────►│                          │
    │◄─ publish-approved ───────────┤                          │
    ├─ offer (SDP) ────────────────►│                          │
    │◄─ answer (SDP) ───────────────┤                          │
    ├─ ICE candidates ─────────────►│◄─ subscribe-request ─────┤
    │                               ├─ offer (SDP) ───────────►│
    │                               │◄─ answer (SDP) ───────────┤
    │                               ├─ ICE candidates ─────────►│
    │                               │                          │
    ├═ video + audio (RTP) ════════►│══ video + audio (RTP) ══►│
    │                               │                          │
    ├─ publish-stop ───────────────►│                          │
    │                               ├─ session-state(waiting) ─►│
```

## Política de Reconexão

### Professor perde conexão

1. O backend detecta que o WebSocket do professor fechou ou o ICE falhou.
2. O backend envia `session-state: { status: "reconnecting" }` a todos os alunos.
3. A SFU mantém as tracks dos alunos abertas por até **30 segundos** aguardando reconexão (timeout configurável via ENV: `PUBLISHER_RECONNECT_TIMEOUT_S`).
4. Se o professor reconectar dentro do timeout: a SFU reanexa os tracks existentes; alunos recebem `session-state: { status: "publishing" }` e a mídia retorna.
5. Se o timeout expirar sem reconexão: a SFU encerra todas as tracks de assinatura; alunos recebem `room-closed` e são direcionados à tela de espera.

### Aluno perde conexão

1. O cliente do aluno detecta falha no ICE ou no WebSocket.
2. O cliente exibe indicador de "reconectando" na UI.
3. O cliente tenta reconexão ao WebSocket (backoff exponencial: 1s, 2s, 4s, máx 30s).
4. Ao reconectar, o cliente reenvia `join` com o mesmo JWT (se ainda válido) e emite novo `subscribe-request`.
5. Se o JWT expirou durante a queda: o aluno é redirecionado à página de identificação para obter novo token.
6. Sem recriar a sala: o `room_id` é preservado no JWT e na URL.

### SFU temporariamente indisponível

- Tratado como perda de conexão do professor (cenário mais grave).
- Alunos recebem `session-state: { status: "reconnecting" }`.
- A política de timeout se aplica igualmente.

## Rate Limit do Chat

O rate limit é aplicado **server-side** no módulo `internal/chat`:

| Janela | Limite | Ação ao exceder |
|---|---|---|
| 5 segundos | 5 mensagens | mensagem `error: { code: "CHAT_RATE_LIMITED" }` |
| 1 minuto | 30 mensagens | mensagem `error: { code: "CHAT_RATE_LIMITED" }` |

- O cliente deve exibir feedback visual quando receber `CHAT_RATE_LIMITED`.
- Exceder o limite não desconecta o participante.
- Os valores são configuráveis via ENV: `CHAT_RATE_WINDOW_S`, `CHAT_RATE_MAX_PER_WINDOW`.

## Observability

Registrar por sessão WebRTC (armazenar na entidade `Session` do `data-model.md`):

| Métrica | Fonte | Frequência |
|---|---|---|
| `fps` | WebRTC stats (`getStats()`) | a cada 5s |
| `bitrate_kbps` | WebRTC stats | a cada 5s |
| `rtt_ms` | WebRTC stats (RTCP) | a cada 5s |
| `packet_loss_pct` | WebRTC stats | a cada 5s |
| `first_frame_at` | evento `ontrack` do aluno | uma vez por sessão |
| `transport_state` | eventos ICE connection state | em cada mudança de estado |

## Compatibility

Mudança nas regras de publish/subscribe, no ciclo de vida ou nos codecs exige atualização
deste contrato, do `signaling.md` e de `packages/types`. Mudança de codec padrão exige ADR.
