# Checklist de Requisitos: Fixar uma Janela na Transmissão de Múltiplas Janelas

Feature: `032-fixar-janela-transmissao`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3201 a RF-3211, RNF-3201 a RNF-3203) tem task.
- [x] Ambiguidades fechadas (C-3201 a C-3206): base, cursor/lupa, janela fechada/minimizada, atalho e barra, clique no
  nome, gravação/testes/versão.
- [x] Evidência registrada: `cursorPresence.ts` (`tick`, `currentTargetWindowId`, `active-window-changed`),
  `Room.tsx` (efeito de foco, `handleSwitchScreen`, seletor "Janelas da Aula"), `useScreenCapture.ts`
  (`selectSource`, `startCursorTracking`), na `development` @ `c3a2f8b` (issue #91).
- [x] Edge cases cobertos: sem rastreador nativo, troca recusada, foco no MLab ou em janela não autorizada, corrida de
  eventos, janela minimizada.
- [x] Todos os critérios de aceite da issue #91 mapeados para RF (Fixar acessível: RF-3201; foco ignorado: RF-3203;
  desfixar troca/não troca: RF-3204; volta a seguir o foco: RF-3204; substituição: RF-3202; texto: RF-3205;
  reconfigurar/encerrar: RF-3206; sem fixação idêntico: RF-3210; testes com `onActiveWindowChanged`: T3203/T3205;
  contrato: RNF-3201).

## Coerência

- [x] Respeita a US-09/RN-20 da 001: toda troca usa `changeStream` (`replaceTrack`), sem desconectar.
- [x] Mantém a regra de visibilidade do cursor da 003/007 (RN-701), aplicada à janela fixada (RF-3208).
- [x] Mudança de IPC compatível e registrada em `003/contracts/desktop-ipc.md`; `packages/types` intocado.
- [x] Arquitetura SFU intocada: uma única upstream; nenhuma decodificação no servidor.
- [x] Sem dependência nova; versão MINOR coerente com `docs/versionamento.md` §2.
- [x] IDs `320x`/`321x` com quatro dígitos não colidem com outras features.

## Viabilidade

- [x] `Room.test.tsx` já captura o callback de `onActiveWindowChanged` no teste de múltiplas janelas.
- [x] `apps/desktop/src/test/setup.ts` já simula `startCursorTracking` e `onActiveWindowChanged`.
- [x] `nativeWindowTracker.test.ts` e `annotationOverlayWindow.test.ts` mostram como simular `electron` no main.
- [x] `MediaStreamTrack.stop()` não dispara `ended`; só o fim da fonte dispara, então trocas normais não desfixam.

## Resultado

APPROVED
