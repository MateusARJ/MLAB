# Analyze: Encerramento Completo do App e do Backend Embarcado

Feature: `034-encerramento-backend-orfao`
Mode: READ-ONLY
Status: PASS

## Entradas

- `spec.md` (READY), `clarify.md` (CLOSED), `plan.md` (READY), `tasks.md` (READY), `research.md`
- `contracts/backend-embarcado.md` (READY)
- `spec-kit/.specify/memory/constitution.md`
- Base: `development` @ `d1b4886` (1.15.3)

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-3401 a C-3407) e plan concordam: `/health` intacto e dono da porta identificado pelo SO só no
  Windows (C-3401 B); a janela principal encerra o app no Windows/Linux (C-3402 A); no macOS o backend segue com o app
  no Dock (C-3403 A); binário `mlab-backend`; NSIS só com o MLab fechado; logs `mlab-main.log` + `mlab-backend.log`;
  versão PATCH.
- Revalidação após a PR #103 (feature 033): nenhuma mudança em `apps/desktop/src/main/**`; em `cmd/server/main.go`
  só o listener de sala encerrada em `newServer` mudou, fora do bloco alterado pela T3401 (`main()`). As evidências de
  `research.md` continuam válidas.
- Numeração: a feature foi renumerada de 033 para 034 e os IDs de `330x` para `340x`, pois a 033 e os IDs `330x`
  passaram a pertencer a `033-encerramento-sala-pelo-hub`.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3401, RF-3402 | T3404 |
| RF-3403, RF-3405 | T3403 |
| RF-3404, RF-3406, RF-3409 | T3402 (lógica), T3403 (integração) |
| RF-3407, RF-3408 | T3401 |
| RF-3410 | T3405 |
| RF-3411 | T3407 |
| RF-3412 | T3408 |
| RF-3413 | T3406 |
| RF-3414 | T3401 (backend), T3406 (caminho do arquivo) |
| RNF-3401 | T3409 (matriz manual) |
| RNF-3402 | T3401, T3402, T3406, T3408 |
| RNF-3403 | T3401, T3402 |
| RNF-3404 | todas: nenhuma dependência nova |
| RNF-3405 | T3401 |

Nenhuma task sem requisito: T3409 cobre verificação, documentação e versão.

## 3. Contratos

- `contracts/backend-embarcado.md`: produtor `apps/desktop/src/main` (T3402, T3403, T3406), consumidor
  `apps/backend/cmd/server` (T3401). READY.
- Nenhum contrato existente muda. `001/contracts/room-api.md` (alterado pela 033) e `003/contracts/desktop-ipc.md`
  intactos.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3401 só `cmd/server`; T3402–T3406 só `src/main` (sem overlay, cursor, preload, renderer); T3407/T3408 só
build e empacotamento; T3409 só documentos e o bump.

## 5. Riscos de segurança/performance

- Encerrar processo por nome: só imagem do MLab e caminho da instalação; terceiros nunca (RNF-3402).
- Logs: segredos proibidos, verificado na T3406.
- NSIS compilado só no CI Windows: risco aceito, coberto pelo check da T3408.
- Comportamento do Windows não reproduzido na análise: coberto pela matriz manual da T3409.

## 6. Duplicações ou conflitos

- `main.ts` é tocado por T3403–T3407 em blocos distintos, em sequência pelo `Depends On`.
- Feature 032 altera `cursorPresence.ts` (proibido aqui) e lista `main.ts` nos seus Prohibited Paths: sem sobreposição.
- Feature 033 (mergeada) tocou `cmd/server/main.go` em `newServer`; a T3401 altera `main()`: sem sobreposição.

## 6a. Revalidação antes da T3401 (2026-11-15)

- **G-1 (resolvida):** `apps/backend/package.json` usa `"dev": "go run ./cmd/server/main.go"`; com
  `lifecycle*.go` no pacote `main`, esse comando deixaria de compilar e quebraria o `npm run dev`. O plan (§3.1,
  Allowed Paths, Decision Log) e a T3401 (Allowed Paths e check) passam a cobrir o script `dev` →
  `go run ./cmd/server`. Sem mudança de comportamento nem de contrato.
- **G-2 (resolvida):** com stdout/stderr em pipe, a morte do app faria o Go encerrar por `SIGPIPE` na próxima escrita
  em fd 1/2, antes do encerramento gracioso e do log em arquivo (RF-3414). O plan §3.1 registra `SIGPIPE` ignorado no
  Unix, dentro de `lifecycle_unix.go` (já permitido); check acrescentado à T3401.
- Spec, clarify e contrato não mudam; cobertura (§2) e Scope Lock (§4) continuam válidos.

## 7. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3401.
