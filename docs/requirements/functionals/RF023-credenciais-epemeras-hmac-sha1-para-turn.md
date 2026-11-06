#  RF023 — Credenciais Epêmeras HMAC-SHA1 para TURN

> **Categoria:** Segurança & Rede
> **Prioridade:** Baixa (TURN é opcional — ADR 0005)
> **Status:**  Aprovado (atualizado em 2026-11-06 — ADR 0005)

---

##  Descrição

Quando o TURN estiver habilitado (opcional, para uso fora da rede local), o servidor gera credenciais temporárias
do TURN baseadas em HMAC-SHA1 para atravessar NATs restritivos. Na rede local, modo primário do MLab, não há TURN.

---

##  Justificativa e Impacto

Evitar o vazamento de segredos permanentes da infraestrutura de relay no código dos clientes.

---

##  Detalhes de Implementação Técnicos

- Habilitado por `TURN_URL` e `TURN_SECRET` no backend; sem essas variáveis, nenhuma credencial TURN é emitida.
- O endpoint de sinalização/ICE gera `username = timestamp:userID` e `credential = base64(HMAC-SHA1(TURN_SECRET, username))`,
  com validade máxima de 24 horas (RN011).

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Spec:** RF-23 em `spec-kit/specs/001-screen-share-core/spec.md`
- **Regra de negócio:** [RN011](../business-rules/RN011-validade-maxima-de-credenciais-turn.md)
- **Decisão:** ADR 0005 — Operação LAN offline, TURN opcional
- **Documento Principal:** [requirements.md](../../requirements.md)
