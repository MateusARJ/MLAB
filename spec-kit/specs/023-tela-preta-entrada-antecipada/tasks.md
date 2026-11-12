# Tasks: Transmissão Sem F5 para o Aluno que Entra Antes do Professor

Feature: `023-tela-preta-entrada-antecipada`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `go test ./internal/webrtc/... ./internal/signaling/...` e `gofmt -l .` vazio em `apps/backend`;
  `npm run test -w apps/web` e `npm run lint` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T230x` e `Refs #54`.

### T2301 — SFU: oferta só com mídia e reaproveitamento por geração
[ ] T2301
Allowed Paths: `apps/backend/internal/webrtc/room.go`, `apps/backend/internal/webrtc/room_test.go`,
`apps/backend/internal/webrtc/sfu_test.go`, `apps/backend/internal/webrtc/sfu_security_test.go`
Prohibited Paths: `apps/backend/internal/webrtc/sfu.go`, `apps/backend/internal/webrtc/loadtest*_test.go`,
`apps/backend/internal/signaling/**`, `apps/backend/cmd/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`,
`package.json`
Checks:
- [ ] Sem `videoTrack`, `createSubscriberOffer` devolve `ErrMediaNotReady` e não registra PC (RF-2302).
- [ ] Oferta pendente criada antes de uma track nova é descartada; a nova tem `m=video`, `m=audio`, `b=AS:6000` e
  `ice-ufrag` diferente (RF-2303).
- [ ] Assinatura duplicada sem track nova devolve a mesma oferta, com `b=AS:6000` (RF-2303, RN-2301).
- [ ] Áudio criado depois do vídeo chama `onTrackReady` de novo; áudio antes do vídeo não (RF-2304).
- [ ] `sfu_test.go` e `sfu_security_test.go` preenchem `videoTrack` antes de assinar.
- [ ] `go test ./internal/webrtc/... ./internal/signaling/...` verde e `gofmt -l .` vazio.

### T2302 — Web: fila de sinalização e descarte de negociação obsoleta
[ ] T2302
Depends On: T2301
Allowed Paths: `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/hooks/useWebRTCSubscriber.test.ts`
Prohibited Paths: `apps/web/src/pages/**`, `apps/web/src/components/**`, `apps/backend/**`, `apps/desktop/**`,
`packages/**`, `package.json`
Checks:
- [ ] `stream-started` durante o `setRemoteDescription` de uma `offer`: só é processado depois da answer dessa
  oferta; a PC nova envia `subscribe-request` e responde à oferta seguinte (RF-2305).
- [ ] `offer` em andamento quando o hook é desmontado: nenhuma answer é enviada (RF-2306).
- [ ] Candidato ICE não é aplicado a PC substituída (RF-2306).
- [ ] Testes existentes do hook verdes; `npm run test -w apps/web` e `npm run lint` verdes.

### T2303 — Verificação manual na LAN
[ ] T2303
Depends On: T2302
Allowed Paths: `spec-kit/specs/023-tela-preta-entrada-antecipada/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`
Checks:
- [ ] Professor cria a sala sem transmitir, aluno entra, professor inicia com áudio: vídeo e áudio sem F5 em 10
  repetições seguidas (RF-2301).
- [ ] O mesmo só com vídeo (sem áudio capturado) (RF-2301).
- [ ] Com a transmissão já ativa, o aluno entra e vê o vídeo sem demora perceptível a mais (RNF-2302).

### T2304 — Converge e versão
[ ] T2304
Depends On: T2303
Allowed Paths: `spec-kit/specs/023-tela-preta-entrada-antecipada/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-2305).
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/023-tela-preta-entrada-antecipada` com PASS.
