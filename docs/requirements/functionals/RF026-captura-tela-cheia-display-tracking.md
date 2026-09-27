# RF026 — Captura e Transmissão de Tela Cheia (Display Tracking)

> **Categoria:** Captura de Mídia
> **Prioridade:** Alta
> **Status:** Aprovado

---

## Descrição

O sistema deve permitir a captura do monitor/display completo selecionado pelo professor. A transmissão deve acompanhar o professor em tempo real por todo o sistema operacional, refletindo a alternância de janelas, abertura de aplicativos, navegador, terminal e desktop.

---

## Justificativa e Impacto

Permitir aulas práticas que envolvem múltiplos programas ou navegação ampla no sistema sem necessidade de reconfigurar fontes de compartilhamento a cada janela alternada.

---

## Detalhes Técnicos

- Utiliza `desktopCapturer.getSources({ types: ['screen'] })` no processo principal do Electron.
- Injeta o `chromeMediaSourceId` correspondente com constraints 1080p e 30 FPS.
- Combina áudio do microfone do professor.
