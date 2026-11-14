# Converge: Matrícula Conectada Recusa Nova Entrada

Feature: `027-matricula-unica-na-transmissao`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-13
Commits avaliados: `e01ccc8` (ADR 0010), `f90280f` (artefatos), `0f067ac` (T2701), `8c12a4e` (T2702),
`bb6f20a` (T2703), `88a73e5` (T2704)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2701 a C-2705), `plan.md`, `tasks.md` (T2701 a T2705), ADR 0010
- contratos: `001/contracts/room-api.md` (`409 Student ID in use`), `001/contracts/signaling.md` (close codes)
- código: `signaling/client.go`, `signaling/hub.go`, `signaling/handler.go`, `room/handler.go`, `cmd/server/main.go`;
  `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/pages/Room.tsx`
- suítes:
  - `go vet ./...` e `go test -count=1 ./...` em `apps/backend`: todos os pacotes verdes;
  - `go vet -tags smoke ./cmd/server/` e `go test -tags smoke -run TestSmoke ./cmd/server/`: verde (A19 incluído);
  - `gofmt -l` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho);
  - `npm run test -w apps/web`: 5 arquivos, 54 testes verdes; `npm run lint`: 5 de 5.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2701 | `room/handler.go` (`handleJoin` + `SetStudentConnectedChecker`); `TestJoinMatriculaConectada` (409, mensagem, nenhum participante registrado); smoke `A19_sessao_unica_por_aluno` (409 com o WS do primeiro aberto) |
| RF-2702 | `TestJoinMatriculaConectada` (sala com `MaxParticipants: 1` cheia → 409, não 429) |
| RF-2703 | `hub.go` (`onRegister`); `TestHub_SessaoUnica_MesmaMatriculaRecusaNovaCom4002` (4002, fora de `clients`, primeiro aberto, unregister da recusada não libera a matrícula) |
| RF-2704 | `TestHub_SessaoUnica_MesmoParticipanteFechaAnteriorCom4001`; smoke A19 (mesmo token → 4001) |
| RF-2705 | `TestHub_SessaoUnica_MatriculaLiberadaAoSair`; `TestHub_SessaoUnica_EncerramentoLiberaMatriculas`; `TestJoinMatriculaConectada` passo 3 |
| RF-2706 | hook: teste "deve ir para student-id-in-use sem reconectar ao receber close 4002"; `Room.test.tsx` (onLeave com a mensagem); `Join.test.tsx` (mensagem do 409) |
| RNF-2701 | recusa decidida no `join` e no hub; a UI só exibe |
| RNF-2702 | `connectedStudents` com `sync.RWMutex` próprio; `clients` segue exclusivo da goroutine `run` |
| RNF-2703 | só adições: `409` novo e close `4002`; nenhum campo, rota ou evento removido |
| RNF-2704 | nenhuma dependência nova |
| RN-2701 | RN-04 da 001 e espelho `RN004` (T2701); testes acima |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| `409 Room closed` no `join` (anterior à 027) | `409` | `404` | issue #86 (desvio, não bloqueante) |

- `001/tasks.md` (item da RN-04 com `4001`) e `005/plan.md` (risco "matrícula compartilhada derruba outro aluno") são
  registros históricos das features 001 e 005 e ficam como estão; a regra vigente é a RN-04 reescrita e a ADR 0010.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| Encerrar a sala (professor ou timeout) zera o mapa de matrículas | `hub.go` (`onRoomClose`, `onPublisherTimeout`) | consequência do RF-2705: o encerramento já zera `clients` sem passar pelo `onUnregister` |
| Rótulo do item A19 no relatório de smoke | `scripts/smoke-report.js` | acompanha o novo A19 (T2703) |

## 5. Testes faltantes

- E2E do aluno (`apps/web/e2e`, Playwright) não foi executado nesta feature. Os testes usam a mesma matrícula em
  sequência; cada um abre página nova e a anterior fecha o WebSocket ao terminar, o que libera a matrícula (RF-2705).
  Se a página anterior não fechar a tempo, o `join` seguinte receberia `409`. Rodar `npm run e2e` antes do merge.
- Verificação manual na LAN (dois navegadores com a mesma matrícula) fica no plano de teste do PR.

## 6. Novas tasks necessárias

- Nenhuma na 027. Follow-up fora do escopo (ADR 0010): remoção de aluno pelo professor.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #86 | `documentation`, `desvio`, `area:spec-kit` | não | contrato do `join` diz `409` para sala encerrada; código responde `404` |
| #87 | `bug`, `desvio`, `area:backend` | não | `TestMDNSNaoDisputaNomeDeOutroBackend` falhou uma vez pelo limite de 1,5 s; passou ao repetir e sem as mudanças |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.15.0 | Adição compatível em contrato (`409 Student ID in use` no `join`, close `4002`), escolhida pelo responsável (C-2705). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — a matrícula com WebSocket ativo recusa a nova entrada (`409` no `join`, `4002` na corrida), o aluno
  conectado permanece, a reconexão do mesmo token segue com `4001` e o web avisa o aluno recusado.
