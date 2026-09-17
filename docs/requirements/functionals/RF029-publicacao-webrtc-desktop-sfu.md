# RF029 — Publicação WebRTC Ativa do Desktop via SFU Pion

> **Categoria:** Transmissão de Mídia
> **Prioridade:** Alta
> **Status:** Aprovado

---

## Descrição

O aplicativo desktop do professor deve orquestrar o ciclo de vida completo de publicação WebRTC para a SFU Pion Go, transmitindo os pacotes RTP de tela e microfone aos alunos conectados via web.

---

## Justificativa e Impacto

Sem a negociação SDP e publicação WebRTC no desktop, os alunos não recebem os fluxos de mídia transmitidos pelo professor.

---

## Detalhes Técnicos

- Conexão ao WebSocket `/ws/signaling?token=...`.
- Emissão de `publish-request`, recebimento de `publish-approved`.
- Criação de `RTCPeerConnection`, geração e envio de `offer` SDP.
- Recebimento de `answer` da SFU, troca de candidatos ICE e gerenciamento de reconexão.
