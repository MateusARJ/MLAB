#  RN006 — Geração de Slug Legível e Único

> **Categoria:** Gestão de Sala
> **Status:**  Ativa (reescrita em 2026-11-06 para refletir a spec 001)

---

##  Regra de Negócio

O identificador público de cada sala é legível e tem o formato `{titulo-da-sala}/{nome-do-professor}`, derivado do
título informado na criação da sala e do nome com que o professor entrou no app (ex.: `matematica/maria`). Criar uma
nova sala encerra a sala anterior do mesmo professor (RN-06, T032).

---

##  Impacto no Negócio / Operação

Facilita a leitura e digitação do link da sala por humanos.

---

##  Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
