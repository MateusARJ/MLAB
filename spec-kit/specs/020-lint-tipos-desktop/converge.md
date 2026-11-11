# Converge: Lint de Tipos do App Desktop sem Erros

Feature: `020-lint-tipos-desktop`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-11
Commits avaliados: `f94cef8` (T2001), `e8b685a` (T2002), `4dec951` (T2003), `1560001` (T2004), `bf3601b` (T2005)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2001 a C-2006), `plan.md`, `tasks.md` (T2001 a T2006)
- código: `apps/desktop/src/main/main.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`,
  `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`,
  `.github/workflows/build-all.yml`
- suítes: `npx tsc --noEmit -p .` e `npx vitest run` em `apps/desktop`; `npm run lint` na raiz

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2001 | `tsc --noEmit -p apps/desktop`: 14 → 13 (T2001) → 3 (T2002) → 2 (T2003) → 0 (T2004); `npm run lint` na raiz: 5 de 5 tarefas, código 0 |
| RF-2002 | `Room.tsx` sem estado, setters nem assinatura de `onActiveWindowUnauthorized`; `grep "Proteção de Privacidade\|privacyShield" apps/desktop/src` só acha as duas asserções negativas do teste de múltiplas janelas em `Room.test.tsx` |
| RF-2003 | `build-all.yml`: etapa "Verificar tipos e go vet (lint)" com `npm run lint`, entre o build de `@mlab/types` e os testes; YAML válido; gatilhos sem mudança |
| RNF-2001 | Worker: o caminho sem sobreposição (`writer.write(frame)`) e o desenho de traços e lupa com `state.rect` ficaram iguais; a falha ao criar o canvas continua repassando o quadro original. Sala: troca de janela autorizada coberta pelo teste de múltiplas janelas. Suíte do desktop: 23 arquivos e 199 testes verdes |
| RNF-2002 | Nenhum `package.json` mudou até a T2005; `preload.ts`, `cursorPresence.ts` e os contratos não mudaram |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RNF-2001 | Smoke manual do professor: transmitir com a lupa em zoom > 1 e com traços no modo janela, e focar uma janela não autorizada | O worker não tem teste unitário de quadro (`VideoFrame`/`OffscreenCanvas` não rodam no jsdom). O risco é baixo porque a mudança só remove código que nada chamava e troca a forma de obter o contexto. |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| Canal `active-window-unauthorized` sem assinante no renderer | `preload.ts`, `cursorPresence.ts` | intencional (C-2002); retirar o canal exige mudança de contrato em tarefa própria |

## 5. Testes faltantes

- Nenhum teste automatizado de quadro para o worker do cursor (limitação do jsdom; vale o smoke manual da seção 2).

## 6. Novas tasks necessárias

- Nenhuma na 020.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.12.1 | Correção em `apps/desktop` sem nova capacidade nem mudança de contrato; o commit `ci` não muda o instalador (C-2006). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — `tsc --noEmit` do desktop e `npm run lint` do monorepo sem erros, com o lint no CI e o selo de
  privacidade fora da UI. Só falta o smoke manual do professor (seção 2).
