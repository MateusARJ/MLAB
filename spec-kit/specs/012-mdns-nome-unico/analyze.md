# Analyze: Nome mDNS Único por Professor

Feature: `012-mdns-nome-unico`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify (C-121 a C-127) e plan concordam: sondagem própria por consulta legacy, 20 candidatos, um
único nome anunciado, desempate pelo IPv4 menor, links sem `.local` quando não há anúncio e polling de 10 s no
desktop. A faixa de IDs `12x` não colide com a 010 (`T101`–`T104`, `RF-101`–`RF-103`); a 011 (edição HTTPS, fora da
`development`) usa `T11xx`.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-121 | T121, T122, T123 |
| RF-122 | T121, T122, T123 |
| RF-123 | T125 |
| RF-124 | T123 |
| RF-125 | T122 (`yieldsName`), T124 |
| RF-126 | T123, T125 |
| RF-127 | T126 |
| RF-128 | T126 |
| RNF-121 | T123 (tempo do claim) |
| RNF-122 | T122–T124 (sem mudança em `go.mod`, proibido nas tasks) |
| RNF-123 | T125 |
| RN-121, RN-122 | T125, T126 |

## 3. Contratos

`001/contracts/room-api.md`: só a descrição de `mdns_link` (host anunciado, `mlab.local`/`mlab-N.local`, ausente sem
anúncio) e de `link` (cai para o IP sem anúncio). Formato igual; atualizado junto com estes artefatos, antes do
código (Princípio V). Nenhum evento WebSocket muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. Os paths das tasks estão em `Allowed Paths` do plan. A T123 toca `handler.go` só para trocar a chamada de
`StartMDNSServer`, path permitido no plan. `origin.go`, `network.go`, `mdns_windows.go`, `mdns_posix.go`, `go.mod`,
`apps/web/**`, `internal/webrtc/**` e `internal/auth/**` estão proibidos.

## 5. Riscos

- Teste com rede real pode não rodar em CI: `t.Skip`, e a lógica fica coberta por testes com prober falso.
- Backends anteriores à 010 não são detectados: limite documentado (C-124) e smoke com a mesma versão.
- Criação de sala ~1 s mais lenta: medido na T123 (RNF-121).

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T121.
