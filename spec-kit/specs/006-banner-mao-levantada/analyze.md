# Analyze: Aviso de Mão Levantada Responsivo

Feature: `006-banner-mao-levantada`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. A feature muda só a apresentação do aviso; US-11, RF-301 e RN-301 da 003 continuam como estão (RN-601).
O uso do `Button` e dos tokens segue `docs/design-system.md` §5.1 e §2.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-601 | T601, T602 |
| RF-602 | T601 |
| RF-603 | T601 |
| RNF-601 | T601 |

## 3. Contratos

Nenhum contrato alterado: `raise-hand` e `hand-updated` (003) não mudam.

## 4. Tarefas fora do Scope Lock

Nenhuma. T601 altera só `Room.tsx`/`Room.test.tsx`; T602 só `e2e/aluno.e2e.ts`; T603 só a pasta da feature.
`fixtures.ts`, `playwright.config.ts`, hooks e `packages/**` estão proibidos.

## 5. Riscos

- Aviso sobre os controles no landscape mobile — mitigado pela posição no topo e pela verificação mobile (T602).
- Altura do `Button` no desktop — mitigada por `size="sm"`.

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T601.
