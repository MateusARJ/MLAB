# Clarify: Nome do Módulo Go do Backend

Feature: `016-modulo-go-mlab`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-10, com o plano de correção das issues #41, #42 e #43.

## C-161 — Novo caminho do módulo

- **Alternativas:** (A) `github.com/MateusARJ/MLAB/apps/backend`, o caminho canônico de um submódulo Go no
  repositório real; (B) `mlab/backend`, mais curto, mas sem resolução por `go get`.
- **Resposta aprovada:** **A**.

## C-162 — Registros históricos

- **Contexto:** `docs/metrics/smoke-backend.jsonl` cita o nome antigo em 76 linhas (saída de `go test -json` de
  execuções passadas).
- **Resposta aprovada:** não muda; é evidência histórica de medição, não código.

## C-163 — Impacto de versão

- **Resposta aprovada:** PATCH. É refatoração sem mudança de capacidade nem de contrato (`docs/versionamento.md` §2),
  mas muda o binário do backend embarcado (os caminhos dos pacotes ficam nos símbolos), logo muda o instalador.

## Resultado

CLOSED — C-161 a C-163 respondidas; nenhuma ambiguidade em aberto.
