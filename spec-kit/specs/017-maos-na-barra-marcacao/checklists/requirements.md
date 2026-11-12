# Checklist de Requisitos: Mãos Levantadas na Barra de Marcação

Feature: `017-maos-na-barra-marcacao`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-171 a RF-180, RNF-171 a RNF-175, RN-171, RN-172) tem task (ver `analyze.md` §2).
- [x] Os pontos de clarify da issue #45 estão fechados (C-171 a C-179): borda, visibilidade no vídeo, clique, zero
  mãos, limite do badge, janela não transmitida, canal, itens fora de escopo e versão.
- [x] Situação atual registrada com evidência no código: a contagem só aparece dentro do MLab (`Room.tsx:2325`,
  `:2363`, `:2850`); a barra flutuante aparece com o MLab fora de foco (`FloatingAnnotationOverlay.tsx:985`); o
  estado sincronizado não carrega mãos (`AnnotationSessionState`, `packages/types/src/index.ts:331`).

## Coerência

- [x] A 003 (US-11, US-19) recebe só uma nota apontando para a 017; nada é reescrito.
- [x] Contrato: duas entradas novas e compatíveis em `003/contracts/desktop-ipc.md`; `AnnotationSessionState` e o
  canal `annotation-overlay:sync-state` não mudam.
- [x] Sem dependência nova e sem ADR: não muda stack, captura, autenticação nem contrato global (AGENTS §9).
- [x] Desvio encontrado na análise (comentário do preload sobre a captura) registrado na #62 e fora do escopo.
- [x] RN-171 (indicador no vídeo em tela cheia) é decisão explícita do responsável (C-172), não omissão.

## Viabilidade

- [x] Main testável com os fakes de `BrowserWindow` já usados em `annotationOverlayWindow.test.ts`.
- [x] Barra e `Room` testáveis com vitest + jsdom e os mocks de `window.electronAPI` (`src/test/setup.ts`).
- [x] Gate de `tsc` definido apesar da #51: nenhum erro novo nos arquivos tocados.
- [x] Smoke manual possível com um PC e um celular na mesma rede (A15b).

## Resultado

APPROVED
