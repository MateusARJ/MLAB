# ⚡ RF019 — Backoff Exponencial na Reconexão do Aluno

> **Categoria:** Resiliência  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

Perda de conexão do aluno é tratada com tentativas automáticas de reconexão usando algoritmo de backoff exponencial.

---

## 🎯 Justificativa e Impacto

Reestabelecer o acesso do aluno em falhas transitórias de rede sem sobrecarregar o servidor com requisições simultâneas.

---

## 🛠️ Detalhes de Implementação Técnicos

- Intervalos de tentativas: `1s -> 2s -> 4s -> 8s -> 16s -> máx 30s`.
- O aluno reconecta com o mesmo JWT se este ainda estiver dentro do período de validade.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
