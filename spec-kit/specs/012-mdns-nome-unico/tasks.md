# Tasks: Nome mDNS Único por Professor

Feature: `012-mdns-nome-unico`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados; contrato `001/contracts/room-api.md` atualizado
Status: IMPLEMENTED (smoke A16b pendente)

Regras:
- task de backend: `go vet ./...` e `go test ./...` em `apps/backend` verdes antes do `[x]`;
- task de desktop: `npm test` e `npm run typecheck` (ou equivalente do workspace) em `apps/desktop` verdes;
- um commit atômico por task, com `Ref: T12x` e `Refs #37`/`Refs #39`.

### T121 — Teste de falha: dois backends na mesma rede
[x] T121
Allowed Paths: `apps/backend/internal/room/mdns_test.go`
Prohibited Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/handler.go`,
`apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] Um responder falso (`pion/mdns/v2` num segundo socket 5353) anuncia `mlab.local` com um IP alheio
  (`192.0.2.10`); o backend sobe o anúncio; a consulta legacy por `mlab.local` não pode trazer o IP do backend
  (RF-121, RF-122).
- [x] `t.Skip` quando a 5353 ou o multicast não estiverem disponíveis.
- [x] Evidência: com o código anterior, `TestMDNSNaoDisputaNomeDeOutroBackend` falha com "o backend respondeu por mlab.local, já anunciado por outro backend (192.0.2.10); respostas: [192.0.2.10 192.168.0.35]" (Windows 11, Wi-Fi, 2026-11-08; commit `5d23ce6`).

### T122 — Sondagem e escolha do nome
[x] T122
Depends On: T121
Allowed Paths: `apps/backend/internal/room/mdns_probe.go`, `apps/backend/internal/room/mdns_probe_test.go`,
`apps/backend/internal/room/mdns_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/origin.go`,
`apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] `mdnsCandidates` gera os 20 nomes na ordem (RF-122).
- [x] `chooseName` devolve o primeiro livre e falha com os 20 ocupados; `yieldsName` cede quando o próprio IPv4 é
  maior (RF-125).
- [x] `legacyProber` envia as 3 rodadas com o atraso inicial e ignora respostas com o próprio IP (RF-121);
  `consultaLegacy` do teste passa a reusar o código de produção.

### T123 — Claim do nome único e fim do alias
[x] T123
Depends On: T122
Allowed Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_test.go`,
`apps/backend/internal/room/mdns_probe_test.go`, `apps/backend/internal/room/handler.go` (só a troca da chamada)
Prohibited Paths: `apps/backend/internal/room/origin.go`, `apps/backend/internal/room/mdns_windows.go`,
`apps/backend/internal/room/mdns_posix.go`, `apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] `ClaimMDNSName(ip)` substitui `StartMDNSServer`; anuncia só o nome escolhido (RF-124); `CurrentMDNSHost()`
  vazio sem anúncio.
- [x] Com prober falso: `mlab.local` ocupado → `mlab-2.local`; todos ocupados → erro e sem anúncio (RF-126).
- [x] T121 passa: o backend fica com `mlab-2.local`, que resolve para o IP dele; `mlab.local` continua com o IP
  alheio. Tempo do claim: 1,00–1,07 s (RNF-121 ≤ 1,5 s). Commits `596caa6` (T122), `d9c7f48` (T123).
- [x] `TestMDNSRespondeConsultaLegacyUnicast` (010) continua passando.

### T124 — Monitor de conflito depois do anúncio
[x] T124
Depends On: T123
Allowed Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_probe_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/origin.go`,
`apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] Reconsulta em +2 s, +5 s e a cada 60 s (intervalos encurtados no teste).
- [x] Com prober falso: IP alheio menor → troca para o próximo livre e loga; IP alheio maior → mantém e loga (RF-125).
- [x] O monitor para em `StopMDNSServer`/`Close` (canal `done` no teste). `-race` não executado: sem `gcc` na
  máquina, Docker parado e WSL sem Go (registrado no converge).

### T125 — Links da API com o nome anunciado
[x] T125
Depends On: T123
Allowed Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`
Prohibited Paths: `apps/backend/internal/room/origin.go`, `apps/backend/internal/room/network.go`,
`apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] `createRoom` faz o claim de forma síncrona antes de montar os links; falha só gera log (RF-123, RNF-123).
- [x] Testes de `POST /rooms`, `GET /rooms/{id}/link` e `GET /rooms/active` com nome `mlab.local`, com
  `mlab-2.local` e sem anúncio (sem `mdns_link`, `link` = IP); `BASE_URL` mantém precedência (RF-126).

### T126 — Desktop: link anunciado, atualização e aviso
[x] T126
Depends On: T125
Allowed Paths: `apps/desktop/src/renderer/hooks/useRoomLinks.ts`, `apps/desktop/src/renderer/hooks/useRoomLinks.test.ts`,
`apps/desktop/src/renderer/pages/Dashboard.tsx`, `apps/desktop/src/renderer/pages/Dashboard.test.tsx`,
`apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`,
`packages/types/src/index.ts` (só comentário)
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`, `apps/web/**`, `apps/backend/**`,
`packages/ui/**`
Checks:
- [x] Dashboard e sala mostram e copiam `mdns_link` recebido (`mlab-2.local`); sem `mdns_link` o bloco "Link Fixo"
  some e o link por IP fica (RF-127).
- [x] `useRoomLinks` relê o link a cada 10 s, atualiza a tela e mostra o aviso de mudança ou de indisponibilidade
  (RF-128); para o polling ao desmontar.
- [x] Fixtures `mlab-professor.local`/`mlab-charlie.local` trocadas por `mlab.local`/`mlab-2.local`. Vitest: 18
  arquivos, 151 testes verdes. `tsc --noEmit`: 14 erros antes e depois, nenhum nos arquivos da task (issue #51).
  Commit `33f063c`.

### T127 — Documentos derivados e smoke A16b
[x] T127
Depends On: T125, T126
Allowed Paths: `spec-kit/specs/003-classroom-interaction/spec.md`, `spec-kit/specs/010-mdns-celular/spec.md`,
`docs/requirements/functionals/RF013-geracao-de-link-unico-de-convite.md`, `README.md`,
`docs/metrics/smoke-runbook.md`, `scripts/smoke-report.js`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] Nota na US-22/RF-312 (003) e na RF-101 (010) apontando para a 012 (nome numerado, sem alias).
- [x] RF013 e README citam `mlab.local` / `mlab-N.local`.
- [x] Smoke A16b (dois professores na mesma rede) no runbook e no `smoke-report.js`.

### T128 — Verificação manual, converge e versão
[ ] T128
Depends On: T121, T122, T123, T124, T125, T126, T127
Allowed Paths: `spec-kit/specs/012-mdns-nome-unico/**`, `package.json`, `package-lock.json`, `apps/*/package.json`,
`packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/**`, `packages/*/src/**`
Checks:
- [x] `Resolve-DnsName mlab.local -Type A` devolve `192.168.0.35` com o backend real (porta 18080, `POST /rooms` em
  1,2 s); o alias antigo não resolve (2026-11-08).
- [ ] Smoke A16b executado pelo responsável (ou registrado como pendente no converge).
- [x] `converge.md` com resultado, pendências, desvios (#50) e nível de versão (MINOR); `npm run bump -- minor` e
  `npm run version:check`.
