# Converge: Lista de Arquivos do Celular na Altura da Gaveta

Feature: `024-lista-arquivos-celular`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-12
Commits avaliados: `f589fcb` (T2401)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2401 a C-2403), `plan.md`, `tasks.md` (T2401 a T2403)
- código: `apps/web/src/pages/Room.tsx`; testes: `apps/web/src/pages/Room.test.tsx`
- suítes: `npm run test -w apps/web` e `npm run lint`
- verificação manual (T2402): confirmada pelo responsável no celular ("ok, aprovado nos testes").

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2401 | estilo `mobileFilesList` (sem `maxHeight`, `flex: 1`, `overflowY: auto`) e `mobileFilesContent` sem `overflowY`; teste "no celular, a lista da aba Arquivos ocupa a altura da gaveta…"; manual (T2402) |
| RF-2402 | `filesList` intocado; teste "no desktop, a gaveta Arquivos da Aula mantém a altura máxima de 380px"; manual (T2402) |
| RF-2403 | testes de rolagem automática da 018 verdes; `files-end` dentro de `mobile-files-list` (checado no teste do RF-2401); manual (T2402) |
| RNF-2401 | nenhum contrato, payload ou endpoint tocado |
| RNF-2402 | nenhuma dependência nova |

Totais: web com 4 arquivos e 47 testes verdes; `npm run lint` verde.

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
| `data-testid="mobile-files-content"` na moldura, além dos dois previstos no plan | `Room.tsx` | só para o teste verificar que a moldura não rola (C-2401); sem efeito visual |

## 5. Testes faltantes

- Nenhum automatizado. A altura real depende de layout, que o jsdom não calcula; coberta pela verificação manual.

## 6. Novas tasks necessárias

- Nenhuma na 024.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.14.2 | Correção de layout sem capacidade nova nem mudança de contrato (C-2403). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — no celular, a lista da aba Arquivos ocupa a altura da gaveta e rola dentro dela; a gaveta do
  desktop e a rolagem automática até o último arquivo continuam como antes.
