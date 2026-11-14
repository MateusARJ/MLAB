# Analyze: Matrícula Conectada Recusa Nova Entrada

Feature: `027-matricula-unica-na-transmissao`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma.

- Spec, clarify (C-2701 a C-2705), plan e a ADR 0010 concordam:
  - a matrícula com WebSocket ativo recusa a nova entrada (`409` no `join`, `4002` no hub);
  - o mesmo participante segue reconectando com `4001`;
  - a matrícula é liberada no desregistro;
  - versão MINOR.
- A RN-04 da 001 ainda tem a redação antiga; a T2701 a corrige antes de qualquer código (AGENTS §11). O item da
  `001/tasks.md` que cita a RN-04 antiga é histórico e fica como está; o converge registra a mudança.
- A 005 (RF-501/RF-502) implementou "a última vence" por exigência da RN-04 antiga. O `4001` do mesmo participante e o
  tratamento no web seguem válidos; o laço por matrícula do `onRegister` é substituído. O store da 005 não muda.
- `room-api.md` lista `409 Room closed`, mas o código responde `404` para sala encerrada. É divergência anterior a esta
  feature (desvio, AGENTS §14), sem impacto no `409` novo, que tem mensagem própria.
- A faixa `270x` não colide: busca por `RF-270`, `C-270` e `T270` em `spec-kit/` e `docs/` só acha esta feature.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2701 | T2701 (contrato), T2703 |
| RF-2702 | T2703 |
| RF-2703 | T2701 (contrato), T2702 |
| RF-2704 | T2702, T2703 (smoke) |
| RF-2705 | T2702 |
| RF-2706 | T2704 |
| RNF-2701 | T2702, T2703 (decisão no servidor) |
| RNF-2702 | T2702 (mutex próprio; `go test -race` se disponível) |
| RNF-2703 | T2701 |
| RNF-2704 | todas: nenhuma dependência nova |
| RN-2701 | T2701, T2702, T2703 |

## 3. Contratos

- `001/contracts/room-api.md`: `409` novo no `join` (T2701).
- `001/contracts/signaling.md`: close codes `4001` e `4002` (T2701).
- `packages/types` e app desktop: sem mudança.

## 4. Tarefas fora do Scope Lock

Nenhuma. A T2701 toca só documentos; a T2702 só o pacote `signaling`; a T2703 só `room/handler.go`, `main.go`, testes e
o rótulo do smoke; a T2704 só o hook, o `Room` e testes; a T2705 só mexe em `package.json` via `npm run bump`.

## 5. Riscos

- WS zumbi prende a matrícula até 60 s: aceito na ADR 0010, mitigado pela reconexão com o mesmo token.
- Quem entra primeiro com a matrícula alheia bloqueia o dono: aceito na ADR 0010; follow-up de remoção pelo professor.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T2701.
