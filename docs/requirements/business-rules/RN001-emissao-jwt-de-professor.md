# ⚖️ RN001 — Emissão JWT de Professor

> **Categoria:** Autenticação  
> **Status:** 🟢 Ativa  

---

## 📌 Regra de Negócio

O JWT de professor (`role: professor`) é emitido somente após validação de e-mail e senha com hash bcrypt (custo >= 10), tendo validade estrita de 8 horas.

---

## 💥 Impacto no Negócio / Operação

Protege a criação e administração de salas contra acesso não autorizado.

---

## 🔗 Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
