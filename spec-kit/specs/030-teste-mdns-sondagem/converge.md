# Converge: Limite do RNF-121 Medido Só na Sondagem

Feature: `030-teste-mdns-sondagem`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-14
Commit avaliado: `862aa03`
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3001 a C-3003), `plan.md`, `tasks.md` (T3001, T3002)
- código: `apps/backend/internal/room/mdns_probe_test.go` (`proberCronometrado`, `cronometraSondagem`),
  `apps/backend/internal/room/mdns_test.go` (`TestMDNSNaoDisputaNomeDeOutroBackend`); produção lida, sem mudança:
  `mdns.go` (`ClaimMDNSName`, `startMonitor`), `mdns_probe.go` (`legacyProber.probe`)
- suítes: `go vet ./...` e `go test -count=10 -v ./...` em `apps/backend` (6 pacotes verdes)
- máquina da verificação: Windows 11, Wi-Fi real (a mesma da issue #87)

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3001 | `862aa03`: o limite de 1,5 s passa a valer para a duração da primeira sondagem, medida por `proberCronometrado` em volta do prober real; sem sondagem o teste falha. Em `-count=10 ./...`: 10 de 10 verdes, sondagem 778–974 ms |
| RF-3002 | log de cada execução: `nome escolhido mlab-2.local; sondagem em …; claim em …` (claim 852 ms–1,06 s, sempre 70–100 ms acima da sondagem) |
| RNF-3001 | `git diff` da feature só toca `mdns_test.go`, `mdns_probe_test.go` e `spec-kit/specs/030-teste-mdns-sondagem/**`; `go.mod` e `package.json` intocados |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- `go test -race` não rodou: exige cgo e a máquina não tem gcc. A duração é escrita e lida só sob o mesmo mutex, e só
  a primeira sondagem é guardada (C-3003).
- A lentidão da issue (claim em 2,21 s) não se repetiu nas 10 execuções desta sessão, então a correção não foi vista
  sob aquele pico de carga. Com a mudança, um pico nos passos fora da sondagem não reprova mais o teste; um pico na
  própria sondagem continua reprovando (violação real do RNF-121) e o log mostra os dois tempos.

## 6. Novas tasks necessárias

- Nenhuma na 030.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum |

Observações do analisador do editor (gopls/staticcheck) em código fora do escopo, já citadas no converge da 013, sem
defeito funcional e sem issue: `mdns.go` `Close` com checagem redundante; `handler.go` `resolveBaseURL` sem chamadores;
`room_security_test.go:33` com contexto `nil`. Também avisos de API obsoleta da pion (`mdns.Server`, `Conn.Query`) nos
testes existentes.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| nenhum | 1.15.1 (sem mudança) | Só `test` e `spec-kit`; o instalador não muda. |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o teste aplica o limite do RNF-121 ao intervalo que o requisito define; produção intocada.
