# Plan: Teste da Sondagem mDNS Isolado da Rede

Feature: `054-teste-mdns-rede-compartilhada`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-5401 e C-5402)

## 1. Summary

Em `apps/backend/internal/room/mdns_probe_test.go`, o `TestLegacyProberDetectaNomeOcupado`:

1. gera `base := fmt.Sprintf("mlab-teste-%08x", rand.Uint32())` e os nomes `base.local`, `base-2.local` e
   `base-3.local`;
2. passa esses nomes aos responders simulados (`iniciaResponderAlheio`, `iniciaResponder`) e ao `probe`;
3. mantém as mesmas asserções sobre o mapa `taken` e o limite de 1,5 s.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Isolamento | nomes aleatórios por execução | C-5401 |
| Asserções | inalteradas | RF-5402 |
| Versão | nenhuma | C-5402 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Nome inválido para mDNS | responder não anuncia | só minúsculas, dígitos e hífen; rótulo com menos de 63 caracteres |
| Teste deixar de cobrir a 012 | perda de cobertura | mesmas asserções e o mesmo `legacyProber` |

## Scope Lock

### IN

- `TestLegacyProberDetectaNomeOcupado`.

### OUT

- código de produção; demais testes de mDNS; frontend; desktop.

### Allowed Paths

- `apps/backend/internal/room/mdns_probe_test.go`
- `spec-kit/specs/054-teste-mdns-rede-compartilhada/**`

### Prohibited Paths

- `apps/backend/internal/room/*.go` exceto `mdns_probe_test.go`, `apps/backend/cmd/**`, `apps/desktop/**`,
  `apps/web/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`, `docs/**`, `package.json`

### Dependencies

- Nenhuma nova.

### Non-Goals

- Isolar os testes do `ClaimMDNSName`, que usam `mlab.local` fixo.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a um teste.
- [ ] Princípio VIII: converge ao final (T5402).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-19 | Nomes únicos por execução | C-5401 |
| 2026-11-19 | Branch e PR da/para a `main`; IDs `540x`; sem incremento | C-5402 |
