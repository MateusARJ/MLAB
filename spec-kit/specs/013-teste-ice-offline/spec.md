# Spec: Teste do Join Independente da Rede

Status: READY
Feature ID: `013-teste-ice-offline`
Origem: issue #35 (desvio registrado durante a `008-dev-entrada-unica-web`): `TestJoinRoomBySlug` falha em máquina
sem acesso à internet com "esperava IceServers configurados".

## 1. Objetivo

Tornar determinísticos os testes do ingresso do aluno (`POST /rooms/{sala}/{professor}/join`) quanto à lista
`ice_servers`. Hoje o resultado de `TestJoinRoomBySlug` depende da rede da máquina que roda o teste, e não do código.
O comportamento de produção está correto e não muda.

## 2. Contexto

A resposta do join (`apps/backend/internal/room/handler.go`) monta `ice_servers` assim:

1. `STUN_URL` definida → `[{"urls": ["<STUN_URL>"]}]`;
2. senão, `IsInternetAvailable()` verdadeiro → `[{"urls": ["stun:stun.l.google.com:19302"]}]`;
3. senão → `[]` (LAN offline, ADR 0005).

`TestJoinRoomBySlug` não define `STUN_URL` e exige lista não vazia, então só passa quando a máquina alcança
`1.1.1.1:53` ou `8.8.8.8:53`. Nenhum teste cobre os ramos 2 e 3 de forma controlada.

## 3. Escopo

### Incluído

- testes do join em `apps/backend/internal/room/room_test.go`, sem acesso à rede;
- cobertura dos três ramos de `ice_servers` descritos na seção 2.

### Não incluído

- qualquer mudança no código de produção (`handler.go`, `network.go`);
- `apps/backend/internal/signaling` (`buildIceServers` tem a mesma regra, mas seus testes não verificam ICE e não
  falham hoje);
- `TestIsInternetAvailable` (`network_test.go`), que só registra o estado da rede e não faz asserção.

## 4. Requisitos

- RF-131: os testes do join não dependem de acesso à internet nem de `STUN_URL` no ambiente: o mesmo resultado com e
  sem rede.
- RF-132: há teste para cada ramo de `ice_servers`: `STUN_URL` configurada (mesmo sem internet), sem `STUN_URL` com
  internet (STUN público padrão) e sem `STUN_URL` sem internet (lista vazia, serializada como `[]`, ADR 0005).
- RNF-131: sem dependência nova e sem mudança de comportamento; a suíte do pacote não fica mais lenta (o teste não
  abre conexão de rede para checar a internet).

## 5. Critérios de Sucesso

- `go test -count=1 ./...` em `apps/backend` verde numa máquina sem acesso à internet (onde hoje
  `TestJoinRoomBySlug` falha) e numa máquina com internet.
- `npm run spec:check` com PASS para `013-teste-ice-offline`.
