# Plan: Transmissão Sem F5 para o Aluno que Entra Antes do Professor

Feature: `023-tela-preta-entrada-antecipada`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2301 a C-2305)

## 1. Summary

```text
aluno: subscribe-request ──► hub (publishing) ──► Room.createSubscriberOffer
   videoTrack == nil ─────────────► ErrMediaNotReady ─► hub: session-state waiting (RF-2302)
   PC pendente e gen igual ───────► mesma oferta + b=AS/TIAS (RF-2303, RN-2301)
   PC pendente e gen diferente ───► fecha a PC, oferta nova com as tracks atuais (RF-2303)

OnTrack(video) cria a track ─► trackGen++ ─► onTrackReady ─► stream-started
OnTrack(audio) cria a track ─► trackGen++ ─► se videoTrack != nil: onTrackReady de novo (RF-2304)

hook web: onmessage ─► fila (promise chain) ─► handler (RF-2305)
   offer: após cada await, sai se pcRef.current !== pc (RF-2306)
```

1. `room.go`:
   - campos `trackGen uint64` e `subscriberGen map[string]uint64` em `Room`;
   - `ErrMediaNotReady` exportado;
   - função `withVideoBandwidth(sdp string) string` com a regex atual, usada na oferta nova e na reaproveitada;
   - `createSubscriberOffer` com a ordem do diagrama; o transceiver vazio sai;
   - no `OnTrack`, `trackGen++` sempre que a track local é criada; no áudio criado com o vídeo já existente, chama
     `onTrackReady`;
   - `close()` limpa `subscriberGen`.
2. `useWebRTCSubscriber.ts`:
   - corpo do `onmessage` extraído para `handleMessage(data)`;
   - `onmessage` encadeia numa promessa local a cada WebSocket (`queue = queue.then(...)`) e devolve essa promessa;
   - no ramo `offer`, o teste `isStale()` depois de cada `await` e antes do `send`;
   - no ramo `ice-candidate`, o mesmo teste antes de cada tentativa.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Sentinela | `var ErrMediaNotReady = errors.New(...)`; o hub não muda: já responde `waiting` a qualquer erro | RF-2302, C-2301 |
| Geração | incremento sob `r.mu`, junto com a criação da track local | RF-2303, C-2304 |
| Áudio tardio | `audioCreated && r.videoTrack != nil` decidido sob o lock; o callback roda fora do lock com `go readyCb(r.id)`, como o do vídeo | RF-2304, C-2302 |
| Banda | regex `(m=video [^\r\n]+)\r\n` → `b=AS:6000`/`b=TIAS:6000000`, compilada uma vez em nível de pacote | RF-2303 |
| Fila web | `let queue: Promise<void> = Promise.resolve()` dentro do `connect` (uma fila por WebSocket); `catch` por item | RF-2305 |
| Obsoleto | `pcRef.current !== currentPc \|\| currentPc.signalingState === 'closed'` | RF-2306 |
| Testes Go | novo `room_test.go` (pacote `webrtc`) com PC de publisher local e tracks preenchidas direto, no padrão de `sfu_test.go`; `sfu_test.go` e `sfu_security_test.go` passam a preencher `videoTrack` antes de assinar | §11 |
| Testes web | `useWebRTCSubscriber.test.ts` com promessa controlada no `setRemoteDescription` do mock | §11 |
| Versão | PATCH via `npm run bump -- patch` | C-2305 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Dois `stream-started` seguidos (vídeo e áudio) | duas assinaturas e um instante a mais de espera | fila + descarte no hook; a segunda oferta é a válida |
| Fila atrasar o chat atrás de uma `offer` lenta | atraso de milissegundos no chat | a negociação é local e curta; nenhum `await` de rede dentro da fila |
| Testes existentes assinarem sem track | quebra de teste | ajustados na mesma task; o comportamento antigo era o defeito |
| Aluno ver "aguardando" por um instante após `publishing` | UI de espera rápida | estado correto: a mídia ainda não existe; `stream-started` segue logo |
| Conflito de versão com outro PR aberto | `version:check` falha | rebase e novo bump no PR que entrar depois |

## Scope Lock

### IN

- regra de oferta, de reaproveitamento e de prontidão na SFU;
- ordem e descarte da sinalização no hook web dos alunos;
- testes desses dois pontos;
- incremento PATCH de versão.

### OUT

- hub de sinalização e semântica de `session-state`; app desktop; `packages/types`; contrato `signaling.md`;
  `onunmute`/indicador visual de quadros; métricas novas.

### Allowed Paths

- `apps/backend/internal/webrtc/room.go`, `apps/backend/internal/webrtc/room_test.go`
- `apps/backend/internal/webrtc/sfu_test.go`, `apps/backend/internal/webrtc/sfu_security_test.go`
- `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/hooks/useWebRTCSubscriber.test.ts`
- `spec-kit/specs/023-tela-preta-entrada-antecipada/**`
- só na T2304, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/sfu.go`,
  `apps/backend/internal/webrtc/loadtest*_test.go`, `apps/backend/cmd/**`
- `apps/desktop/**`, `packages/**` (fora da T2304)
- `apps/web/src/pages/**`, `apps/web/src/components/**`
- `spec-kit/specs/001-screen-share-core/**`, `.github/**`, `scripts/**`

### Dependencies

- Nenhuma nova. Go stdlib (`errors`, `regexp`) e Pion já usados; Vitest e Testing Library já instalados na web.

### Non-Goals

- mudar quando o hub anuncia `publishing`;
- renegociação iniciada pelo servidor;
- esconder o vídeo até chegarem quadros.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma mudança de autorização; o aluno continua só assinando.
- [x] Princípio III: SFU continua só repassando RTP; nenhuma decodificação nova.
- [x] Princípio IV: nenhuma meta de desempenho declarada; RNF-2302 verificado à mão na T2303.
- [x] Princípio V: contrato inalterado (RNF-2301).
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: código novo usado pelo fluxo existente de assinatura.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-12 | Hub mantém o `publishing`; a SFU recusa assinar sem track | C-2301 |
| 2026-11-12 | Áudio tardio reemite `onTrackReady` | C-2302 |
| 2026-11-12 | `onunmute` fora do escopo | C-2303 |
| 2026-11-12 | Reaproveitamento por geração de tracks | C-2304 |
| 2026-11-12 | IDs `230x`; sem ADR; versão PATCH | C-2305 |
