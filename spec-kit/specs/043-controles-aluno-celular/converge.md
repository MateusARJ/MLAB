# Converge: Controles do Aluno no Celular

Feature: `043-controles-aluno-celular`
Status: DONE
Branch: `fix/controles-aluno-celular`, a partir da `development` @ `0873ec8` (2.0.0)

## 1. Evidências

- `apps/web`: `npm test` (Vitest) — 5 arquivos, 57 testes verdes; `npm run lint` (`tsc --noEmit`) verde.
- Verificação visual com o backend e o Vite reais (Playwright, suíte temporária fora do repositório), medindo o
  espaço entre a pílula e o grupo e se o texto visível da pílula está cortado (`scrollWidth > clientWidth`):

| Largura | Espaço (normal / ativo) | Texto cortado |
|---|---|---|
| 320 px | 20,4 / 24 px | não |
| 360 px | 40,4 / 44 px | não |
| 390 px | 55,4 / 59 px | não |
| 480 px | 100,4 / 104 px | não |
| 540 px | 122,4 / 82,9 px | não |
| 600 px | 152,4 / 112,9 px | não |
| 768 px | 187,4 / 147,9 px | não |

- Desktop 1280 px: centro da pílula em 469,99 px, centro do vídeo em 470 px (centralizada, RF-4302).
- Paisagem 844 × 390 em tela cheia com o menu aberto: um único botão "Fechar menu da transmissão", com
  `aria-expanded="true"`; título do cabeçalho com reticências, sem ficar por baixo do gatilho.
- A primeira versão (espaçador que só encolhia) cortava o rótulo curto em 360 px ("Abaixar m…"); a spec, o clarify e
  o plan foram ajustados (`b263f8b`) antes da correção.
- `npx playwright test` (e2e do aluno): A10 e A15 verdes nos projetos `desktop` e `mobile`. A20 falhou e A14 passou no
  retry, os dois com o `4001` falso do desvio #127 (o aluno cai antes de ver o vídeo).

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4301 | `videoBottomBar` (flex, `gap: 8px`); teste "pílula de levantar mão e grupo..."; medidas acima |
| RF-4302 | `.ml-video-bar-spacer` (90 px, oculto até 600 px); medida em 1280 px |
| RF-4303 | `.ml-hand-label`/`.ml-hand-label-short` e `@media (max-width: 480px)`; teste "pílula ativa tem rótulo..." |
| RF-4304 | barra com `pointer-events: none`, pílula e grupo com `auto`; asserções no teste de estrutura |
| RF-4305 | `closeDrawerBtn` removido do `fullscreenSidebarHeader`; teste "menu em tela cheia tem um único X" |
| RF-4306 | `aria-expanded`, `aria-controls`, rótulos por estado; mesmo teste |
| RF-4307 | `fullscreenSidebarHeader` com `padding-right: 64px`; captura em paisagem |
| RNF-4301 | alturas mantidas (pílula 52 px, gatilho 44 px, botões do grupo 40 px) |
| RNF-4302 | testes existentes do `Room` verdes; A10 e A15 verdes |
| RNF-4303 | nenhuma dependência nova |

## 3. Desvios registrados

- #127 — `fix(web): e2e A13 cai com 4001 de sessao duplicada sem outra aba aberta`, comentado com a nova evidência
  (A20, A14 e primeiro teste após a subida do servidor). Não bloqueante: os testes exigidos pela tarefa passaram e a
  falha acontece na entrada, antes do layout alterado.

## 4. Trabalho restante

- Nenhum nesta feature.

## 5. Impacto de versão

**PATCH** (C-4303): correção visual e de acessibilidade do web do aluno, sem capacidade nova nem mudança de contrato
(`docs/versionamento.md` §2).
