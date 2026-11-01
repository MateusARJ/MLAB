#  RN001 — Emissão JWT de Professor

> **Categoria:** Autenticação
> **Status:**  Ativa (reescrita em 2026-11-01 — ADR 0006)

---

##  Regra de Negócio

O JWT de professor (`role: professor`) é emitido somente quando a requisição a `POST /auth/session` apresenta o
header `X-MLab-Host-Key` igual à chave de host da execução atual (comparação em tempo constante). A validade é de
8 horas. Sem chave de host configurada no backend, nenhuma sessão de professor é emitida. Não existe login por
e-mail e senha.

---

##  Impacto no Negócio / Operação

Protege a criação e administração de salas contra acesso não autorizado sem exigir cadastro de professores.

---

##  Relação com Requisitos Funcionais

- **Requisito:** [RF012](../functionals/RF012-autenticacao-de-professor-no-app-desktop.md)
- **Documento Principal:** [requirements.md](../../requirements.md)
