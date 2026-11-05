# Spec: Barra de Marcação no Linux

Status: READY
Feature ID: `009-marcacao-linux`
Origem: issue #30 ("barra de marcação não recolhe, não recebe cliques e atalhos não funcionam no Linux").

## 1. Objetivo

Fazer a barra do overlay de anotação (003, US-19, RF-309) funcionar no app desktop do professor no Linux. Hoje, no
Linux, o clique na barra atravessa o overlay e chega à janela de baixo, a barra não recolhe nem expande e os atalhos
de teclado não têm efeito. No Windows o comportamento está correto e **não muda**.

## 2. Escopo

### Incluído

- clique nos botões da barra de marcação no Linux (ferramentas, cores, desfazer/refazer/limpar, lupa, recolher/expandir);
- recolher e expandir a barra pelo botão e pelo atalho `Alt+H` no Linux;
- atalhos `Alt+…`/`Alt+Shift+…` da 003 no Linux, com registro em log das combinações que o sistema recusar;
- atalhos de letra única do overlay (003) no Linux depois de um clique na barra.

### Não incluído

- duplo toque em `Ctrl` no Linux: a 003 define esse gesto como exclusivo do Windows (RF-309, linha "somente no Windows");
- atalhos globais via portal do Wayland (exige upgrade do Electron — ver C-902);
- mudança no comportamento do Windows e do macOS;
- mudança na máscara de cursor, na captura de tela ou no backend.

## 3. Atores

Professor (app desktop no Linux: X11 ou Wayland com XWayland).

## 4. User Stories

### US-901 — Usar a barra de marcação no Linux
**Como** professor no Linux, **quero** clicar nos botões da barra de marcação, **para** trocar de ferramenta, desfazer,
limpar e ligar a lupa como no Windows.
- Com a ferramenta cursor, o clique sobre a barra é recebido pela barra; fora dela, atravessa para as janelas de baixo.
- Com uma ferramenta de desenho, o overlay recebe o clique em toda a tela, como no Windows.

### US-902 — Recolher a barra no Linux
**Como** professor no Linux, **quero** recolher e expandir a barra, **para** liberar a área da tela durante a aula.
- O botão de recolher e o botão redondo de expandir funcionam; `Alt+H` alterna quando o sistema aceitar o atalho.

### US-903 — Atalhos no Linux
**Como** professor no Linux, **quero** que os atalhos da barra funcionem, **para** trocar de ferramenta sem procurar o botão.
- Na sessão X11, os atalhos globais da 003 funcionam com qualquer janela em foco, exceto combinações reservadas pelo
  ambiente gráfico, que ficam registradas em log.
- Depois de clicar na barra, os atalhos de letra única do overlay funcionam também no Wayland.

## 5. Requisitos

- RF-901: no Linux, a barra (incluindo o popover de cores) recebe os cliques e o resto da tela segue em click-through,
  sem depender do encaminhamento de eventos de mouse nem da posição do ponteiro informada pelo sistema (C-901, C-904).
  O overlay recorta sua região de entrada X11: só o retângulo da barra quando o renderer pede click-through; a tela
  inteira quando pede captura (ferramenta de desenho, ponteiro sobre a barra, arraste); vazia com retângulo `null`.
  Enquanto o MLab estiver em foco e não houver arraste da barra, o overlay segue em click-through, como no Windows (C-903).
  Se a região de entrada X11 não puder ser aplicada (ex.: `libXext` ausente), o main usa o hit-test por posição do
  ponteiro (C-901) como alternativa.
- RF-902: o retângulo da barra é informado pelo overlay ao processo principal sempre que muda (posição, recolhida ou
  expandida, orientação, popover aberto ou fechado).
- RF-903: o processo principal registra em log cada atalho global que o sistema recusar.
- RF-904: no Linux, depois de um clique na barra, os atalhos de letra única do overlay funcionam enquanto ele tiver o
  foco do teclado (C-902).
- RNF-901: Windows e macOS mantêm o caminho atual (`setIgnoreMouseEvents(true, { forward: true })`), sem nova chamada
  de IPC por quadro.
- RNF-902: no Linux, com a região de entrada X11, não há temporizador: a região só é reaplicada quando muda o pedido
  de click-through, o retângulo da barra ou os limites do overlay. Só na alternativa por posição do ponteiro roda um
  único temporizador de 16 ms, ativo enquanto o overlay existir e a barra estiver visível, sem IPC por ciclo e
  chamando `setIgnoreMouseEvents` só quando o estado muda. O laço do `CursorPresenceTracker` não serve: ele só roda
  durante a captura, e o overlay vive a sessão inteira.

## 6. Regras de Negócio

- RN-901: as regras de anotação da 003 (US-19, RF-309) valem como estão; esta feature só corrige o Linux.

## 7. Critérios de Sucesso

- Testes unitários cobrem a região de entrada da barra no Linux (cursor, recolhida, ferramenta de desenho, `null`,
  limites do overlay alterados, alternativa por posição do ponteiro), o envio do retângulo pelo overlay e o log de
  atalho recusado.
- Teste manual no Ubuntu com GNOME (X11) e no WSLg (Wayland + XWayland): clique, recolher e atalhos conforme US-901
  a US-903. No WSLg, janelas Linux não ficam acima de apps nativos do Windows; esconder o overlay atrás deles é
  limitação do ambiente, não falha da feature.
- Smoke da barra no Windows sem regressão.
- Suítes normais e builds continuam verdes.
