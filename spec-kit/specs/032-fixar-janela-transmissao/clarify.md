# Clarify: Fixar uma Janela na Transmissão de Múltiplas Janelas

Feature: `032-fixar-janela-transmissao`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-15, na análise da issue #91.

## C-3201 — Base da implementação

- **Contexto:** o PR #93 (`028`, design system 2.0, aberto) reescreve o `Room.tsx`, inclusive o seletor "Janelas da
  Aula" e o rótulo da prévia.
- **Opções:** (A) escrever agora só os artefatos SDD e implementar depois do merge do #93; (B) implementar já na
  `development`; (C) partir da branch do #93.
- **Resposta aprovada:** **A**. Evita conflito grande no `Room.tsx`. Antes da T3203, o `analyze` é revalidado contra o
  `Room.tsx` da `development` com o #93.
- **Impacto em spec:** nenhum requisito; ordem de execução das tarefas.

## C-3202 — Cursor e lupa com uma janela fixada

- **Contexto:** o main move o alvo do cursor para a janela autorizada em foco. Com a fixação só no renderer, o cursor e
  a lupa seriam calculados sobre a janela em foco (B) e desenhados no vídeo da fixada (A), no lugar errado.
- **Opções:** (A) cursor e lupa só na janela fixada, com `pinnedSourceId` no IPC `cursor-tracking:start`; (B) manter a
  regra atual para todas as autorizadas.
- **Resposta aprovada:** **A**. Mantém a regra da 007 (cursor só na janela transmitida, em foco e sob o ponteiro). O
  main continua emitindo `active-window-changed`, necessário para RF-3203/RF-3204. Mudança compatível no IPC interno
  do desktop, sem `packages/types`.
- **Impacto em spec:** RF-3208, RF-3211, RNF-3201; contrato `003/contracts/desktop-ipc.md`.

## C-3203 — Janela fixada fechada ou minimizada

- **Opções:** (A) fechada (faixa `ended`) desfixa e volta a seguir o foco; minimizada continua fixada; (B) nunca
  desfixar sozinho.
- **Resposta aprovada:** **A**. Uma janela fechada não tem mais o que transmitir; minimizar é estado temporário e já é
  tratado assim hoje no modo de janela única.
- **Impacto em spec:** RF-3207.

## C-3204 — Atalho de teclado e barra de marcação

- **Opções:** incluir um atalho global (ex.: `Alt+F`) e/ou o estado "Fixada" na barra de marcação; ou nenhum.
- **Resposta aprovada:** **nenhum**. Os dois exigem mudanças no main (atalhos globais, IPC da barra) fora do objetivo
  da issue. Ficam como Non-Goals e podem virar feature própria.
- **Impacto em spec:** escopo "Não incluído".

## C-3205 — Clique no nome da janela com outra janela fixada

- **Contexto:** a issue define "fixar outra janela substitui a fixação", mas não o clique no nome (troca manual) com uma
  janela fixada. Trocar a fonte sem mover a fixação deixaria no ar uma janela que não é a fixada.
- **Opções:** (A) com uma janela fixada, clicar no nome de outra janela a fixa; (B) clicar no nome troca a fonte e
  desfixa; (C) clicar no nome fica desabilitado enquanto houver fixação.
- **Resposta aprovada:** **A**. Mantém um único estado coerente (a janela no ar é a fixada) e preserva a intenção do
  professor de "segurar" uma janela. Sem fixação, o clique segue como hoje.
- **Impacto em spec:** RF-3202, RF-3209.

## C-3206 — Gravação, evento unauthorized, testes, IDs e versão

- **Gravação local:** a fixação não muda a gravação. Ela se comporta como em qualquer troca de janela de hoje (troca
  por foco ou pelo seletor): o `MediaRecorder` usa o stream passado em `startRecording` no início da sessão, e o
  `changeStream` não o atualiza. Qualquer problema da gravação após troca de janela é anterior a esta feature; se for
  confirmado na verificação manual da T3206, vira issue de desvio (AGENTS.md §14), sem correção aqui.
- **`active-window-unauthorized`:** fora do escopo; o renderer não o usa desde a 020.
- **Testes:** o `cursorPresence.ts` não tem arquivo de teste; a T3201 cria `cursorPresence.test.ts` com `electron` e o
  rastreador nativo simulados (padrão de `nativeWindowTracker.test.ts` e `annotationOverlayWindow.test.ts`).
- **Faixa de IDs:** `US-320x`, `RF-320x`/`RF-321x`, `RNF-320x`, `C-320x` e `T320x` (quatro dígitos; não colidem
  com IDs de três dígitos de outras features).
- **Impacto de versão:** **MINOR**: funcionalidade nova compatível com adição opcional no IPC interno
  (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-3201 a C-3206 respondidas; nenhuma ambiguidade em aberto.
