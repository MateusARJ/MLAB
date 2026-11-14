# Spec: Matrícula Conectada Recusa Nova Entrada

Status: READY
Feature ID: `027-matricula-unica-na-transmissao`
Origem: issue #85. Implementa a ADR 0010, que substitui a ADR 0004 §2.1.C e redefine a RN-04 da
`001-screen-share-core`.

## 1. Objetivo

Impedir que um aluno entre na transmissão com a matrícula de outro aluno que já está assistindo. Quem chega depois é
avisado na tela de entrada e não entra; quem já está na sala continua sem interrupção.

## 2. Contexto

Verificado em 2026-11-13 na `development` @ `1355660`:

- `POST /rooms/{id}/join` (`apps/backend/internal/room/handler.go`, `handleJoin`) valida só o nome e o formato da
  matrícula. `HasStudent` é usado apenas para liberar a reentrada com a sala cheia.
- `inMemoryStore.AddParticipant` (`room/store.go`) troca o participante de mesma matrícula pelo novo.
- `Hub.onRegister` (`signaling/hub.go`) fecha com `4001 Duplicate Session` todo outro aluno com a mesma matrícula.
- O web (`useWebRTCSubscriber.ts`, `Room.tsx`) leva o aluno derrubado à tela de entrada com "Sua sessão foi aberta em
  outra aba ou dispositivo.".

