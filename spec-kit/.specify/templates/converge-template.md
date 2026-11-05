# Converge: [NOME DA FEATURE]

Feature: `[###-slug]`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: [AAAA-MM-DD]
Commit avaliado: `[hash]`
Status: OPEN

## Entradas

- `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `contracts/`
- código real nos Allowed Paths do Scope Lock
- resultado das suítes de teste (comando e saída resumida)

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| | |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| | | |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento (emenda, ADR, nova task) |
|---|---|---|---|
| | | | |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| | | |

## 5. Testes faltantes

- 

## 6. Novas tasks necessárias

- 

## 7. Desvios registrados

Bugs ou erros encontrados fora do escopo da feature e abertos como issue (`AGENTS.md` §14). Escreva "Nenhum" se não
houver.

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #N | bug, desvio, area:* | sim / não | aberta / corrigida em #M |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MAJOR / MINOR / PATCH / nenhum | X.Y.Z | |

## 9. Resultado

- [ ] OPEN — há gaps registrados acima com encaminhamento definido.
- [ ] CONVERGED — não há divergência, código sem requisito ou teste faltante.

Nunca marcar CONVERGED para esconder gaps. Quando CONVERGED, registrar `Status: CONVERGED` no topo.
