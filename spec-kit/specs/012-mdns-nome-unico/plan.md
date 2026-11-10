# Plan: Nome mDNS Único por Professor

Feature: `012-mdns-nome-unico`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-121 a C-127)

## 1. Summary

### Backend — `apps/backend/internal/room/`

1. **Sondagem (`mdns_probe.go`, RF-121/RF-122):**
   - `mdnsCandidates(max)` gera `mlab.local`, `mlab-2.local` … `mlab-20.local`;
   - `legacyProber.probe(names)` abre um socket UDP em porta efêmera na interface do IP anunciado, espera um atraso
     aleatório de 0 a 250 ms e envia 3 consultas (uma pergunta A por nome, todas num pacote) para `224.0.0.251:5353`
     com 250 ms de intervalo; coleta respostas até 250 ms após a última. Devolve `map[nome]IP` só com IPs diferentes
     do próprio. É a promoção de `consultaLegacy` (`mdns_test.go`) para produção;
   - lógica pura: `chooseName(candidates, taken)` (primeiro livre) e `yieldsName(own, other)` (o IPv4 numericamente
     maior cede);
   - interface `nameProber` para injetar um prober falso nos testes de unidade.
2. **Claim (`mdns.go`, RF-123/RF-124):** `ClaimMDNSName(ip) (string, error)` substitui `StartMDNSServer`: fecha o
   servidor ativo, sonda, escolhe o nome e sobe o `mdns.Server` com **só** esse nome. `CurrentMDNSHost()` devolve o
   nome ativo (vazio sem anúncio), com o mutex existente. A criação do socket 5353 e das interfaces continua a mesma.
3. **Monitor de conflito (`mdns.go`, RF-125):** goroutine do servidor ativo, cancelada em `StopMDNSServer`/`Close`.
   Reconsulta o nome em +2 s, +5 s e a cada 60 s. Se aparecer IP alheio e `yieldsName` for verdadeiro, sonda de novo
   com o nome atual marcado como ocupado, recria o servidor com o novo nome e registra em log; senão só registra.
   Intervalos em variável de pacote, para o teste encurtar.
4. **Links (`handler.go`, RF-123/RF-126):** `createRoom` chama o claim de forma síncrona antes de `buildRoomLinks`
   (falha só gera log, RNF-123). `buildRoomLinks` usa o nome ativo; sem nome, `MDNSLink`/`ShortMDNSLink` vazios e
   `Link` = link por IP (env continua com precedência). Funções `mdnsClaim`/`mdnsHost` em variáveis de pacote, para
   os testes do handler não usarem a rede.

### Desktop — `apps/desktop/src/renderer/`

5. **Hook `hooks/useRoomLinks.ts` (RF-128):** recebe `roomId` e os links iniciais; lê `getRoomLink` ao montar e a cada
   10 s; mantém os links e devolve `notice` quando `mdns_link` muda (novo link ou indisponível) e `dismissNotice`.
6. **`pages/Dashboard.tsx` e `pages/Room.tsx` (RF-127/RF-128):** usam o hook; bloco "Link Fixo" só com `mdnsLink`;
   aviso com `Alert` do `@mlab/ui`. O Dashboard repassa os links atualizados ao abrir a sala.

### Documentos

7. Contrato `001/contracts/room-api.md` (descrição de `mdns_link`/`link`), comentário em `packages/types`, nota na 003
   (US-22/RF-312) e na 010 (RF-101), `docs/requirements/functionals/RF013-*`, `README.md`, smoke A16b.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Sondagem | consulta A *legacy unicast*, 20 perguntas por pacote, 3 rodadas × 250 ms, atraso 0–250 ms | C-122, RF-121 |
