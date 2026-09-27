# RF027 — Captura e Transmissão de Janela/Aba Específica (Application Isolation)

> **Categoria:** Captura de Mídia
> **Prioridade:** Alta
> **Status:** Aprovado

---

## Descrição

O sistema deve permitir a captura restrita de uma janela de aplicativo ou aba específica em execução. A transmissão deve isolar visualmente a janela escolhida, não transmitindo notificações, área de trabalho ou outras janelas do professor.

---

## Justificativa e Impacto

Garantir privacidade ao professor, evitando vazamento acidental de conversas privadas, notificações do SO ou arquivos pessoais durante a aula.

---

## Detalhes Técnicos

- Utiliza `desktopCapturer.getSources({ types: ['window'] })` no Electron.
- Filtra janelas internas do próprio MLab para evitar efeito espelho.
- Isola o conteúdo estritamente dentro das dimensões da aplicação selecionada.
