#  RF011 — Identificação Obrigatória de Aluno (Nome e Matrícula)

> **Categoria:** Autenticação e Acesso
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

O aluno deve fornecer obrigatoriamente seu Nome Completo e Matrícula antes de ingressar na sala.

---

##  Justificativa e Impacto

Assegurar que apenas alunos identificados participem da aula e sejam reconhecidos no chat.

---

##  Detalhes de Implementação Técnicos

- O formulário de entrada no `apps/web` exige Nome Completo (mín. 3 caracteres) e Matrícula com exatamente 7 números,
  4 letras da sigla do curso e 4 números (ex.: `2025116TADS0000`), aceita em minúsculas e enviada em maiúsculas
  (`046-formato-matricula`, RF-4601 a RF-4603).
- O backend repete a validação no join (`400`) e grava a matrícula em maiúsculas (RF-4602).
- O endpoint `/auth/student-token` valida o preenchimento antes de gerar o JWT.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
