# Plan: Link `mlab.local` no Celular

Feature: `010-mdns-celular`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-101 a C-103)

## 1. Summary

1. **Teste de regressão (RF-101, RF-103)**: em `mdns_test.go`, um socket UDP em porta efêmera envia uma consulta A
   `mlab.local` com ID diferente de zero para `224.0.0.251:5353` na interface do IP anunciado e espera resposta
   unicast nessa porta, com o mesmo ID, a pergunta ecoada e um A igual ao IP anunciado. Pula (`t.Skip`) se a 5353 ou o
   multicast não estiverem disponíveis, como o teste atual.
2. **Migração para `pion/mdns/v2` (RF-101 a RF-103, RNF-101)**: em `mdns.go`, trocar o import para
   `github.com/pion/mdns/v2` e a chamada para `mdns.Server(ipv4.NewPacketConn(rawConn), nil, &mdns.Config{...})`.
   Ficam intactos `listenReusablePacketConn` (`mdns_windows.go`/`mdns_posix.go`), `findInterfaceByIP`, a lista de
   nomes, `LocalAddress`, `StartMDNSServer`/`StopMDNSServer` e o retorno de erro quando a 5353 falha.
3. **Smoke A16**: o runbook passa a listar os limites reais e um diagnóstico rápido.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Biblioteca | `github.com/pion/mdns/v2` v2.2.2 (sai `github.com/pion/mdns` v0.0.12) | C-101 |
| Socket | o mesmo `0.0.0.0:5353` com SO_REUSEADDR; só IPv4 (`multicastPktConnV6 = nil`) | RNF-101 |
| Tipos respondidos | `Server` da v2 limita a A/AAAA; AAAA sem endereço IPv6 não recebe resposta | RF-103 |
| Unicast | a v2 responde unicast quando a origem ≠ 5353, há bit QU ou a consulta é direta | RF-101 |
| Go | `go 1.26.0` no módulo; a v2 exige `go 1.24` | — |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Atualização transitiva de `golang.org/x/net`/`x/sys`/`pion/logging` | regressão no backend/SFU | `go test ./...` e `go vet ./...` completos; smoke de transmissão no A16 |
| Teste multicast instável em CI/VM | falso negativo | `t.Skip` quando a 5353 ou o multicast não estiverem disponíveis |
| Rede da escola sem multicast | `mlab.local` não resolve | fora de escopo; link por IP segue (spec §2) |
| Firewall do Windows bloqueia UDP 5353 de entrada | `mlab.local` não resolve na LAN | registrado no diagnóstico do A16 |

## Scope Lock

### IN

- responder mDNS do backend (`internal/room/mdns*.go`) e suas dependências Go;
- teste de regressão do mDNS;
- roteiro do smoke A16.

### OUT

- links devolvidos pela API, contratos, web app, app desktop e SFU;
- registro pelo responder nativo do SO (plano B da C-101, exige ADR).

### Allowed Paths

- `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_test.go`
- `apps/backend/internal/room/mdns_windows.go`, `apps/backend/internal/room/mdns_posix.go` (só se a migração exigir)
- `apps/backend/go.mod`, `apps/backend/go.sum`
- `docs/metrics/smoke-runbook.md` (seção A16)
- `spec-kit/specs/010-mdns-celular/**`

### Prohibited Paths

- `apps/web/**`, `apps/desktop/**`, `packages/**`
- `apps/backend/internal/webrtc/**`, `apps/backend/internal/signaling/**`, `apps/backend/internal/auth/**`
- `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/origin.go`, `apps/backend/internal/room/network.go`
- `spec-kit/specs/*/contracts/**`

### Dependencies

- Nova: `github.com/pion/mdns/v2` v2.2.2 (substitui `github.com/pion/mdns` v0.0.12).
- Transitivas atualizadas pelo `go mod tidy` conforme exigido pela v2: `golang.org/x/net`, `golang.org/x/sys`,
  `github.com/pion/logging`.
- Existentes: `golang.org/x/net/ipv4`, `golang.org/x/sys/windows`.

### Non-Goals

- DNS-SD/`_mlab._tcp`, QR code, IPv6 obrigatório;
- suporte a Firefox, Android anterior ao 12 ou redes sem multicast.

## 4. Constitution Check

- [x] Princípio I: spec aprovada.
- [x] Princípio II: sem mudança de autorização; `isAllowedOrigin` já aceita `mlab.local`.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: troca de biblioteca contida em um arquivo.
- [ ] Princípio VIII: converge ao final (T104).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-06 | Atualizar para `pion/mdns/v2`; responder nativo do SO fica como plano B com ADR | C-101 |
| 2026-11-06 | IDs 1xx (RF-101, T101…) para caber no padrão `T\d{3}` do validador; faixa 1xx livre | — |
| 2026-11-06 | Versão: PATCH (correção de capacidade existente, sem mudança de contrato) | AGENTS §13 |
