#  RF012 — Sessão do Professor no App Desktop

> **Categoria:** Autenticação e Acesso
> **Prioridade:** Alta
> **Status:**  Aprovado (reescrito em 2026-11-01 — ADR 0006)

---

##  Descrição

O professor inicia a sessão no aplicativo desktop informando apenas o nome. Não existe conta, e-mail, senha ou
login. O token de professor (JWT, 8h) só é emitido quando a requisição apresenta a chave de host gerada pelo app
naquela execução.

---

##  Justificativa e Impacto

O app roda na máquina do professor e opera offline na rede local (ADR 0005). A posse do computador que executa o
app identifica o professor, sem cadastro central. A chave de host impede que alunos na rede, no túnel ngrok ou no
proxy de desenvolvimento obtenham um token de professor.

---

##  Detalhes de Implementação Técnicos

- `POST /auth/session` com body `{ "name": "..." }` e header `X-MLab-Host-Key`.
- A chave (`MLAB_HOST_KEY`) é gerada pelo processo principal do Electron a cada execução e entregue ao backend
  (variável de ambiente) e ao renderer (IPC `get-host-key`).
- O token fica no armazenamento de sessão do renderer.
- Contrato: `spec-kit/specs/001-screen-share-core/contracts/auth.md`.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Regra de negócio:** [RN001](../business-rules/RN001-emissao-jwt-de-professor.md)
- **Decisão:** ADR 0006 — Descontinuação do login e sessão local do professor
- **Documento Principal:** [requirements.md](../../requirements.md)
