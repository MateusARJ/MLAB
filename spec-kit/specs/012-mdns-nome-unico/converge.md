# Converge: Nome mDNS Único por Professor

Feature: `012-mdns-nome-unico`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-08
Commit avaliado: `4a3c5fc`
Status: OPEN (falta só o smoke manual A16b)

## Entradas

- `spec.md`, `clarify.md` (C-121 a C-127), `plan.md`, `tasks.md` (T121–T128), contrato
  `001/contracts/room-api.md`
- código: `apps/backend/internal/room/{mdns.go,mdns_probe.go,handler.go}`,
  `apps/desktop/src/renderer/{hooks/useRoomLinks.ts,pages/Dashboard.tsx,pages/Room.tsx}`
- suítes: backend `go vet ./...` e `go test ./...` (6 pacotes verdes), `GOOS=linux go vet ./...`,
  `GOOS=darwin go build ./...`; desktop `vitest run` (18 arquivos, 151 testes verdes); `npm run spec:check` (PASS)
- verificação local (Windows 11, Wi-Fi, 2026-11-08): backend real na porta 18080, `POST /rooms` em 1,2 s com
  `mdns_link` `http://mlab.local:18080`; `Resolve-DnsName mlab.local -Type A` → `192.168.0.35`; o alias antigo
  `mlab-teste.local` não resolve mais

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-121 | `legacyProber` (`596caa6`); `TestLegacyProberDetectaNomeOcupado` (rede real: marca `mlab.local` do responder falso, ignora o próprio IP, 0,97–1,06 s) |
| RF-122 | `mdnsCandidates`/`chooseName` + `TestMDNSCandidates`, `TestChooseName`; `TestMDNSNaoDisputaNomeDeOutroBackend` falhava antes (`5d23ce6`: `mlab.local` com dois IPs) e passa depois (`d9c7f48`: backend fica com `mlab-2.local`) |
| RF-123 | `createRoom` faz o claim síncrono antes de `buildRoomLinks` (`d06505a`); `TestCreateRoomDevolveNomeAnunciado`; backend real devolveu o nome anunciado no `POST /rooms` |
| RF-124 | `ClaimMDNSName` anuncia só o nome escolhido (`d9c7f48`); log "respondendo por mlab.local"; alias `mlab-<professor>.local` não resolve |
| RF-125 | monitor em `mdns.go` (`8112baa`); `TestMonitorDeConflitoCedeOuMantemNome` (IP alheio menor → troca para `mlab-2.local`; maior → mantém; para no `StopMDNSServer`) |
| RF-126 | `TestClaimMDNSNameEscolheNome/todos_ocupados`; `TestBuildRoomLinksUsaNomeAnunciado/sem_anúncio` e `BASE_URL` com precedência; `POST /rooms` sem anúncio sem `mdns_link` |
| RF-127 | Dashboard e sala mostram/copiam `links.mdnsLink` e escondem o Link Fixo sem anúncio (`33f063c`); testes de Dashboard (cópia de `mlab-2.local`, bloco escondido) e de Room |
| RF-128 | `useRoomLinks` (`33f063c`); `useRoomLinks.test.ts` com timers falsos (10 s, aviso de mudança e de indisponibilidade, fim do polling ao desmontar) |
| RNF-121 | claim em 1,00–1,07 s no teste de rede; `POST /rooms` real em 1,2 s (limite 1,5 s) |
| RNF-122 | `go.mod`/`go.sum` sem mudança; stack `pion/mdns/v2` mantida |
| RNF-123 | `createRoom` só registra a falha do claim em log; sala criada e `link` por IP (teste sem anúncio) |
| RN-121, RN-122 | `ip_link` sempre devolvido e mostrado; formato da API igual, `mdns_link` opcional (`omitempty`) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| Critério de sucesso "smoke A16b" | execução manual com dois PCs na mesma Wi-Fi e celulares (Chrome Android; Safari iOS se houver) | roteiro em `docs/metrics/smoke-runbook.md` (A16b), item em `scripts/smoke-report.js` |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- `go test -race` (T124) não executado: a máquina não tem `gcc` (CGO desligado), o Docker estava parado e o WSL não
  tem Go. A parada do monitor é verificada pelo canal `done` em `TestMonitorDeConflitoCedeOuMantemNome`.
- Smoke A16b (seção 2), incluindo o conflito com criação simultânea nos dois PCs.
- Os testes de rede pulam (`t.Skip`) em ambiente sem multicast; aqui rodaram de verdade (Wi-Fi).

## 6. Novas tasks necessárias

- Nenhuma na 012. Limite conhecido e documentado (C-124): backend anterior à 1.9.1 não responde à sondagem.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #50 — validador ignora tarefas com ID de 4 dígitos | bug, desvio, area:spec-kit | não | aberta; a 012 usa IDs de 3 dígitos |
| #51 — `tsc --noEmit` do desktop falha com 14 erros na `development` | bug, desvio, area:desktop | não | aberta; mesma contagem antes e depois da T126, nenhum erro nos arquivos da 012 |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.10.0 | Comportamento novo compatível: nome mDNS numerado por professor, troca em conflito, links com o nome anunciado e aviso no desktop. Formato da API igual (`mdns_link` já era opcional). A saída do alias `mlab-<professor>.local` não é quebra: o app nunca exibiu esse link. |

## 9. Resultado

- [x] OPEN — código, testes automatizados e verificação local convergem com spec/plan/tasks; falta o smoke manual
  A16b (seção 2), que depende de dois PCs e celulares do responsável.
- [ ] CONVERGED
