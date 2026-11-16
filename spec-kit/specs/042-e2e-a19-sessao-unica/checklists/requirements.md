# Checklist de Requisitos: E2E A19 com a Recusa da Matrícula Já Conectada

Feature: `042-e2e-a19-sessao-unica`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4201 a RF-4203, RNF-4201 a RNF-4203) tem task.
- [x] Ambiguidades fechadas (C-4201 e C-4202): sinal de registro, entrega e versão.
- [x] Evidência registrada: `room/handler.go` (`handleJoin`, `409`), `signaling/hub.go` (`HasConnectedStudent`,
  `participant-joined`), `Join.test.tsx` (aviso do `409`), `e2e/fixtures.ts` (`joinAsStudent`, `waitFor`).
- [x] Edge case de tempo coberto (RF-4201).

## Coerência

- [x] A 027 (RF-2701, RF-2702) e a ADR 0010 não mudam; o teste passa a verificá-las.
- [x] Nenhum contrato muda; sem incremento, coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `420x` não colidem (busca por `RF-42`, `C-42`, `T42` sem resultado).

## Viabilidade

- [x] O fixture `prof` já expõe `waitFor`; o payload `participant-joined` já tem `student_id`.

## Resultado

APPROVED
