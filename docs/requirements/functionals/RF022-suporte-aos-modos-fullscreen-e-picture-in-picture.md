# ⚡ RF022 — Suporte aos Modos Fullscreen e Picture-in-Picture

> **Categoria:** Player Web  
> **Prioridade:** Normal  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O player do aluno deve permitir visualização em Tela Cheia (Fullscreen API) e em janela flutuante (Picture-in-Picture API).

---

## 🎯 Justificativa e Impacto

Oferecer conforto e flexibilidade de aprendizado ao aluno que deseja anotar conteúdo em outro programa.

---

## 🛠️ Detalhes de Implementação Técnicos

- Botões dedicados no overlay do player invocam `element.requestFullscreen()` e `video.requestPictureInPicture()`.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
