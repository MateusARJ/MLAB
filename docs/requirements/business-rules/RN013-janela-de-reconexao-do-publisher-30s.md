# ⚖️ RN013 — Janela de Reconexão do Publisher (30s)

> **Categoria:** Resiliência  
> **Status:** 🟢 Ativa  

---

## 📌 Regra de Negócio

Em caso de desconexão acidental do professor, o servidor aguarda até 30 segundos antes de encerrar a sala. Se o professor voltar dentro desse prazo, a transmissão é retomada.

---

## 💥 Impacto no Negócio / Operação

Evita a perda desnecessária da sessão da aula por pequenas oscilações de conexão do docente.

---

## 🔗 Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
