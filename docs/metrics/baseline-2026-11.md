# Baseline de Regressão — Novembro/2026

Referência: plano `spec-kit/docs/plano-remediacao-speckit-seguranca.md`, fase F0.
Commit base: `4f3caad` (versão 1.5.7), branch `master`.
Data: 2026-11-01. Ambiente: Windows 11, Go 1.27.0, Node 24.16.0.

## F0.1 — Testes automatizados (sem cache)

| Suíte | Comando | Resultado |
|---|---|---|
| Backend Go | `go test -count=1 ./...` | 6/6 pacotes OK (`cmd/server`, `auth`, `chat`, `room`, `signaling`, `webrtc`) |
| Web (alunos) | `turbo run test --force` | 3 arquivos, 25 testes OK |
| Desktop (professor) | `turbo run test --force` | 11 arquivos, 82 testes OK |
| Monorepo | `turbo run test --force` | 5/5 tasks OK |

## F0.2 — Build

| Alvo | Comando | Resultado |
|---|---|---|
| Monorepo | `turbo run build --force` | 5/5 tasks OK |
| Instalador Windows | `npm run make:win` | **NÃO EXECUTADO pelo agente** — deve ser rodado pelo responsável junto da matriz de smoke |

## F0.3 — Matriz de Smoke (Anexo A do plano)

Status: **PENDENTE — execução manual**. A matriz exige GUI, dois computadores na LAN e um celular,
o que não é possível ao agente. O responsável deve preencher a tabela abaixo com o build atual
**antes** de aprovar o merge da branch `fix/security-hardening`.

| # | Resultado baseline | Observação |
|---|---|---|
| A0 | | comportamento antigo: `/auth/login` responde (400/401) |
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |
| A5 | | |
| A6 | | |
| A7 | | |
| A8 | | |
| A9 | | |
| A10 | | |
| A11 | | |
| A12 | | |
| A13 | | |
| A14 | | |
| A15 | | |
| A16 | | |
| A17 | | |
| A18 | | |
| A19 | | |
| A20 | | |
