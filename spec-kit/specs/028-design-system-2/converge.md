# Converge: Design System 2.0 com Tema Claro e Escuro

Feature: `028-design-system-2`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md` e o item VIII do `plan.md` são escritos)
Data: 2026-11-14
Commits avaliados: `7efbcd6` (artefatos), `25c30a0` (T2801), `0f8b34c` (T2802), `a1bb1cc` (T2803), `41de663` (T2804),
`6a4c2f0` (T2805), `21e248a` (T2806), `6e0db37` (T2807), `e4ab077` (T2808), `99f21a8` (T2809)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2801 a C-2809), `plan.md`, `tasks.md` (T2801 a T2810); issues #92 e #89
- código: `packages/ui/src/**`; páginas e dois componentes do renderer do desktop; páginas, `App.tsx`, `index.html`
  e `public/` da web
- suítes (ambiente Linux do agente, Node 22):
  - `npm run test -w apps/desktop`: 30 arquivos, 315 testes verdes;
  - `npm run test -w apps/web`: 5 arquivos, 54 testes verdes;
  - `npm run lint -w` em `packages/ui`, `apps/desktop` e `apps/web`: verdes, inclusive após T2802, T2803 e T2804;
  - `npm run build -w` em `packages/types`, `packages/ui`, `apps/web` e `apps/desktop`: verdes;
  - `npm run spec:check -- spec-kit/specs/028-design-system-2`: PASS.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2801 | `packages/ui/src/styles/tokens.css` (`[data-theme]`), `tokens.ts` (`0f8b34c`) |
| RF-2802 | `ThemeToggle.tsx` (`initTheme`, `useTheme`, `mlab-theme`); botão nas telas do desktop e da web |
| RF-2803 | `styles/fonts/*.woff2` (`25c30a0`) e `@font-face` em `tokens.css`; o build da web e do desktop empacota os `woff2` |
| RF-2804 | `index.ts` reexporta `lucide-react` com os nomes antigos; busca por `@carbon` em `apps/`, `packages/` e no lockfile sem resultado (`a1bb1cc`) |
| RF-2805 | `Button`, `IconButton`, `TextInput`, `StatusBadge`, `Alert`, `Card` + `styles/components.css`; lint dos apps verde com o código antigo das páginas, o que confirma as props mantidas |
| RF-2806 | `Brand.tsx` + `assets/mlab-logo-mark.png` |
| RF-2807 | `tokens.css` sem primitivos âmbar; `--attention` azul (escuro) e cinza (claro); `FloatingAnnotationOverlay.tsx` sem mudança |
| RF-2808 | `ProfessorEntry.tsx`; `ProfessorEntry.test.tsx` |
| RF-2809 | `Dashboard.tsx`; `Dashboard.test.tsx` |
| RF-2810 | `Room.tsx` (etapa de preparo); `Room.test.tsx` (seleção automática, padrões) |
| RF-2811 | `Room.tsx` (sala ao vivo); `Room.test.tsx`, `RoomHandRaise.test.tsx`, `RoomFileDrop.test.tsx` |
| RF-2812 | `Join.tsx`; `Join.test.tsx` (inclusive o aviso do `409` da 027) |
| RF-2813 | `apps/web/src/pages/Room.tsx` (`ml-spin-slow` no aviso de pausa; `student-id-in-use` preservado); `Room.test.tsx` |
| RF-2814 | `apps/web/public/favicon-32.png` (32×32), `apple-touch-icon.png` (180×180, RGB), `favicon.svg` excluído; `favicon.test.ts` |
| RF-2815 | `annotationToolbarPosition.ts` + teste (7 casos); `Room.tsx` (arraste, `ResizeObserver`, `maxHeight` e rolagem). Medido no renderer com a barra aberta: 1366×768 → prévia 481 px, barra 455 px inteira; 1280×720 → prévia 433 px, barra 417 px inteira; 1280×600 → prévia 313 px, barra 297 px com rolagem; arrastar para baixo e encolher a janela mantêm 8 px de folga |
| RNF-2801 | `git diff development..HEAD` vazio em `apps/backend`, `src/main`, `preload.ts`, hooks, serviços, `packages/types` e `FloatingAnnotationOverlay.tsx`; no `Room.tsx` do desktop, antes da marcação só mudam imports e o bloco da barra (T2808) |
| RNF-2803 | nenhuma URL externa em `packages/ui/src/styles` |
| RNF-2804 | `packages/ui/package.json`: só `lucide-react` |
| RNF-2805 | suítes verdes; testes alterados só em rótulos, papéis e no favicon |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RF-2816 | O `README.md` mantém uma menção a Carbon no histórico de ferramentas usadas na construção (fato passado). As descrições do estado atual foram trocadas. | `README.md`, seção de créditos |
| RNF-2802 | O contraste AA foi definido nos tokens e descrito em `docs/design-system.md`, mas não há teste automatizado de contraste. | `tokens.css`, `docs/design-system.md` |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Plano dizia | Código faz | Encaminhamento |
|---|---|---|---|
| Remoção do Carbon | T2801 (plano aprovado na conversa) | T2803 | registrado no `analyze.md`; cada commit compila |
| Rótulo do palco ao vivo | — | "Modo: Tela inteira" / "Janelas escolhidas (N autorizadas)" | segue a C-2803 |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| No arraste, a posição inicial da barra passa a ser a posição real dela (antes era 15% da altura, o que fazia a barra pular no primeiro arraste) | `Room.tsx` (`handleStartDragToolbar`) | consequência do RF-2815: o limite precisa da posição e do tamanho reais |

## 5. Testes faltantes

- Backend (`go vet`, `go test`): **não executado** neste ambiente (o toolchain Go 1.26 não pôde ser baixado). Nenhum
  arquivo de `apps/backend` mudou.
- E2E do aluno (`apps/web/e2e`, Playwright): **não executado** (depende do backend). Os textos foram atualizados.
- `npm run lint` e `npm run build` pelo Turborepo param no backend pelo mesmo motivo; os quatro workspaces
  JavaScript foram verificados um a um.
- Validação manual no Windows (Electron, tema claro e escuro, aula real com um aluno, favicon na aba): fica com o
  responsável, antes do merge.
- Atualização de 2026-11-15 (seção 10): backend, build completo e lint passaram; o E2E do aluno continua **não
  executado** (o Chromium do Playwright foi instalado, mas a execução foi interrompida por falta de memória na
  máquina).
- Atualização de 2026-11-16 (seção 12): E2E do aluno executado (11 verdes, 1 instável, 1 falha pré-existente → #126)
  e validação manual no Electron confirmada pelo responsável.

## 6. Novas tasks necessárias

- Nenhuma na 028.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #89 | `bug`, `desvio`, `area:desktop` | não | corrigida nesta feature (T2808, C-2807) |
| #90 | `bug`, `desvio`, `area:desktop` | não | aviso de mão levantada: botões não respondem e o aviso não some; fechada pela feature 031 (seção 10) |
| #91 | `enhancement`, `area:desktop` | não | fixar uma janela na transmissão de múltiplas janelas; aberta, especificada na feature 032 (ainda não implementada) |
| #126 | `bug`, `desvio`, `area:web` | não | e2e A19 ainda espera a troca de sessão da mesma matrícula (`4001`) em vez da recusa da ADR 0010 (`409`/`4002`); falha também na `development` sem este PR; aberta (seção 12) |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MAJOR | 2.0.0 | Escolhido pelo responsável (C-2809): o fluxo do professor muda de organização e de rótulos. Commit com `!`: `964abc3` (antes `41de663` e `081327b`). |

O bump parte da versão da `development` no momento da atualização (1.15.10, seções 10 e 11). O PR fica em rascunho e só
entra na `development` depois que a 1.15.x for para a `main` (C-2809, mantida pelo responsável em 2026-11-15). Se a
`development` mudar até lá, a branch é rebaseada de novo e o commit `chore(release)` é refeito.

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o design system 2.0 está aplicado no desktop e na web, com tema claro e escuro, sem mudança em
  hooks, serviços, contratos e backend; o favicon usa a logo do cabeçalho e a barra de marcação fica dentro da
  prévia. Pendências de execução na seção 5.

## 10. Atualização sobre a development 1.15.8 (2026-11-15)

A branch foi rebaseada da base `7bb2499` (1.15.0) para a `development` na 1.15.8 (`ecf1583`), que trouxe as features
029 a 038. O commit de release anterior foi descartado e refeito ao final.

| Ponto | Encaminhamento |
|---|---|
| Conflito em `Room.tsx`, estilo `handToastOverlay` | A 031 (`1805bb0`, RF-3101) subiu o `zIndex` do aviso de mão para 20, entre o canvas (15) e a barra (25). Mantidos os tokens do design system 2.0 e o `zIndex: 20` com o comentário da 031; o PR já mantinha canvas 15, barra 25 e popover 30. |
| Testes da 031 em `RoomHandRaise.test.tsx` | Usavam o rótulo antigo "Avançar e Iniciar Transmissão"; passaram a usar "Começar transmissão" (`test(desktop)`, T2805). Comportamento testado inalterado. |
| #90 | Fechada pela 031 antes da atualização; o aviso continua clicável no visual novo (testes de camadas e "Ver Turma" verdes). |
| Demais arquivos alterados pela development | `handToast.ts`, `useWebRTCPublisher.ts`, `packages/types`, backend e CI mesclaram sem conflito e fora do Scope Lock da 028. |

Validações após o rebase (Windows, Node 22, Go 1.27):

- `npm run test -w apps/desktop`: 32 arquivos, 357 testes verdes;
- `npm run test -w apps/web`: 5 arquivos, 54 testes verdes;
- `npm run lint -w` em `packages/ui`, `apps/web` e `apps/desktop`: verdes;
- `cd apps/backend && go test ./...`: verde;
- `npm run build` (Turborepo, 5 tarefas): verde;
- `npm run spec:check`: PASS em todas as features;
- E2E do aluno: não executado (seção 5).

## 11. Atualização sobre a development 1.15.10 (2026-11-16)

A branch foi rebaseada de novo, da 1.15.8 (`ecf1583`) para a `development` na 1.15.10 (`3646ecb`), que trouxe as
features 039 a 041 (backend), mudanças de CI, o README até a 1.15.10 e as notas de release. O commit de release foi
descartado e refeito ao final.

| Ponto | Encaminhamento |
|---|---|
| Conflitos | Só o campo `version` dos `package.json` e do `package-lock.json`, resolvido pelo novo bump. Nenhum conflito de código. |
| `README.md` | Mesclado sem conflito; o Carbon aparece só no histórico de ferramentas (RF-2816, seção 2). |
| Demais arquivos | Backend, CI e `docs/releases` ficam fora do Scope Lock da 028. |

Validações após o rebase (Windows, Node 22, Go 1.27):

- `npm run test -w apps/desktop`: 32 arquivos, 357 testes verdes;
- `npm run test -w apps/web`: 5 arquivos, 54 testes verdes;
- `npm run lint -w` em `packages/ui`, `apps/web` e `apps/desktop`: verdes;
- `cd apps/backend && go test ./...`: verde;
- `npm run build` (Turborepo, 5 tarefas): verde;
- `npm run spec:check`: PASS;
- E2E do aluno e validação manual no Electron: não executados (seção 5).

## 12. E2E do aluno e validação manual (2026-11-16)

- **Validação manual no Windows:** o responsável confirmou que o app do professor abre e funciona com a interface
  nova, e que os comandos do Electron e o electron-builder funcionam.
- **E2E do aluno** (`npx playwright test` em `apps/web`, Chromium 1148, base 1.15.10): 13 testes; 11 verdes,
  1 instável e 1 falha.
  - Instável: passou na nova tentativa; na primeira, o Chromium não abriu dentro de 180 s com a máquina sob pouca
    memória (`browserType.launch: Timeout`), sem relação com a interface.
  - Falha: `A19 mesma matrícula em outra aba encerra a sessão anterior com aviso`. A segunda aba recebe o `409` da
    ADR 0010 e fica na entrada com "Esta matrícula já está conectada nesta transmissão.", mas o teste ainda espera a
    troca de sessão com `4001`. Com instalação limpa da `development` 1.15.10 (`3646ecb`), sem este PR, o A19 falha
    no mesmo ponto (`fixtures.ts:144`, chamado em `aluno.e2e.ts:150`). Desvio não bloqueante registrado na #126; a
    correção fica para tarefa própria.
- Os rótulos novos usados pelo e2e ("Nome completo", "Matrícula", "Entrar na aula") foram encontrados em todos os
  testes que passam pela entrada.
