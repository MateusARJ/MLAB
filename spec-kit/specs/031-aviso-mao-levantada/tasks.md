# Tasks: Aviso de Mão Levantada Clicável e Sincronizado com a Fila

Feature: `031-aviso-mao-levantada`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- `npm test` e `npm run lint` (`tsc --noEmit`) em `apps/desktop` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T310x` e `Refs #90`.

### T3101 — Aviso acima do canvas de marcação
[x] T3101
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/RoomHandRaise.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/hooks/**`, `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`,
`apps/backend/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] `handToastOverlay.zIndex` = 20, com comentário da ordem de camadas (RF-3101, C-3103).
- [x] Teste novo: com o aviso visível, para cada ferramenta da barra, `zIndex` do aviso > canvas e < barra de
  marcação; falha com o valor antigo (10).
- [x] Teste: "Ver Turma" chama `dismissHandToast` e mostra a aba de alunos (RF-3102).

### T3102 — Regra pura de limpeza do aviso
[x] T3102
Allowed Paths: `apps/desktop/src/renderer/hooks/handToast.ts`, `apps/desktop/src/renderer/hooks/handToast.test.ts`
Prohibited Paths: `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`, `apps/desktop/src/renderer/pages/**`,
`apps/desktop/src/main/**`, `apps/backend/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] `clearHandToastOnLower`: mesmo id → `null`; outro id → mesmo objeto; aviso `null` → `null` (RF-3103, RF-3104,
  RF-3106).
- [x] `clearHandToastOnParticipants`: aluno ausente → `null`; aluno com `hand_raised` falso → `null`; aluno de mão
  levantada → mesmo objeto; mudança só de outros alunos → mesmo objeto (RF-3105, RF-3106).

### T3103 — Hook aplica a regra nos três caminhos
[x] T3103
Depends On: T3102
Allowed Paths: `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`
Prohibited Paths: `apps/desktop/src/renderer/hooks/handToast.ts`, `apps/desktop/src/renderer/pages/**`,
`apps/desktop/src/main/**`, `apps/backend/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] `hand-updated` com `raised` falso aplica `clearHandToastOnLower` (RF-3103).
- [x] `lowerStudentHand` aplica `clearHandToastOnLower` (RF-3104).
- [x] `participants-update` aplica `clearHandToastOnParticipants` (RF-3105).
- [x] Tipo de `lastHandRaised` passa a ser `HandToast`; nenhuma mensagem WebSocket muda.

### T3104 — Verificação, converge e versão
[x] T3104
Depends On: T3101, T3103
Allowed Paths: `spec-kit/specs/031-aviso-mao-levantada/**`, `spec-kit/specs/003-classroom-interaction/spec.md`,
`package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `apps/backend/**`, `.github/**`
Checks:
- [x] Verificação manual no app real (passos da issue #90) ou impossibilidade registrada no `converge.md`.
- [x] Nota na US-11 da `003/spec.md` apontando a 031.
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-3104).
- [x] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [x] `npm run spec:check -- spec-kit/specs/031-aviso-mao-levantada` com PASS.
