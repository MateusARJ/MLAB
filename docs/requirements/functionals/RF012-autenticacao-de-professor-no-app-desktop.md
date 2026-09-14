# ⚡ RF012 — Autenticação de Professor no App Desktop

> **Categoria:** Autenticação e Acesso  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O professor deve se autenticar com e-mail e senha no aplicativo desktop e receber um JWT de longa duração (8h).

---

## 🎯 Justificativa e Impacto

Garantir que apenas docentes cadastrados possam criar salas de transmissão.

---

## 🛠️ Detalhes de Implementação Técnicos

- Requisição POST para `/auth/login` com validação de senha por hash `bcrypt`.
- O token retornado é mantido no armazenamento local seguro do Electron.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
