#  RN014 — Estratégia de Backoff do Aluno

> **Categoria:** Resiliência
> **Status:**  Ativa

---

##  Regra de Negócio

O cliente web do aluno deve tentar reconectar em caso de queda de rede usando a escala de tempo `1s, 2s, 4s, 8s, 16s, 30s`.

---

##  Impacto no Negócio / Operação

Evita o disparo simultâneo de requisições e tempestade de reconexões no backend (Thundering Herd Problem).

---

##  Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