| Candidatos | `mlab.local`, `mlab-2.local` … `mlab-20.local` | C-123 |
| Responder | `pion/mdns/v2` v2.2.2 (sem mudança), recriado para trocar o nome | C-122 |
| Desempate | IPv4 numericamente menor mantém o nome | C-124 |
| Desktop | polling de `GET /rooms/{id}/link` a cada 10 s | C-125 |
| Sem anúncio | sem `mdns_link`; `link` = IP | C-126 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Multicast bloqueado / firewall na 5353 | outro backend não é visto; dois anunciam o mesmo nome | igual à 010: fora de escopo; o monitor e o link por IP seguem; diagnóstico no A16b |
| Backend MLab < 010 na rede | não responde à sondagem | limite documentado (C-124); smoke com a mesma versão |
| Teste com rede real instável em CI/VM | falso negativo | `t.Skip` quando a 5353 ou o multicast não estiverem disponíveis, como na 010 |
| Criação de sala mais lenta | +~1 s na criação | sondagem paralela num pacote; RNF-121 medido no teste |
| Dois backends criando sala ao mesmo tempo | mesmo nome | monitor com desempate (RF-125) |
| Polling a cada 10 s | carga | requisição local ao backend embarcado; só enquanto os links estão na tela |

## Scope Lock

### IN

- sondagem, escolha de nome, anúncio e monitor mDNS do backend;
- montagem dos links no handler de salas;
- exibição, cópia, atualização e aviso do link no app desktop (Dashboard e sala);
- contrato `room-api.md` e documentos derivados citados.

### OUT

- responder nativo do SO, IPv6, DNS-SD, QR code;
- web app dos alunos, SFU, sinalização, autenticação e origem permitida;
- novo evento WebSocket ou novo campo na API.

### Allowed Paths

- `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_probe.go`,
  `apps/backend/internal/room/mdns_probe_test.go`, `apps/backend/internal/room/mdns_test.go`
- `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`
- `apps/desktop/src/renderer/hooks/useRoomLinks.ts`, `apps/desktop/src/renderer/hooks/useRoomLinks.test.ts`
- `apps/desktop/src/renderer/pages/Dashboard.tsx`, `apps/desktop/src/renderer/pages/Dashboard.test.tsx`
- `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
- `packages/types/src/index.ts` (só comentário)
- `spec-kit/specs/001-screen-share-core/contracts/room-api.md`
- `spec-kit/specs/003-classroom-interaction/spec.md`, `spec-kit/specs/010-mdns-celular/spec.md` (nota de referência)
- `docs/requirements/functionals/RF013-geracao-de-link-unico-de-convite.md`, `README.md`
- `docs/metrics/smoke-runbook.md`, `scripts/smoke-report.js`
- `spec-kit/specs/012-mdns-nome-unico/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (só pelo `npm run bump`)

### Prohibited Paths

- `apps/web/**`
- `apps/backend/internal/webrtc/**`, `apps/backend/internal/signaling/**`, `apps/backend/internal/auth/**`
- `apps/backend/internal/room/origin.go`, `apps/backend/internal/room/network.go`,
  `apps/backend/internal/room/mdns_windows.go`, `apps/backend/internal/room/mdns_posix.go`
- `apps/backend/go.mod`, `apps/backend/go.sum`
- `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`, `packages/ui/**`

### Dependencies

- Nenhuma nova. Existentes: `github.com/pion/mdns/v2` v2.2.2, `golang.org/x/net/dns/dnsmessage`,
  `golang.org/x/net/ipv4`; no desktop, `@mlab/ui` e `@mlab/types`.

### Non-Goals

- detectar backends anteriores à 010;
- garantir resolução em redes sem multicast;
- persistir o nome entre execuções.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: `GET /rooms/{id}/link` continua exclusivo do professor dono; sem mudança de autorização.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: RNF-121 medido no teste de rede (tempo do claim registrado na T123).
- [x] Princípio V: `room-api.md` atualizado antes do código (descrição de `mdns_link` e `link`).
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: a única abstração nova (`nameProber`) tem dois consumidores reais (claim e monitor) e o fake dos
  testes; sem campo novo nem evento novo.
- [ ] Princípio VIII: converge ao final (T128).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-06 | Remover o alias `mlab-<professor>.local` | C-121 |
| 2026-11-06 | Sondagem própria por consulta legacy; responder nativo do SO fica como plano B com ADR | C-122 |
| 2026-11-06 | Desempate por IPv4 menor com troca de nome e aviso no desktop | C-124 |
| 2026-11-06 | Polling de 10 s no desktop, sem evento WS nem campo novo | C-125 |
| 2026-11-08 | IDs 1xx (RF-121…, T121…); `T1201` não seria validado (issue #50) | C-127 |
| 2026-11-08 | Versão: MINOR (comportamento novo compatível) | AGENTS §13, C-127 |