Resultado: qualquer aluno que digite a matrícula de um colega conectado entra e derruba o colega (issue #85).

O F5 mantém o token da aba em `sessionStorage` (`active_room_data`, `App.tsx`) e reconecta com o mesmo
`participant_id`, sem novo `join`. Duplicar a aba copia o `sessionStorage`, então também reusa o token.

## 3. Escopo

### Incluído

- Backend: o `join` recusa a matrícula com WebSocket ativo na sala; o hub recusa o registro de um segundo aluno com a
  mesma matrícula (corrida entre dois `join`).
- Web dos alunos: aviso na tela de entrada nos dois casos.
- RN-04, contratos `room-api.md` e `signaling.md` da 001, espelho em `docs/requirements/`.

### Não incluído

- Remover aluno pelo professor (follow-up citado na ADR 0010).
- Segredo extra por aluno (PIN, cadastro) — ADR 0010, opção C.
- Mudanças no app desktop e em `packages/types`.

## 4. Atores

- **Aluno conectado:** já assiste à transmissão com sua matrícula.
- **Segundo aluno:** tenta entrar com a mesma matrícula, por engano ou de propósito.
- **Professor:** não muda de fluxo.

## 5. User Stories

### US-2701 — Matrícula de quem está assistindo não pode ser usada por outro

Como aluno assistindo à aula, quero que ninguém consiga entrar com a minha matrícula enquanto eu estiver conectado,
para não ser derrubado nem ter minha identidade usada por outra pessoa.

- Dado que estou conectado com `2025116TADS0001`, quando outro aluno tenta entrar com `2025116tads0001`, então ele vê
  "Esta matrícula já está conectada nesta transmissão." na tela de entrada e eu continuo na sala.
- Dado que saí da sala ou minha conexão caiu e o servidor já a encerrou, quando entro de novo com a minha matrícula,
  então entro normalmente.
- Dado que aperto F5 ou minha rede oscila, quando a página reconecta com o meu token, então continuo na sala.

## 6. Requisitos Funcionais

- RF-2701: `POST /rooms/{id}/join` (e `/{sala}/{prof}/join`) responde `409` com
  `{"error": "Esta matrícula já está conectada nesta transmissão."}` quando há, no hub da sala, WebSocket ativo de um
  aluno com a mesma matrícula (sem diferenciar maiúsculas, após trim). Nenhum participante é registrado e nenhum token
  é emitido.
- RF-2702: a verificação do RF-2701 vem antes da verificação de sala cheia (`429`).
- RF-2703: o hub recusa o registro de um aluno quando outro participante (outro `participant_id`) com a mesma matrícula
  já está registrado: fecha a nova conexão com `4002 Student ID In Use`, sem incluí-la na sala e sem avisar os demais
  participantes. A conexão já registrada não é afetada.
- RF-2704: a reconexão do mesmo `participant_id` continua substituindo a conexão anterior dele, que é fechada com
  `4001 Duplicate Session` (comportamento atual).
- RF-2705: a matrícula fica livre assim que o hub desregistra a conexão do aluno (saída, queda detectada ou fechamento).
- RF-2706: o web mostra a mensagem do `409` na tela de entrada (já exibe `error` da resposta) e, ao receber o close
  `4002`, não reconecta e volta à tela de entrada com "Esta matrícula já está conectada nesta transmissão.".

## 7. Requisitos Não Funcionais

- RNF-2701 — segurança: a decisão é do servidor (Princípio II). A UI só exibe a recusa.
- RNF-2702 — concorrência: a consulta do `join` ao hub é segura entre goroutines (o estado do hub continua sendo
  alterado só pela goroutine `run`).
- RNF-2703 — compatibilidade: adições ao contrato (`409` novo, close `4002`); nada é removido nem renomeado.
- RNF-2704 — dependências: nenhuma nova.

## 7.1 Regras de Negócio

- RN-2701 (nova redação da RN-04 da 001, ADR 0010): enquanto houver sessão WebSocket ativa de um aluno com a mesma
  matrícula na sala, uma nova entrada com essa matrícula é recusada e o aluno conectado permanece. A reconexão do
  mesmo participante (mesmo token) encerra a conexão anterior dele com `4001 Duplicate Session`.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| matrícula com WS ativo na sala | `join` | `409` "Esta matrícula já está conectada nesta transmissão." (RF-2701) |
| matrícula registrada, sem WS ativo | `join` | `200`; o participante antigo é trocado no store (comportamento atual) |
| matrícula com WS ativo e sala cheia | `join` | `409` (RF-2702) |
| dois `join` aceitos; o 1º WS já registrado | WS do 2º | close `4002`; o 1º segue (RF-2703) |
| mesmo `participant_id` reconecta | WS novo | conexão anterior fechada com `4001` (RF-2704) |
| web recebe close `4002` | `onclose` | sem reconexão; volta à entrada com a mensagem (RF-2706) |

## 9. Edge Cases

- Aparelho que sai da rede sem fechar o WebSocket: a matrícula fica presa até o servidor detectar a queda (`pongWait`,
  60 s), a menos que o próprio aluno reconecte com o mesmo token (RF-2704).
- Nova aba com novo `join` enquanto a primeira está aberta: recusada (ADR 0010, consequência negativa aceita).
- Quem entra primeiro com a matrícula de outro bloqueia o dono até sair (ADR 0010; follow-up de remoção pelo professor).
- Professor não tem matrícula: a regra só vale entre alunos.
- Matrícula em salas diferentes: cada sala tem seu hub; não há conflito entre salas.

## 10. Dados/Contratos impactados

- `001-screen-share-core/contracts/room-api.md`: erro `409 Student ID in use` no `join`.
- `001-screen-share-core/contracts/signaling.md`: seção de close codes com `4001` e `4002`.
- `001-screen-share-core/spec.md`: RN-04 com a redação da RN-2701.
- `docs/requirements/business-rules/RN004-restricao-de-sessao-unica-por-aluno.md` (espelho).

## 11. Critérios de Sucesso

- Testes Go do hub: segundo aluno com a mesma matrícula (outra caixa) recebe `4002` e não entra em `clients`; o
  primeiro segue aberto; mesmo `participant_id` → `4001`; após o desregistro, a matrícula é aceita de novo;
  `HasConnectedStudent` reflete registro e desregistro.
- Teste Go do `join`: `409` com a mensagem quando a matrícula está conectada, inclusive com a sala cheia; `200` quando
  só está registrada.
- Smoke A19 (`cmd/server`): segundo `join` com WS do primeiro aberto → `409`, e o primeiro WS segue aberto; mesmo token
  → `4001`.
- Testes web: close `4002` → estado sem reconexão; `Room` chama `onLeave` com a mensagem; `Join` mostra a mensagem do
  `409`.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-2701 a C-2705).
