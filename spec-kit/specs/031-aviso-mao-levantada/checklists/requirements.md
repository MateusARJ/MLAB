# Checklist de Requisitos: Aviso de Mão Levantada Clicável e Sincronizado com a Fila

Feature: `031-aviso-mao-levantada`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3101 a RF-3106, RNF-3101, RNF-3102) tem task.
- [x] Ambiguidades fechadas (C-3101 a C-3104): fila, painel, camada, testes, versão.
- [x] Evidência registrada: `Room.tsx` (`annotationCanvasOverlay`, `handToastOverlay`, `previewStageBox`),
  `useWebRTCPublisher.ts` (`lastHandRaised`, `hand-updated`, `lowerStudentHand`, `participants-update`), na
  `development` @ `91ae79a` (issue #90).
- [x] Edge cases cobertos: levantar de novo, `participants-update` com mão levantada, popover sobre o aviso.

## Coerência

- [x] US-11 da 003 já exige o aviso; esta feature restaura o critério, sem requisito novo de produto.
- [x] Mensagens WebSocket e contratos da 003 não mudam.
- [x] Sem dependência nova; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs `310x` com quatro dígitos não colidem com `RF-310`/`T310` da 003.

## Viabilidade

- [x] `RoomHandRaise.test.tsx` já renderiza o aviso com o hook mockado.
- [x] Estilos inline permitem ler `style.zIndex` no jsdom.
- [x] A limpeza cabe em updater funcional do `useState`, sem refs novas.

## Resultado

APPROVED
