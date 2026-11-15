# Checklist de Requisitos: Encerramento Completo do App e do Backend Embarcado

Feature: `034-encerramento-backend-orfao`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3401 a RF-3414, RNF-3401 a RNF-3405) tem task (ver `analyze.md` §2).
- [x] Ambiguidades fechadas (C-3401 a C-3407): dono da porta, janela principal, macOS, binário, NSIS, logs, testes e versão.
- [x] Evidência registrada com arquivo e linha na `development` @ `e380ddb` (`research.md`): overlay independente
  (`annotationOverlayWindow.ts:114-130`, `Room.tsx:665-674`, `main.ts:194-205`), reaproveitamento sem gestão
  (`main.ts:544-548`), chave de host por execução (`hostKey.ts`, `auth/handler.go:34-48`), `taskkill` sem espera
  (`main.ts:615-634`), backend sem sinais/watchdog (`cmd/server/main.go:46-50`); revalidado @ `d1b4886`.
- [x] Edge cases cobertos: reabrir logo após matar, `taskkill` falho, modo dev, chave de host do ambiente, backend
  legado.

## Coerência

- [x] ADR 0005 (estado por execução) e ADR 0006 (chave de host por execução) reforçadas, não alteradas.
- [x] Nenhum contrato público muda com C-3401 (B); contrato interno novo `contracts/backend-embarcado.md`.
- [x] `/health` fora de escopo, coerente com a 021 (§3 "Não incluído").
- [x] IPC do desktop (`003/contracts/desktop-ipc.md`) inalterado.
- [x] Sem dependência nova; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs `340x`/`341x` com quatro dígitos não colidem com outras features (a 033 usa `330x`).

## Segurança

- [x] O app só encerra processos reconhecidos como backend do MLab (RNF-3402, plan §6).
- [x] Segredos (`MLAB_HOST_KEY`, `JWT_SECRET`) proibidos nos logs novos.
- [x] Nenhuma autorização do servidor muda.

## Performance

- [x] Tempos de encerramento tratados como alvo e medidos por log e teste (plan §7).
- [x] Diagnóstico não atrasa a partida do backend.

## Controle de escopo

- [x] Scope Lock completo (IN, OUT, Allowed, Prohibited, Dependencies, Non-Goals).
- [x] Cada task tem Allowed Paths e Prohibited Paths dentro do Scope Lock.

## Viabilidade

- [x] Testes Go do watchdog sem processo pai real (`io.Pipe`, PID inválido) e com processo auxiliar.
- [x] Módulo do desktop com dependências injetadas testável no vitest sem Electron.
- [x] electron-builder 24 expõe `customInit`/`customUnInit` e inclui `LogicLib` no template NSIS.
- [x] Script NSIS só é compilado no CI Windows: risco aceito no plan §9 e coberto pelo check da T3408.

## Resultado

APPROVED
