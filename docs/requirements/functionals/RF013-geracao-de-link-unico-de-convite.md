#  RF013 — Geração de Link Único de Convite

> **Categoria:** Gestão de Sala
> **Prioridade:** Média
> **Status:**  Aprovado

---

##  Descrição

O professor deve poder gerar e copiar um link único de acesso contendo o slug legível da sala.

---

##  Justificativa e Impacto

Facilitar o compartilhamento direto da aula via e-mail, grupos de mensagens ou LMS.

---

##  Detalhes de Implementação Técnicos

- Formato do link: `https://<domain>/sala/<room-slug>/entrar`.
- Botão de atalho "Copiar Link" no painel do professor copia a URL formatada para a área de transferência.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
