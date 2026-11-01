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
- **Resposta aprovada:** fora do escopo desta execução. Registrado em `001/converge.md` como proposta de task S9, aguardando decisão do dono do produto. Nenhum agente implementa sem aprovação.

## C-205 — Token de arquivo na URL

- **Resposta aprovada:** aceitar `?token=` no download (mesmo padrão do WebSocket), porque links `<a href download>` não enviam header. Risco aceito em LAN: o token pode aparecer em logs locais; ele expira em 6h.

## Resultado

CLOSED — C-201 a C-205 respondidas; nenhuma ambiguidade em aberto.
