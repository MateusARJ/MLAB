# ⚡ RF011 — Identificação Obrigatória de Aluno (Nome e Matrícula)

> **Categoria:** Autenticação e Acesso  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O aluno deve fornecer obrigatoriamente seu Nome Completo e Matrícula antes de ingressar na sala.

---

## 🎯 Justificativa e Impacto

Assegurar que apenas alunos identificados participem da aula e sejam reconhecidos no chat.

---

## 🛠️ Detalhes de Implementação Técnicos

- O formulário de entrada no `apps/web` exige Nome Completo (mín. 3 caracteres) e Matrícula (alfanumérico).
- O endpoint `/auth/student-token` valida o preenchimento antes de gerar o JWT.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
