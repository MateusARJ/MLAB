# Plan: Limite do RNF-121 Medido Só na Sondagem

Feature: `030-teste-mdns-sondagem`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3001 a C-3003)

## 1. Summary

Só testes, em `apps/backend/internal/room/`:

1. **`proberCronometrado` e `cronometraSondagem(t)` (RF-3001, C-3003)**, em `mdns_probe_test.go`, ao lado dos outros
   probers de teste: o helper troca `newMDNSProber` por uma função que embrulha o prober real num cronômetro, restaura
   o original no `t.Cleanup` e devolve uma função que lê a duração da primeira sondagem sob mutex.
2. **`TestMDNSNaoDisputaNomeDeOutroBackend`** (`mdns_test.go`): usa o helper; falha se a sondagem não ocorreu ou passou
   de 1,5 s (RNF-121); registra sondagem e claim total no log (RF-3002). As demais asserções não mudam.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Ponto de injeção | `newMDNSProber` (variável de pacote já usada por `usaProberFalso` e `monitorRapido`) | C-3002 |
| Concorrência | só a primeira chamada é cronometrada, sob `sync.Mutex` | C-3003 |
| Produção | sem mudança | RNF-3001 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| A própria sondagem passar de 1,5 s sob carga | falha real do RNF-121 | o teste continua falhando nesse caso; log mostra os dois tempos |
| Cronômetro vazar para outro teste | testes seguintes sondariam pelo embrulho | `t.Cleanup` restaura `newMDNSProber` |

## Scope Lock

### IN

- helper de cronômetro da sondagem e o teste do claim com outro backend, em `internal/room`.

### OUT

- código de produção do backend; parâmetros da sondagem; desktop, web e pacotes.

### Allowed Paths

- `apps/backend/internal/room/mdns_test.go`
- `apps/backend/internal/room/mdns_probe_test.go`
- `spec-kit/specs/030-teste-mdns-sondagem/**`

### Prohibited Paths

- `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_probe.go` e demais `.go` não-teste de
  `apps/backend/internal/room/`
- `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
- `apps/backend/go.mod`, `apps/backend/go.sum`
- `apps/desktop/**`, `apps/web/**`, `packages/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (sem incremento de versão)

### Dependencies

- Nenhuma nova. Só a biblioteca padrão do Go (`sync`, `time`, `testing`).

### Non-Goals

- mudar o RNF-121 ou os parâmetros da sondagem;
- afrouxar o limite de 1,5 s ou serializar o pacote;
- mudar `TestLegacyProberDetectaNomeOcupado`.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: autorização intocada.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: RNF-121 continua medido, agora no intervalo que o requisito define.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um helper de teste, no arquivo dos outros probers de teste.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-14 | Limite do RNF-121 aplicado só à sondagem do claim | C-3001, C-3002 |
| 2026-11-14 | Cronômetro guarda só a primeira sondagem, sob mutex | C-3003 |
| 2026-11-14 | Versão: sem incremento (só `test` e `spec-kit`) | AGENTS §13 |
