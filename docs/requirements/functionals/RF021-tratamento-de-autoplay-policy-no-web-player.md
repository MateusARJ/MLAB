# ⚡ RF021 — Tratamento de Autoplay Policy no Web Player

> **Categoria:** Player Web  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O cliente web deve tratar o bloqueio de Autoplay dos navegadores exibindo uma interface clara para ativação do áudio pelo aluno.

---

## 🎯 Justificativa e Impacto

Navegadores modernos (Chrome, Safari) bloqueiam reprodução automática de áudio sem interação prévia do usuário.

---

## 🛠️ Detalhes de Implementação Técnicos

- Se a chamada `.play()` do elemento de `<audio>` ou `<video>` falhar com `NotAllowedError`, o frontend exibe um banner/botão interativo "Clique para ouvir o áudio da aula".

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
