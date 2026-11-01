# Checklist de Requisitos: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: APPROVED (revalidada em 2026-11-01 após emendas)

## Completude

- [x] Objetivo está explícito.
- [x] Atores estão definidos (professor via app desktop; aluno via web).
- [x] User stories estão definidas (US-01 a US-10; US-01 reescrita pela ADR 0006).
- [x] Critérios de aceitação estão mensuráveis quando necessário.
- [x] Edge cases estão registrados.
- [x] Autenticação está decidida (C-01 CLOSED — JWT; professor sem login, sessão com chave de host — ADR 0006).
- [x] Limite de participantes está decidido (C-02 CLOSED — 50, configurável).
- [x] SFU está escolhida (C-03 CLOSED — Pion WebRTC).
- [x] TURN está decidido (C-04 superada pela ADR 0005 — opcional fora da LAN).
- [x] Estrutura do repositório está definida (C-05 CLOSED — Turborepo, ADR 0001).
- [x] Framework do app desktop está definido (C-06 CLOSED — Electron, ADR 0002).

## Novos Requisitos

- [x] Áudio do professor incluído no escopo (microfone via app Electron).
- [x] Chat de texto em tempo real incluído no escopo.
- [x] Acesso por link único do professor documentado.
- [x] Identificação do aluno por Nome Completo e Matrícula documentada.
- [x] Responsividade do web app dos alunos documentada (RNF-06).
- [x] Distribuição do app desktop para Windows, macOS e Linux documentada (RNF-07).

## Arquitetura

- [x] P2P mesh foi explicitamente rejeitado para 30+ alunos.
- [x] SFU foi definida como topologia (Pion WebRTC).
- [x] Métricas de WebRTC foram incluídas (bitrate, FPS, RTT, packet loss, first-frame).
- [x] Operação LAN offline com TURN opcional (ADR 0005).
- [x] ADRs 0001 a 0006 aprovadas e documentadas.

## Contratos

- [x] `contracts/auth.md` — READY (sem login; `POST /auth/session` com chave de host).
- [x] `contracts/room-api.md` — READY (rotas reais: slug fixo, info, active).
- [x] `contracts/signaling.md` — READY (inclui mensagens de transmissão; interações na 003).
- [x] `contracts/media-session.md` — READY (fechado em T005).

## Segurança

- [x] JWT server-side definido.
- [x] contextBridge do Electron especificado.
- [x] Aluno não pode publicar mídia.
- [x] Validação de campos no servidor.
- [x] Falhas de segurança conhecidas encaminhadas à `002-security-hardening` (S1–S8).

## Resultado

APPROVED — requisitos revalidados contra as ADRs 0005 e 0006 e a feature 003. Gaps de implementação seguem registrados em `converge.md`.
