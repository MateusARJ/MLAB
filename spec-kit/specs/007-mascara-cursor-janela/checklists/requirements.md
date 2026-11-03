# Checklist de Requisitos: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-701 a RF-707, RNF-701 a RNF-703) tem task.
- [x] Ambiguidades fechadas (C-701, C-702, C-703, C-704).
- [x] Causa do defeito registrada com evidência (commit `29c54d0`; `cursorMask.worker.ts:366-370`; revisão do PR #26).

## Coerência

- [x] Regra de visibilidade da 003 (`isCursorVisibleWindowMode`) inalterada (RN-701).
- [x] Conflito com o US-20 / RF-310 da 003 (tela cheia) resolvido por emenda (C-702, T704), não por omissão.
- [x] Nenhuma dependência nova; contratos inalterados.
- [x] Critérios mensuráveis: orçamento de 8 ms, FPS ≥ 95% do alvo, resolução e keyframes na medição A/B.

## Viabilidade

- [x] Decisão por quadro e proteção de FPS testáveis em vitest (módulo puro).
- [x] Máscara e desempenho validáveis só no app real: medição A/B e smoke A12 manuais (T705).

## Resultado

APPROVED
