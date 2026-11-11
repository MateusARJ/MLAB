# Clarify: Mãos Levantadas na Barra de Marcação

Feature: `017-maos-na-barra-marcacao`
Status: CLOSED

Decisões tomadas com o responsável em 2026-11-10, na análise da issue #45 sobre a `development` @ `335e305`.

## C-171 — Borda fixa ou pulsante

- **Contexto:** a issue deixou em aberto se a borda pisca a cada mão nova. A barra fica sobre a área transmitida e,
  em tela cheia, entra no vídeo dos alunos (C-172).
- **Opções:** (A) borda fixa enquanto houver mão; (B) pulso curto a cada mão nova e depois fixa; (C) animação contínua.
- **Resposta aprovada:** **A**. Sem animação: não distrai os alunos no vídeo e não custa quadros de renderização.
- **Impacto em spec:** RF-172; seção 11 (animação fora de escopo).
- **Impacto em plan/contracts/tasks:** nenhum contrato; estilo fixo na barra.

## C-172 — O destaque aparece para os alunos?

- **Contexto:** a janela do overlay usa `setContentProtection(false)` de propósito
  (`apps/desktop/src/main/annotationOverlayWindow.ts:143`), para o Windows Graphics Capture capturar marcações e Lupa
  pela GPU (`cursorMask.worker.ts:355`, `capturedNativelyByScreen`). A barra flutuante vive nessa janela; portanto,
  em **tela cheia**, ela já entra no vídeo, e o indicador também entraria. Em **janela específica** não entra. O
  comentário de `preload.ts:102` diz o contrário e foi registrado como desvio na #62.
- **Opções:** (A) aceitar e registrar; (B) esconder o indicador do vídeo, o que exige tirar a barra do overlay
  capturado ou mascarar a região no worker.
- **Resposta aprovada:** **A**. O indicador é só um número, sem dados pessoais, e os alunos já sabem quando
  levantaram a mão. B muda a arquitetura de captura e fica fora desta feature.
- **Impacto em spec:** RN-171; seção 2 (não incluído) e 11.
- **Impacto em plan/contracts/tasks:** smoke manual confere o comportamento em tela cheia e em janela específica.

## C-173 — Clicar no indicador faz algo?

- **Opções:** (A) só indicador; (B) traz a janela do MLab com a fila aberta.
- **Resposta aprovada:** **A**. B exige um canal novo do overlay para a janela principal e foco de janela; fica para
  depois, se pedido.
- **Impacto em spec:** RF-177; seção 11.
- **Impacto em plan/contracts/tasks:** o canal novo é só de ida (C-177).

## C-174 — Com zero mãos, o ícone some ou fica neutro?

- **Resposta aprovada:** **some**. Com zero mãos a barra fica igual à atual, sem regressão visual nem mudança de
  tamanho.
- **Impacto em spec:** RF-175.
- **Impacto em plan/contracts/tasks:** o retângulo da barra muda de tamanho quando o indicador aparece ou some; o
  envio do retângulo no Linux precisa acompanhar (RNF-173).

## C-175 — Limite do badge e texto acessível

- **Contexto:** a sala tem limite padrão de 50 alunos; um badge de dois dígitos alarga a barra.
- **Resposta aprovada:** `1` a `9`; a partir de 10, `9+`. `title` e `aria-label`: "Mãos levantadas: N", com N real.
- **Impacto em spec:** RF-173, RF-174, RNF-174.
- **Impacto em plan/contracts/tasks:** testes com 9 e 10.

## C-176 — Barra visível sobre uma janela que não é a transmitida

- **Contexto:** a barra aparece sempre que o MLab perde o foco (`FloatingAnnotationOverlay.tsx:985`), mesmo se o
  professor estiver numa janela que não é a transmitida.
- **Resposta aprovada:** mesma regra de visibilidade da barra; o indicador aparece sempre que a barra aparece.
- **Impacto em spec:** RF-178.
- **Impacto em plan/contracts/tasks:** nenhuma regra de visibilidade nova.

## C-177 — Como a quantidade chega à barra

- **Contexto:** a issue propôs um campo novo em `AnnotationSessionState` ou um canal novo. O estado de marcação faz
  ida e volta entre o MLab, o main e o overlay: o overlay substitui o estado inteiro ao receber
  (`FloatingAnnotationOverlay.tsx:328`) e devolve a própria cópia a cada clique (`pushStateToMain`, `:169`); o main
  guarda o último estado recebido de qualquer lado (`annotationOverlayWindow.ts:236`); e o MLab pula um envio logo
  após receber estado do overlay (`syncingFromExternalRef`, `Room.tsx:735`).
- **Opções:** (A) campo em `AnnotationSessionState`; (B) canal próprio, só de ida (MLab → main → overlay).
- **Resposta aprovada:** **B**. Com A, um clique na barra poderia devolver uma contagem velha e sobrescrever a nova,
  o envio poderia ser pulado, e cada mudança de mão reenviaria todos os traços. B separa a contagem do estado de
  marcação, permite validar a origem no main (como o `annotation-overlay:toolbar-rect` da 009) e guardar o último
  valor para quando a barra for recriada.
- **Impacto em spec:** RF-179, RNF-171, RNF-172; seção 9.
- **Impacto em plan/contracts/tasks:** entrada nova, compatível, em `003/contracts/desktop-ipc.md`; tipo em
  `packages/types` se o plan precisar; nomes de canal e método definidos no plan.

## C-178 — Notificação do sistema, som e barra de tarefas

- **Resposta aprovada:** fora de escopo; registrados na seção 11 como possível feature futura.
- **Impacto em spec:** seções 2 e 11.
- **Impacto em plan/contracts/tasks:** nenhum.

## C-179 — Versão, entrega e numeração

- **Resposta aprovada:** uma feature, um PR, bump **MINOR** (funcionalidade nova compatível; contrato IPC recebe
  adição compatível). O PR fecha a #45. IDs na faixa `17x` (RF-171…, T171…), para caber no padrão `T\d{3}` do
  validador (ver #50), como na 012.
- **Impacto em spec:** IDs.
- **Impacto em plan/contracts/tasks:** tarefas `T171…`.

## Perguntas resolvidas

- [x] C-171
- [x] C-172
- [x] C-173
- [x] C-174
- [x] C-175
- [x] C-176
- [x] C-177
- [x] C-178
- [x] C-179

## Resultado

CLOSED — C-171 a C-179 respondidas; nenhuma ambiguidade em aberto.
