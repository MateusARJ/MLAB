#  RF005 — Transmissão WebRTC via SFU Pion

> **Categoria:** Arquitetura de Mídia
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

A transmissão deve utilizar a topologia WebRTC via SFU (Selective Forwarding Unit) implementado em Go com Pion WebRTC.

---

##  Justificativa e Impacto

Evitar o envio de múltiplas streams pelo professor (topologia Mesh) e possibilitar o atendimento a 40+ alunos com upload fixo.

---

##  Detalhes de Implementação Técnicos

- O professor publica uma única Upstream Track de vídeo e uma de áudio.
- O SFU replica os pacotes RTP em nível de rede para N conexões Downstream sem recodificação (transcoding).

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
