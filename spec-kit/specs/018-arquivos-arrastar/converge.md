# Converge: Arrastar Arquivos para a Aba Arquivos da Sala

Feature: `018-arquivos-arrastar`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md` e o `analyze.md` são escritos)
Data: 2026-11-11
Commit avaliado: `b5a01e3`
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-181 a C-190), `plan.md`, `tasks.md` (T181–T187), contrato
  `003/contracts/files.md` (consumido sem mudança)
- código: `apps/desktop/src/main/navigationGuard.ts`,
  `apps/desktop/src/renderer/{main.tsx,pages/Room.tsx,services/files.ts,hooks/useRoomFileUploads.ts,components/FileDropZone.tsx,utils/preventFileDropNavigation.ts}`,
  `apps/web/src/pages/Room.tsx`
- suítes: desktop `vitest run` (23 arquivos, 199 testes verdes); web `vitest run` (4 arquivos, 42 testes verdes);
  `tsc --noEmit` do desktop com os mesmos 14 erros da #51, nenhum nos arquivos da 018; `npm run spec:check` (PASS)
- smoke manual A13b (2026-11-11): roteiro `docs/metrics/smoke-runbook.md` (A13b) executado pelo responsável no app
  empacotado a partir da branch `feat/arquivos-arrastar`, que relatou todos os passos funcionando, incluindo a
  rolagem da lista de arquivos no aluno (T187)

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-181 | `FileDropZone` envolve a aba Arquivos do `Room`; `RoomFileDrop.test.tsx` (`9ad6d68`); A13b |
| RF-182 | destaque "Solte para compartilhar" com contagem de entrada/saída; `FileDropZone.test.tsx` (`9ad6d68`); A13b |
| RF-183 | `useRoomFileUploads` envia um por vez via `services/files.ts`; testes de ordem e de `fetch` sequencial (`31c1b52`) |
| RF-184 | estados `aguardando`/`enviando`/`enviado`/`erro` por item; testes do hook (`31c1b52`) e do `Room` (`9ad6d68`) |
| RF-185 | erro do 2º item não interrompe o 3º; 413 mostra o `error` do servidor com "Dispensar"; testes do service, hook e `Room` |
| RF-186 | > 50 MB e pasta viram `erro` sem `fetch`; exatamente 50 MB é enviado; testes do hook (`31c1b52`); A13b |
| RF-187 | `enqueue` durante o envio vai para o fim; teste do hook (`31c1b52`) |
| RF-188 | botão mantido, input com `multiple` na mesma fila, "Enviando Arquivo..." desabilitado; teste do `Room` (`9ad6d68`) |
| RF-189 | `onUploaded` adiciona à lista "Arquivos Compartilhados Nesta Aula"; teste do `Room` (`9ad6d68`) |
| RF-190 | `preventFileDropNavigation` no `main.tsx` (`9801512`) e guard restrito ao `index.html` (`2a10046`); testes; A13b |
| RF-191 | `scrollIntoView` no marcador do fim (web: gaveta e celular; desktop: lista da aula); testes (`b5a01e3`); A13b |
| RNF-181 | `isAppUrl` aceita só o `index.html` do app (com `?overlay=annotation`, hash e `%20`); testes do guard (`2a10046`) |
| RNF-182 | limites seguem no servidor; a pré-validação só evita requisição inútil; 413/403 vêm do backend |
| RNF-183 | nenhum arquivo de `apps/backend/**` ou `packages/**`; contrato `files.md` sem mudança; web só com a rolagem |
| RNF-184 | service (`services/files.ts`), hook (`useRoomFileUploads.ts`) e componente (`FileDropZone.tsx`) separados; o `fetch` saiu do `Room.tsx` |
| RNF-185 | nenhuma dependência nova (só o bump altera `package.json`) |
| RN-181 | limites aplicados pelo servidor; o app não infere o limite da sala |
| RN-182 | zona de soltar só no app do professor |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma; `files.md` e `desktop-ipc.md` consumidos sem mudança |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Nenhum automatizado. Limite registrado: o jsdom não tem `DataTransfer` real; o arraste do Explorador e o guard no
  app empacotado ficam cobertos pelo smoke A13b.

## 6. Novas tasks necessárias

- Nenhuma na 018.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #64 — bloqueio de executáveis no upload (415) e headers de download | enhancement, desvio, area:desktop, area:backend | não | aberta; escopo retirado da #46 por decisão do responsável (C-181) e citado na #46 |
| #65 — lista de arquivos do celular ocupa só metade da altura da tela | bug, desvio, area:web | não | aberta; achada no smoke A13b; o limite de altura (`maxHeight` do `filesList`) é anterior à 018 |
| #51 — `tsc --noEmit` do desktop falha com 14 erros na `development` | bug, desvio, area:desktop | não | aberta; mesma contagem antes e depois, nenhum erro nos arquivos da 018 |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.12.0 | Funcionalidade nova compatível: US-181 a US-183 e RF-181 a RF-191 (arrastar arquivos, fila sequencial, rolagem automática da lista). Nenhum contrato HTTP, WebSocket ou IPC muda. |

## 9. Resultado

- [ ] OPEN — há gaps registrados acima com encaminhamento definido.
- [x] CONVERGED — código, testes automatizados e smoke manual A13b convergem com spec/plan/tasks; os desvios estão
  nas issues #64 e #65.
