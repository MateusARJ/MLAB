# Clarify: Endurecimento de Segurança

Feature: `002-security-hardening`
Status: CLOSED

## C-201 — Backend executado fora do app e do `npm run dev`

- **Contexto:** a chave de host é gerada pelo app desktop ou por `scripts/dev.js`.
- **Resposta aprovada:** um backend iniciado manualmente (`go run`, binário avulso) precisa receber `MLAB_HOST_KEY` por variável de ambiente para permitir sessão de professor; sem ela, a sessão é recusada (ADR 0006). O fluxo suportado em desenvolvimento é `npm run dev`.

## C-202 — Limites de arquivos por sala

- **Resposta aprovada (D6):** 300 MB e 50 arquivos por sala, configuráveis por `MLAB_ROOM_FILES_MAX_MB` e `MLAB_ROOM_FILES_MAX_COUNT`. Limite por arquivo continua 50 MB.

## C-203 — Sandbox do Electron

- **Resposta aprovada:** ligar `sandbox: true` depois de mover a escrita na área de transferência para o processo principal. Se o build empacotado falhar em algum item da matriz de smoke, manter `sandbox: false` e registrar exceção no `converge.md` desta feature, sem bloquear as demais tasks.

## C-204 — `request-keyframe` sem checagem de papel

- **Contexto:** achado durante a fase F4; não estava entre S1–S8 aprovadas.
- **Resposta original:** fora do escopo da execução S1–S8; registrado como proposta S9.
- **Decisão (2026-11-01):** o dono do produto aprovou a S9. Bloquear alunos quebraria funcionalidade em uso: o
  web app envia `request-keyframe` ao conectar (`useWebRTCSubscriber.ts`, imediato e após 300 ms) e quando o
  watchdog detecta vídeo congelado ou `stalled`/`waiting` (`Room.tsx`, no máximo a cada 500 ms). Por isso a S9
  é um **limite de frequência por aluno**: rajada de 3 pedidos, recarga de 1 por segundo, excedente descartado
  sem erro (o cliente não trata erro dessa mensagem e o aluno não deve ver aviso). Professor sem limite no hub.
  O cooldown de PLI da SFU (350 ms, `internal/webrtc/room.go`) permanece e não é alterado.

## C-205 — Token de arquivo na URL

- **Resposta aprovada:** aceitar `?token=` no download (mesmo padrão do WebSocket), porque links `<a href download>` não enviam header. Risco aceito em LAN: o token pode aparecer em logs locais; ele expira em 6h.

## Resultado

CLOSED — C-201 a C-205 respondidas (C-204 decidida em 2026-11-01); nenhuma ambiguidade em aberto.
