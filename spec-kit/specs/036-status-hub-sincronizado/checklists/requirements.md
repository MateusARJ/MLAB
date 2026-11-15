# Checklist de Requisitos: Leitura Sincronizada do Status do Hub

Feature: `036-status-hub-sincronizado`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3601, RNF-3601 a RNF-3603) tem task.
- [x] Ambiguidades fechadas (C-3601 a C-3604): mecanismo, janela TOCTOU, onde roda o `-race`, versão.
- [x] Evidência registrada: `signaling/handler.go` (`getOrCreateHub`), `signaling/hub.go` (três pontos de escrita),
  `build-all.yml`, na `development` @ `82e2fa0` (issue #102).
- [x] Edge case coberto: leitura concorrente ao encerramento.

## Coerência

- [x] RN-13 e RF-18 da 001 não mudam; nenhum contrato muda (AGENTS §11).
- [x] A feature não altera o caminho do `closed` da 033 nem o aviso de status da 035.
- [x] Sem dependência nova; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `360x` não colidem (busca por `RF-36`, `C-36`, `T36` sem resultado).

## Viabilidade

- [x] As escritas do status estão em três pontos da goroutine `run()`; um helper cobre todos.
- [x] O padrão `studentsMu` já existe no mesmo struct.
- [x] O runner `ubuntu-latest` tem gcc; o `setup-go` não desliga o cgo.

## Resultado

APPROVED
