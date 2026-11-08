# Tasks: Nome mDNS Único por Professor

Feature: `012-mdns-nome-unico`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados; contrato `001/contracts/room-api.md` atualizado
Status: READY-FOR-IMPLEMENTATION

Regras:
- task de backend: `go vet ./...` e `go test ./...` em `apps/backend` verdes antes do `[x]`;
- task de desktop: `npm test` e `npm run typecheck` (ou equivalente do workspace) em `apps/desktop` verdes;
- um commit atômico por task, com `Ref: T12x` e `Refs #37`/`Refs #39`.

### T121 — Teste de falha: dois backends na mesma rede
[ ] T121
Allowed Paths: `apps/backend/internal/room/mdns_test.go`
Prohibited Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/handler.go`,
`apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [ ] Um responder falso (`pion/mdns/v2` num segundo socket 5353) anuncia `mlab.local` com um IP alheio
  (`192.0.2.10`); o backend sobe o anúncio; a consulta legacy por `mlab.local` não pode trazer o IP do backend
  (RF-121, RF-122).
- [ ] `t.Skip` quando a 5353 ou o multicast não estiverem disponíveis.
- [ ] Evidência: o teste falha com o código atual (o backend também responde por `mlab.local`).

### T122 — Sondagem e escolha do nome
[ ] T122
Depends On: T121
Allowed Paths: `apps/backend/internal/room/mdns_probe.go`, `apps/backend/internal/room/mdns_probe_test.go`,
`apps/backend/internal/room/mdns_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/origin.go`,
`apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [ ] `mdnsCandidates` gera os 20 nomes na ordem (RF-122).
- [ ] `chooseName` devolve o primeiro livre e falha com os 20 ocupados; `yieldsName` cede quando o próprio IPv4 é
  maior (RF-125).
- [ ] `legacyProber` envia as 3 rodadas com o atraso inicial e ignora respostas com o próprio IP (RF-121);
  `consultaLegacy` do teste passa a reusar o código de produção.

### T123 — Claim do nome único e fim do alias
[ ] T123
Depends On: T122
Allowed Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_test.go`,
`apps/backend/internal/room/mdns_probe_test.go`, `apps/backend/internal/room/handler.go` (só a troca da chamada)
Prohibited Paths: `apps/backend/internal/room/origin.go`, `apps/backend/internal/room/mdns_windows.go`,
`apps/backend/internal/room/mdns_posix.go`, `apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [ ] `ClaimMDNSName(ip)` substitui `StartMDNSServer`; anuncia só o nome escolhido (RF-124); `CurrentMDNSHost()`
  vazio sem anúncio.
- [ ] Com prober falso: `mlab.local` ocupado → `mlab-2.local`; todos ocupados → erro e sem anúncio (RF-126).
- [ ] T121 passa: o backend fica com `mlab-2.local`, que resolve para o IP dele; `mlab.local` continua com o IP
  alheio. Tempo do claim registrado (RNF-121 ≤ 1,5 s).
- [ ] `TestMDNSRespondeConsultaLegacyUnicast` (010) continua passando.

### T124 — Monitor de conflito depois do anúncio
[ ] T124
Depends On: T123
Allowed Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_probe_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/origin.go`,
`apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [ ] Reconsulta em +2 s, +5 s e a cada 60 s (intervalos encurtados no teste).
- [ ] Com prober falso: IP alheio menor → troca para o próximo livre e loga; IP alheio maior → mantém e loga (RF-125).
- [ ] O monitor para em `StopMDNSServer`/`Close` (sem goroutine viva: teste com `-race`).

### T125 — Links da API com o nome anunciado
[ ] T125
Depends On: T123
Allowed Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`
Prohibited Paths: `apps/backend/internal/room/origin.go`, `apps/backend/internal/room/network.go`,
`apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [ ] `createRoom` faz o claim de forma síncrona antes de montar os links; falha só gera log (RF-123, RNF-123).
- [ ] Testes de `POST /rooms`, `GET /rooms/{id}/link` e `GET /rooms/active` com nome `mlab.local`, com
  `mlab-2.local` e sem anúncio (sem `mdns_link`, `link` = IP); `BASE_URL` mantém precedência (RF-126).

### T126 — Desktop: link anunciado, atualização e aviso
[ ] T126
Depends On: T125
Allowed Paths: `apps/desktop/src/renderer/hooks/useRoomLinks.ts`, `apps/desktop/src/renderer/hooks/useRoomLinks.test.ts`,
`apps/desktop/src/renderer/pages/Dashboard.tsx`, `apps/desktop/src/renderer/pages/Dashboard.test.tsx`,
`apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`,
`packages/types/src/index.ts` (só comentário)
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`, `apps/web/**`, `apps/backend/**`,
`packages/ui/**`
Checks:
- [ ] Dashboard e sala mostram e copiam `mdns_link` recebido (`mlab-2.local`); sem `mdns_link` o bloco "Link Fixo"
  some e o link por IP fica (RF-127).
- [ ] `useRoomLinks` relê o link a cada 10 s, atualiza a tela e mostra o aviso de mudança ou de indisponibilidade
  (RF-128); para o polling ao desmontar.
- [ ] Fixtures `mlab-professor.local`/`mlab-charlie.local` trocadas por `mlab.local`/`mlab-2.local`.

### T127 — Documentos derivados e smoke A16b
[ ] T127
Depends On: T125, T126
Allowed Paths: `spec-kit/specs/003-classroom-interaction/spec.md`, `spec-kit/specs/010-mdns-celular/spec.md`,
`docs/requirements/functionals/RF013-geracao-de-link-unico-de-convite.md`, `README.md`,
`docs/metrics/smoke-runbook.md`, `scripts/smoke-report.js`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] Nota na US-22/RF-312 (003) e na RF-101 (010) apontando para a 012 (nome numerado, sem alias).
- [ ] RF013 e README citam `mlab.local` / `mlab-N.local`.
- [ ] Smoke A16b (dois professores na mesma rede) no runbook e no `smoke-report.js`.

### T128 — Verificação manual, converge e versão
[ ] T128
Depends On: T121, T122, T123, T124, T125, T126, T127
Allowed Paths: `spec-kit/specs/012-mdns-nome-unico/**`, `package.json`, `package-lock.json`, `apps/*/package.json`,
`packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/**`, `packages/*/src/**`
Checks:
- [ ] `Resolve-DnsName <nome-anunciado> -Type A` devolve o IP do backend.
- [ ] Smoke A16b executado pelo responsável (ou registrado como pendente no converge).
- [ ] `converge.md` com resultado, pendências, desvios (#50) e nível de versão (MINOR); `npm run bump -- minor` e
  `npm run version:check`.
