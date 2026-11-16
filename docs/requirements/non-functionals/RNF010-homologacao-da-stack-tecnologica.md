#  RNF010 — Homologação da Stack Tecnológica

> **Categoria:** Manutenibilidade
> **Meta / Alvo:** `Go 1.22+, Pion, Electron, React`
> **Status:**  Aprovado (reescrito em 2026-11-06 — ADR 0005)

---

##  Descrição do Requisito

O backend usa Go 1.22+ com Pion WebRTC; o app do professor usa Electron + React com TypeScript; o web app dos alunos
usa React com TypeScript (Vite). O estado fica em memória durante a execução do backend embarcado: o MLab não tem
banco de dados (ADR 0005).

---

##  Justificativa e Critério de Medição

Manter a interoperabilidade, alto desempenho de concorrência e simplicidade na manutenção da base de código. Sem
banco de dados, o app opera offline na rede local sem infraestrutura externa. Persistência só entra com nova spec e
nova ADR.

---

##  Relação com o Sistema

- **Spec:** RNF-10 em `spec-kit/specs/001-screen-share-core/spec.md`
- **Decisão:** ADR 0005 — Operação LAN offline
- **Documento Principal:** [requirements.md](../../requirements.md)
