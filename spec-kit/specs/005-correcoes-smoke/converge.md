# Converge: Correções da Matriz de Smoke e Remoção de Legado

Feature: `005-correcoes-smoke`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: 2026-11-02
Commit avaliado: `1a58c5a` (branch `fix/identidade-por-nome-e-smoke`)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-501 a C-506), `plan.md`, `tasks.md` (T501–T507)
- Suítes: `go test -count=1 ./...` (6/6 pacotes), `npx turbo run build test --force` (8/8 tasks), vitest do web
  38/38, `npm run spec:check` (5/5 PASS)
- Smoke de backend: `go test -tags smoke` — 12/12 OK (`docs/metrics/smoke-backend.jsonl`)
- E2E do aluno: Playwright no Microsoft Edge (`channel: 'msedge'`; o download do Chromium do Playwright falha nesta
  máquina) — 12/12 OK, 1 flaky (A14, ver §5)
- Relatório: `docs/metrics/smoke-2026-11.md` — 10 OK · 0 FALHA · 14 PENDENTE (todos de roteiro manual)

## 1. Requisitos atendidos

| Requisito | Evidência |
|---|---|
| RF-501 sessão única com `4001` | `signaling/client.go` (`closeWithCode`), `hub.go` (`onRegister`); testes de hub; smoke A19 OK |
| RF-502 reentrada substitui e não é barrada | `room/store.go` (`AddParticipant`, `HasStudent`), `room/handler.go`; `room_test.go` |
| RF-503 mensagem ao aluno derrubado | `useWebRTCSubscriber.ts` (estado `duplicate`), `Room.tsx`; teste do hook; E2E A19 OK |
| RF-504 aviso de `CHAT_RATE_LIMITED` | `useWebRTCSubscriber.ts` (`chatNotice`), `Room.tsx` (`Alert`); testes; E2E A20 OK |
| RF-505 remoção de legado | itens do plan §3 removidos (T504, T505); build e testes verdes |
| RF-506 chat desabilitado até conectar | `useWebRTCSubscriber.ts` (`isChatReady`), `Room.tsx`; teste do hook e de `Room`; E2E A20 OK sem retry |
| RNF-501 demais fechamentos inalterados | `writePump` só envia código quando definido; smoke A3/A18 OK |

## 2. Requisitos parcialmente atendidos

Nenhum.

## 3. Divergências

Nenhuma entre código e spec/plan/contratos desta feature. A divergência da 001 (RN-04 marcada concluída sem
implementação) está registrada em `../001-screen-share-core/converge.md` §6.3.

## 4. Código sem requisito

Nenhum.

## 5. Testes faltantes / limitações de verificação

- **A14 instável no harness E2E:** na suíte completa a primeira tentativa às vezes falha em ~4 ms com
  `TargetClosedError` (página fechada antes do teste começar) e passa no retry. Não envolve o código do chat.
- **Entrada do aluno travando de forma intermitente no E2E:** em execuções lentas da máquina (suíte de 14 min contra
  59 s numa execução normal), o aluno ficou em `/entrar` com `POST /rooms/{slug}/join` pendente, derrubando A10, A13
  ou A14 no passo de entrada. Já ocorria antes da 005. Precisa de investigação própria; não foi reproduzido na
  execução final.
- A config do Playwright usa `channel: 'chromium'`; a execução com Edge foi feita por uma config temporária fora do
  repositório. Tornar o canal configurável exige alterar `apps/web/playwright.config.ts`, fora do Scope Lock da 005.
- 004/T409 (registro nos converges após o roteiro manual) continua aguardando o responsável preencher
  `docs/metrics/smoke-manual.json`.

## 6. Novas tasks necessárias

- Nenhuma nesta feature.
- Fora dela (precisam de spec/task própria): investigar a entrada intermitente do aluno no E2E; canal do navegador
  configurável no Playwright.

## 7. Resultado

- [ ] OPEN
- [x] CONVERGED — T501–T507 entregues e verificadas; limitações de verificação listadas na §5.
