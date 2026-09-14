# ⚡ RF004 — Captura Nativa de Tela e Janela no Desktop

> **Categoria:** Captura de Mídia  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

A captura de tela no aplicativo desktop deve utilizar a API nativa `desktopCapturer` do Electron.

---

## 🎯 Justificativa e Impacto

Permitir que o professor escolha compartilhar a tela inteira (monitor) ou janelas específicas de aplicações.

---

## 🛠️ Detalhes de Implementação Técnicos

- O App Desktop exibe uma modal customizada de seleção com thumbnails renderizadas via `desktopCapturer.getSources()`.
- O stream selecionado é convertido em `MediaStreamTrack` de vídeo e injetado na `RTCPeerConnection`.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
