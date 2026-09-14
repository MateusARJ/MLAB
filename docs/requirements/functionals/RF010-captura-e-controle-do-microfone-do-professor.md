# ⚡ RF010 — Captura e Controle do Microfone do Professor

> **Categoria:** Captura de Mídia  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O professor deve poder transmitir áudio do microfone junto com a tela e alternar (mutar/desmutar) o áudio durante a aula.

---

## 🎯 Justificativa e Impacto

Permitir a narração e explicação da aula pelo professor de forma clara e sob demanda.

---

## 🛠️ Detalhes de Implementação Técnicos

- O áudio é capturado via `navigator.mediaDevices.getUserMedia({ audio: true })`.
- O controle de mute alterna a propriedade `track.enabled` sem destruir a conexão WebRTC.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
