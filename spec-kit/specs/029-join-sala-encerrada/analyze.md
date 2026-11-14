# Analyze: Join em Sala Encerrada Responde 409

Feature: `029-join-sala-encerrada`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-2901 a C-2903) e plan concordam: o código volta ao `409` da RN-08, com a mesma mensagem e a mesma
  ordem de verificações; `404` só para sala inexistente; versão PATCH.
- RN-08, `001/contracts/room-api.md` e o espelho `RN008` já dizem `409`: nada upstream muda.
- `001/converge.md` declara cobertura da RN-08 por `room_test.go` sem teste correspondente; a T2903 corrige a
  evidência depois que a T2901 cria o teste.
- Fora do escopo, registrados como desvio: encerramento só pelo hub (timeout/`end-session`) deixa a sala ativa no store,
  e o `/info` responde `404` para sala encerrada enquanto o contrato lista `closed` no `200`.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2901 | T2901, T2902 |
| RF-2902 | T2901 |
| RF-2903 | T2901 |
| RNF-2901 | T2902 (mensagem mantida) |
| RNF-2902 | todas: nenhuma dependência nova |

## 3. Contratos

- Nenhuma mudança. `room-api.md` já define `409 Room closed`.

## 4. Tarefas fora do Scope Lock

Nenhuma. T2901 e T2902 tocam só `room/handler.go` e `room_test.go`; a T2903 só documentos e `package.json` via
`npm run bump`.

## 5. Riscos

- Consumidor que dependesse do `404`: não há (web e E2E usam o texto do `error`).

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T2901.
