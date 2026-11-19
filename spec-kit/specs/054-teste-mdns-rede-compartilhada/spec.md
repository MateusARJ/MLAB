# Spec: Teste da Sondagem mDNS Isolado da Rede

Status: READY
Feature ID: `054-teste-mdns-rede-compartilhada`
Origem: issue #164, desvio registrado na feature 052. Muda só um teste; não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

`TestLegacyProberDetectaNomeOcupado` passa a dar o mesmo resultado com ou sem outro MLab aberto na mesma rede.

## 2. Contexto

Verificado em 2026-11-19 na `main` @ `2039887` (2.3.0):

- O teste (`apps/backend/internal/room/mdns_probe_test.go`) sobe um responder simulado, que anuncia `mlab.local` com
  192.0.2.10, e outro que anuncia `mlab-2.local` com o IP da máquina. Depois sonda os nomes `mlab.local`,
  `mlab-2.local` e `mlab-3.local` por multicast real.
- O `legacyProber.probe` guarda, para cada nome, o IP de quem respondeu. Com outro MLab aberto na LAN anunciando
  `mlab.local` (192.168.1.78), a resposta real chega antes e o teste falha:
  `mlab.local deveria estar ocupado por 192.0.2.10, obteve 192.168.1.78`. Falhou 3 de 3 vezes com Go 1.26.0 e também
  com Go 1.26.11.
- O `probe` recebe a lista de nomes como parâmetro e não depende de prefixo; o comportamento coberto pelo teste
  (RF-121 e RNF-121 da 012) não depende de o nome ser `mlab.local`.

## 3. Escopo

### Incluído

- Nomes do `TestLegacyProberDetectaNomeOcupado`.

### Não incluído

- Os demais testes de mDNS (`ClaimMDNSName` usa `mlab.local` fixo de propósito; passaram com outro MLab na rede).
- Código de produção do mDNS.

## 4. Atores

- **Mantenedor**: roda `go test ./...` numa rede com outros MLab abertos.

## 5. User Stories

### US-5401 — Teste estável em rede compartilhada

Como mantenedor, quero que o teste da sondagem não dependa de quem está na rede.

- Dado outro MLab anunciando `mlab.local` na LAN, quando rodo o teste, então ele passa.
- Dado uma rede sem MLab, quando rodo o teste, então ele continua cobrindo nome ocupado, nome próprio e nome livre.

## 6. Requisitos Funcionais

- RF-5401: o teste sonda nomes únicos por execução, no formato `mlab-teste-<8 hex>.local`, `-2` e `-3`, gerados
  aleatoriamente, e os responders simulados anunciam esses mesmos nomes.
- RF-5402: as asserções seguem iguais: o 1º nome ocupado pelo IP alheio, o 2º (anunciado com o próprio IP) livre, o
  3º livre, e a sondagem em até 1,5 s (RNF-121).

## 7. Requisitos Não Funcionais

- RNF-5401 — dependências: nenhuma nova.
- RNF-5402 — regressão: `go vet ./...` e `go test ./...` em `apps/backend` verdes, inclusive com outro MLab na LAN.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| outro MLab na LAN | o teste passa (ninguém anuncia os nomes únicos) |
| rede sem multicast | `Skip`, como hoje |

## 9. Edge Cases

- Duas execuções simultâneas na mesma rede: os nomes aleatórios não colidem na prática (32 bits).

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `go test ./internal/room -run TestLegacyProberDetectaNomeOcupado -count=5` verde nesta máquina, com o MLab do
  professor (192.168.1.78) anunciando `mlab.local`.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-5401 e C-5402).
