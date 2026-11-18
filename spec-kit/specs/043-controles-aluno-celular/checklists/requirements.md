# Checklist de Requisitos: Controles do Aluno no Celular

Feature: `043-controles-aluno-celular`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4301 a RF-4307, RNF-4301 a RNF-4303) tem task.
- [x] Ambiguidades fechadas (C-4301 a C-4303): X mantido, layout, rótulo curto e versão.
- [x] Evidência registrada: `Room.tsx` (`handPos`, `videoOverlayControls`, `fullscreenMenuBtn`,
  `fullscreenSidebarHeader`, `closeDrawerBtn`) e medidas da issue #98.
- [x] Edge cases cobertos: largura insuficiente, drawers abertos em tela cheia.

## Coerência

- [x] RF-22 (001, PiP e tela cheia) não muda: os botões e suas ações continuam.
- [x] Testes existentes que usam `fullscreen-menu-trigger` seguem válidos; nenhum usa o X do cabeçalho.
- [x] E2E A15 usa os nomes acessíveis "Levantar mão"/"Abaixar mão", que não mudam (RF-4303).
- [x] PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `430x` não colidem (busca por `RF-43`, `C-43`, `T43` sem resultado).

## Viabilidade

- [x] Media query possível via `apps/web/src/index.css`, já importado pelo web.

## Resultado

APPROVED
