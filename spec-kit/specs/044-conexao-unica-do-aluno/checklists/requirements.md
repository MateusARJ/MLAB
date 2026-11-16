# Checklist de Requisitos: Uma Única Conexão de Sinalização por Entrada do Aluno

Feature: `044-conexao-unica-do-aluno`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4401, RF-4402, RNF-4401 a RNF-4403) tem task.
- [x] Ambiguidades fechadas (C-4401 e C-4402): local da correção, entrega e versão.
- [x] Evidência registrada: `main.tsx` (`StrictMode`), `playwright.config.ts` (Vite dev), `useWebRTCSubscriber.ts`
  (WebSocket síncrono no efeito, `4001` → `duplicate`), `signaling/hub.go` (`onRegister`, `onUnregister`),
  `Room.tsx` (aviso da 005/C-502).
- [x] Edge case de desmontagem antes da conexão coberto (spec §9).

## Coerência

- [x] RN-04, ADR 0010, 027/RF-2704 e 005/C-502 não mudam.
- [x] Nenhum contrato muda; PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `440x` não colidem (busca por `RF-44`, `C-44`, `T44` sem resultado).

## Viabilidade

- [x] O `MockWebSocket` dos testes do hook já registra as instâncias criadas; o `renderHook` aceita `wrapper`.

## Resultado

APPROVED
