#  RF003 — Perfil Estritamente Espectador dos Alunos

> **Categoria:** Transmissão de Mídia
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

Os alunos possuem permissão apenas de espectador — sem publicação de câmera, microfone ou tela.

---

##  Justificativa e Impacto

Preservar a banda e o processamento do servidor SFU para distribuição unidirecional em massa.

---

##  Detalhes de Implementação Técnicos

- O frontend do aluno (`apps/web`) não instancia nem solicita permissões de `getUserMedia` ou `getDisplayMedia`.
- O SFU Pion não aloca leitores de entrada (Inbound Tracks) para tokens com papel de aluno.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
