# ⚡ RF016 — Formatação de Identificação no Chat

> **Categoria:** Comunicação  
> **Prioridade:** Normal  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

Todas as mensagens enviadas no chat devem exibir claramente o nome completo e o papel (`[Professor]` ou `[Aluno]`) do remetente.

---

## 🎯 Justificativa e Impacto

Evitar personificação de usuários e tornar as conversas transparentes durante as aulas.

---

## 🛠️ Detalhes de Implementação Técnicos

- O backend preenche o payload da mensagem de chat com os dados auditados extraídos do JWT antes de realizar o broadcast.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
