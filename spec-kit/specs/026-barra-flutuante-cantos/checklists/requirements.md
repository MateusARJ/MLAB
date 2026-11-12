# Checklist de Requisitos: Barra Flutuante de Marcação nos Cantos da Tela

Feature: `026-barra-flutuante-cantos`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2601 a RF-2606, RNF-2601 a RNF-2603) tem task.
- [x] Ambiguidades fechadas (C-2601 a C-2604): reabertura, contrato, orientação, ADR e versão.
- [x] Evidência registrada: `FloatingAnnotationOverlay.tsx` na `development` @ `e997fc8`.
- [x] Todos os caminhos que trocam `collapsed` estão cobertos: botão, bolinha, `Alt+H`, tecla `h` e sincronização.
- [x] Edge cases cobertos: tela menor que a barra, troca de orientação no ajuste, mudança de resolução.

## Coerência

- [x] Contrato `AnnotationSessionState` inalterado (C-2602, RNF-2601).
- [x] Indicador de mãos (017) e hit-test do Linux (009) preservados (RNF-2602).
- [x] Posições só na sessão, como antes (RF-2601).
- [x] Sem ADR; versão PATCH coerente com `docs/versionamento.md` §2 (C-2604).
- [x] IDs da faixa `260x` não colidem com outras features.

## Viabilidade

- [x] O tamanho da barra pode ser medido no renderer (`getBoundingClientRect`) e simulado no jsdom.
- [x] O main repassa `toolbarPos` sem interpretá-lo (`annotationOverlayWindow.ts`, `syncState`).

## Resultado

APPROVED
