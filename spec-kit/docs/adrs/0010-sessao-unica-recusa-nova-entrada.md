# ADR 0010 — Sessão única por aluno: a matrícula conectada recusa a nova entrada

Status: APROVADA
Data: 2026-11-13
Feature impactada: `027-matricula-unica-na-transmissao` (issue #85); substitui a ADR 0004 §2.1.C
Numeração: 0010 porque a 0008 está reservada pela edição HTTPS (`edicao/https-lan`), que não vai para a `development`.

## Contexto

A ADR 0004 §2.1.C definiu a sessão única por aluno assim: "a tentativa de conexão de uma segunda sessão WebSocket com
a mesma Matrícula e `room_id` desconecta sumariamente a sessão anterior com o código `4001 Duplicate Session`". A RN-04
da `001-screen-share-core` repete a regra, e a feature `005-correcoes-smoke` (#18) a implementou:

- `POST /rooms/{id}/join` (`apps/backend/internal/room/handler.go`) só valida o formato da matrícula e emite o token;
- o store (`room/store.go`, `AddParticipant`) troca o participante de mesma matrícula pelo novo;
- o hub (`signaling/hub.go`, `onRegister`) fecha com `4001` todo outro aluno com a mesma matrícula.

A matrícula não é segredo: aparece na lista de participantes do professor e é conhecida pelos colegas.

## Problema

Qualquer aluno que digite a matrícula de um colega já conectado entra na aula **e derruba o colega**, que volta à tela
de entrada com "Sua sessão foi aberta em outra aba ou dispositivo.". A regra que deveria evitar acesso duplicado vira
um jeito de expulsar e se passar por outro aluno.

## Opções consideradas

### Opção A — Manter "a última entrada vence" (ADR 0004 §2.1.C)

- Sem mudança de código ou contrato.
- Mantém o problema: a identidade de quem está na sala é de quem digitou por último.

### Opção B — Recusar a nova entrada enquanto a matrícula estiver conectada

- Enquanto houver WebSocket ativo de um aluno com a mesma matrícula (sem diferenciar maiúsculas) na sala, um novo
  `join` com essa matrícula é recusado com `409` e mensagem clara; quem já está na sala não é afetado.
- Se dois `join` passarem quase juntos, o hub recusa o segundo WebSocket com o close code novo `4002`.
- "Conectada" é WebSocket ativo no hub, não registro no store: quem saiu ou caiu libera a matrícula.
- A reconexão do **mesmo** participante (mesmo token, ex.: queda de rede ou F5, que guarda o token na aba) continua
  permitida e mantém o `4001` para a conexão antiga desse participante.

### Opção C — Exigir segredo extra do aluno (PIN, código por aluno)

- Resolve também quem entra primeiro com a matrícula alheia.
- Muda o fluxo de entrada (Nome + Matrícula, ADR 0006/C-504), exige cadastro prévio, o que contradiz a operação sem
  banco de dados (ADR 0005). Fora de proporção para o problema.

## Decisão

**Opção B.** Esta ADR substitui a ADR 0004 §2.1.C:

> **Sessão Única por Aluno:** enquanto houver sessão WebSocket ativa de um aluno com a mesma matrícula na sala, uma
> nova entrada com essa matrícula é recusada (`409` no `join`; close `4002 Student ID In Use` se a corrida chegar ao
> WebSocket) e o aluno já conectado permanece. A reconexão do mesmo participante (mesmo token) continua permitida e
> encerra a conexão anterior dele com `4001 Duplicate Session`.

O teste de segurança correspondente (ADR 0004, "Testes de Sessão Única") passa a esperar que a segunda sessão com a
mesma matrícula seja recusada e que a primeira continue aberta.

## Consequências

### Positivas

- Um aluno não consegue mais derrubar um colega nem assumir a matrícula de quem está assistindo.
- O aviso aparece na tela de entrada, antes de o aluno entrar na sala.

### Negativas

- Quem entrar **primeiro** com a matrícula de outro bloqueia o dono até sair. Hoje o professor não tem como remover um
  aluno; fica como follow-up em issue própria.
- Abrir a aula numa segunda aba com nova entrada passa a ser recusado enquanto a primeira estiver aberta (o F5 e a
  duplicação de aba seguem funcionando, pois reaproveitam o token).
- Se o aparelho do aluno some da rede sem fechar o WebSocket, a matrícula fica presa até o servidor detectar a queda
  (até 60 s, `pongWait`), salvo se o próprio aluno reconectar com o mesmo token.

## Impacto em specs/contracts/tasks

- `spec-kit/docs/adrs/0004-arquitetura-de-seguranca-e-testes-de-seguranca.md`: nota em §2.1.C e no teste de sessão
  única apontando para esta ADR.
- `spec-kit/specs/001-screen-share-core/spec.md`: RN-04 com a nova redação.
- `spec-kit/specs/001-screen-share-core/contracts/room-api.md`: `409 Student ID in use` no `join`.
- `spec-kit/specs/001-screen-share-core/contracts/signaling.md`: close codes `4001` e `4002`.
- `docs/requirements/business-rules/RN004-restricao-de-sessao-unica-por-aluno.md` (espelho).
- `AGENTS.md` §9: incluir esta ADR na lista de ADRs aprovadas.
- Nova feature `spec-kit/specs/027-matricula-unica-na-transmissao/`: backend (`room`, `signaling`, `cmd/server`) e web
  dos alunos (tela de entrada e hook de sinalização).
- Versão: MINOR (`docs/versionamento.md` §2): adição compatível em contrato (`409` novo no `join`, close `4002`), sem
  remover campo, rota ou evento.

## Aprovação humana

- Responsável: MateusARJ
- Data: 2026-11-13
