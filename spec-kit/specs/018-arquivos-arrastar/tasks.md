# Tasks: Arrastar Arquivos para a Aba Arquivos da Sala

Feature: `018-arquivos-arrastar`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados; nenhum contrato muda
Status: READY

Regras:
- task de desktop: `npm test` em `apps/desktop` verde antes do `[x]`, com os testes novos falhando sem a mudança;
- `npm run lint` (`tsc --noEmit`) do desktop já falha na `development` (#51, 14 erros): o gate é **nenhum erro
  novo** nos arquivos tocados pela task;
- um commit atômico por task, com `Ref: T18x` e `Refs #46`.

### T181 — Guard de navegação restrito ao index.html do app
[x] T181
Allowed Paths: `apps/desktop/src/main/navigationGuard.ts`, `apps/desktop/src/main/navigationGuard.test.ts`
Prohibited Paths: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/annotationOverlayWindow.ts`,
`apps/desktop/src/main/preload.ts`, `apps/desktop/src/renderer/**`, `packages/**`, `apps/backend/**`, `apps/web/**`
Checks:
- [x] `isAppUrl` aceita o `index.html` do app com e sem `?overlay=annotation`/hash, inclusive com `%20` e, no
  Windows, com letras em caixa diferente (RNF-181).
- [x] `isAppUrl` recusa outro `file://` (ex.: `file:///C:/Users/x/doc.pdf`) e qualquer `file:` sem `appIndexUrl`.
  Também recusa `file://` com outro host (UNC).
- [x] `hardenWebContents` com `appIndexUrl`: `will-navigate` para outro `file://` recebe `preventDefault` e não
  chama `openExternal`; o `index.html` do app navega; dev e http/https como antes.
- [x] O padrão de `appIndexUrl` é `pathToFileURL(join(__dirname, '../renderer/index.html'))` (`defaultAppIndexUrl`);
  `main.ts` e overlay sem mudança.
- [x] `npm test` verde (18 arquivos, 170 testes; 5 novos, que falham com o guard antigo); `tsc` com os mesmos 14
  erros da #51, nenhum em `navigationGuard.ts`. O comportamento no app empacotado fica para o smoke A13b.

### T182 — Bloqueio global de drop de arquivos no renderer
[x] T182
Allowed Paths: `apps/desktop/src/renderer/utils/preventFileDropNavigation.ts`,
`apps/desktop/src/renderer/utils/preventFileDropNavigation.test.ts`, `apps/desktop/src/renderer/main.tsx`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/renderer/pages/**`, `packages/**`,
`apps/backend/**`, `apps/web/**`
Checks:
- [x] `dragover` e `drop` com `types` contendo `Files` ficam com `defaultPrevented` (RF-190); no `dragover`,
  `dropEffect = 'none'`.
- [x] Eventos sem `Files` (texto/link) não são alterados.
- [x] A função retorna um cancelamento que remove os listeners.
- [x] `main.tsx` instala o guard uma vez, antes do `render` (vale também para a janela do overlay, que usa o mesmo
  entry).
- [x] `npm test` verde (19 arquivos, 174 testes; 4 novos); `tsc` com os mesmos 14 erros da #51, nenhum nos arquivos
  tocados; `electron-vite build` ok.

### T183 — Service de envio e fila sequencial
[x] T183
Allowed Paths: `apps/desktop/src/renderer/services/files.ts`, `apps/desktop/src/renderer/services/files.test.ts`,
`apps/desktop/src/renderer/hooks/useRoomFileUploads.ts`, `apps/desktop/src/renderer/hooks/useRoomFileUploads.test.ts`
Prohibited Paths: `apps/desktop/src/renderer/services/room.ts`, `apps/desktop/src/renderer/services/auth.ts`,
`apps/desktop/src/renderer/pages/**`, `apps/desktop/src/main/**`, `packages/**`, `apps/backend/**`, `apps/web/**`
Checks:
- [x] `uploadRoomFile` faz POST multipart `file` com `Authorization: Bearer` para `/rooms/{id}/files` e devolve o
  JSON 201 (RF-183).
- [x] Resposta 413/403 lança com o `error` do servidor; resposta sem JSON ou falha de rede lança "Erro ao enviar
  arquivo" (RF-185).
- [x] Hook: 3 arquivos são enviados em ordem, e o 2º `fetch` só começa depois do 1º resolver; o estado passa por
  `enviando` (RF-183, RF-184).
- [x] Hook: erro no 2º marca só ele e o 3º é enviado (RF-185, C-187).
- [x] Hook: arquivo > 50 MB e pasta viram `erro` sem `fetch`; exatamente 50 MB é enviado (RF-186).
- [x] Hook: `enqueue` durante o envio adiciona ao fim (RF-187); item enviado sai após 5 s; `dismiss` remove; erros
  do lote anterior saem quando um lote novo começa (RF-184).
- [x] Hook: `onUploaded` recebe o arquivo do servidor; após o unmount, a fila para, nada de `setState` e o timer é
  limpo.
- [x] `npm test` verde (21 arquivos, 187 testes; 13 novos); `tsc` com os mesmos 14 erros da #51, nenhum nos arquivos
  tocados.

### T184 — Zona de soltar e integração na aba Arquivos
[x] T184
Depends On: T182, T183
Allowed Paths: `apps/desktop/src/renderer/components/FileDropZone.tsx`,
`apps/desktop/src/renderer/components/FileDropZone.test.tsx`, `apps/desktop/src/renderer/pages/Room.tsx`,
`apps/desktop/src/renderer/pages/RoomFileDrop.test.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`, `apps/desktop/src/renderer/media/**`,
`apps/desktop/src/renderer/services/room.ts`, `apps/desktop/src/main/**`, `packages/**`, `apps/backend/**`,
`apps/web/**`
Checks:
- [x] `FileDropZone`: o destaque "Solte para compartilhar" aparece no `dragenter` com `Files`, não pisca ao passar
  por filhos, some no `dragleave` final e no `drop`; arraste sem `Files` não ativa (RF-182).
- [x] `FileDropZone`: o `drop` chama `onFiles` com arquivos e pastas identificadas e não propaga para o `window`.
- [x] `Room`, aba Arquivos: o drop de 1 e de 3 arquivos mostra os estados e adiciona à lista "Arquivos
  Compartilhados Nesta Aula" (RF-181, RF-184, RF-189).
- [x] `Room`: o 413 mostra a mensagem do servidor no item, com "Dispensar" (RF-185).
- [x] `Room`: o input tem `multiple` e usa a mesma fila; o botão mostra "Enviando Arquivo..." e fica desabilitado
  durante o envio (RF-188). Texto de apoio "ou arraste arquivos para esta aba" abaixo do botão.
- [x] `Room`: o `fetch` de upload não fica mais no `Room.tsx`; a listagem inicial não muda.
- [x] Testes existentes do `Room` verdes (sem mudança no `Room.test.tsx`); `npm test` verde (23 arquivos, 198
  testes; 11 novos, e os 4 do `RoomFileDrop` falham com o `Room.tsx` antigo); `tsc` com os mesmos 14 erros da #51
  (`Room.tsx:96`, antigo `:94`, só deslocado); `electron-vite build` ok.

### T185 — Nota na 003 e item de smoke A13b
[x] T185
Depends On: T181, T184
Allowed Paths: `spec-kit/specs/003-classroom-interaction/spec.md`, `docs/metrics/smoke-runbook.md`,
`scripts/smoke-report.js`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/specs/003-classroom-interaction/contracts/**`
Checks:
- [x] US-16 da 003 ganha a nota "arrastar arquivos para a aba Arquivos, com envio em sequência (018)"; nada é
  reescrito.
- [x] Roteiro `A13b` no runbook, no app **empacotado**: arrastar 1 e depois 5 arquivos; 1 arquivo > 50 MB; 1 pasta;
  soltar um PDF fora da zona e com outra aba aberta (a janela não navega); seleção múltipla pelo botão; o aluno no
  celular vê e baixa os arquivos; overlay de marcação continua abrindo (guard).
- [x] `scripts/smoke-report.js` lista `A13b` como `manual` (`node --check` ok; o relatório gerado mostra `A13b`
  `PENDENTE` — os arquivos gerados não foram versionados).

### T186 — Smoke, converge, issue do escopo retirado e versão
[ ] T186
Depends On: T185
Allowed Paths: `spec-kit/specs/018-arquivos-arrastar/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json` (só pelo `npm run bump`)
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`
Checks:
- [ ] Smoke `A13b` executado e relatado pelo responsável; evidência registrada no `converge.md`.
- [ ] Issue própria para o bloqueio de executáveis (415) e os headers de download, aberta pelo template de desvio
  depois de buscar duplicata, e citada no `converge.md` e na #46 (C-181).
- [ ] `converge.md` compara código × spec/plan/tasks e registra gaps, desvios e o nível de versão.
- [ ] `npm run bump -- minor` (1.11.0 → 1.12.0) e `npm run version:check` verdes; commit
  `chore(release): versao 1.12.0`.
- [ ] `npm run spec:check -- spec-kit/specs/018-arquivos-arrastar` verde.
