# Plan: Arrastar Arquivos para a Aba Arquivos da Sala

Feature: `018-arquivos-arrastar`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-181 a C-189)

## 1. Summary

O envio de arquivos hoje está dentro do `Room.tsx` (`handleFileUpload`, `Room.tsx:1382-1418`). Ele faz `fetch` direto
para `http://localhost:8080/rooms/{id}/files`, envia só `files[0]` e guarda um `isUploading`/`uploadMsg` global. O
plano tira o HTTP para um service, cria uma fila sequencial num hook, uma zona de soltar como componente de
apresentação e duas camadas contra navegação por drop.

```text
Explorador ──drop──▶ FileDropZone (aba Arquivos) ──onFiles──▶ useRoomFileUploads.enqueue
input[multiple] ──change────────────────────────────────────▶      │ valida pasta / 50 MB
                                                                   │ um por vez, em ordem
                                                                   ▼
                                                     services/files.uploadRoomFile ──POST multipart──▶ backend (sem mudança)
drop fora da zona ──▶ preventFileDropNavigation (window) ──preventDefault
                └──▶ (se escapar) will-navigate ──▶ navigationGuard: só o index.html do app
```

### Main — `apps/desktop/src/main/navigationGuard.ts` (RNF-181, RF-190)

1. `isAppUrl(target, devRendererUrl?, appIndexUrl?)`:
   - `file:` só é aceito quando `appIndexUrl` é informado e o `pathname` decodificado do alvo é igual ao do
     `appIndexUrl` (sem diferenciar maiúsculas no Windows), com qualquer `search`/`hash`. Sem `appIndexUrl`, `file:` é
     recusado (padrão seguro);
   - a regra de dev (`devRendererUrl`, mesma origem) não muda.
2. `hardenWebContents(contents, openExternal, devRendererUrl = env, appIndexUrl = defaultAppIndexUrl())`.
   `defaultAppIndexUrl()` = `pathToFileURL(join(__dirname, '../renderer/index.html')).href`, o mesmo caminho de
   `main.ts:207` e `annotationOverlayWindow.ts:221`. O guard é empacotado no mesmo `out/main/main.js`, então o
   `__dirname` é o mesmo. **`main.ts` e `annotationOverlayWindow.ts` não mudam**: o padrão do parâmetro cobre as duas
   janelas.
3. `file:` bloqueado continua sem `openExternal` (só http/https vão ao navegador).

### Renderer

4. **`utils/preventFileDropNavigation.ts` (RF-190):** `installFileDropGuard(target = window): () => void` registra
   `dragover` e `drop` e chama `preventDefault()` quando `event.dataTransfer?.types` inclui `Files`. No `dragover`,
   também define `dropEffect = 'none'`. Chamado uma vez em `main.tsx`, antes do `render`.
5. **`services/files.ts` (RNF-184):** `uploadRoomFile(roomId, file, token): Promise<RoomFile>`, no padrão de
   `services/room.ts`, com a constante `API_BASE_URL` local (a centralização fica fora, spec §2). POST com
   `FormData` (`file`) e `Authorization: Bearer`. Se `!resp.ok`, lança `Error(json.error || 'Erro ao enviar
   arquivo')`; erro de rede vira a mesma mensagem padrão. Também exporta `MAX_FILE_BYTES = 50 * 1024 * 1024` e
   `FILE_TOO_LARGE_MSG = 'arquivo acima do limite de 50MB'` (texto igual ao de `files.go`). O tipo `RoomFile` é
   local ao service, com os campos de `files.md`, porque `packages/types` não tem DTO de arquivo e a spec não muda
   contrato.
6. **`hooks/useRoomFileUploads.ts` (RF-183 a RF-187):**
   - entrada `{ roomId, token, onUploaded(file: RoomFile) }`;
   - estado `items: UploadItem[]`, com `{ id, name, size, status: 'aguardando'|'enviando'|'enviado'|'erro', error? }`;
   - `enqueue(entries: Array<File | { name, isDirectory: true }>)`. Pastas e arquivos acima de 50 MB entram já como
     `erro`. Se a fila não tinha item `aguardando`/`enviando`, os itens com `erro` do lote anterior são removidos
     (C-188);
   - processamento: um laço guardado por `ref` (`processingRef`) pega o próximo `aguardando`, marca `enviando`,
     aguarda `uploadRoomFile` e marca `enviado` (chama `onUploaded`) ou `erro`. Itens enfileirados durante o laço
     entram no fim (RF-187);
   - item `enviado` sai após 5 s (`setTimeout` guardado e limpo no unmount); `dismiss(id)` remove um item;
   - `isUploading = items.some(i => i.status === 'enviando')`; um `mountedRef` impede `setState` após o unmount.
7. **`components/FileDropZone.tsx` (RF-181, RF-182):** envolve `children`. Usa `dragenter`/`dragleave` com contador
   (`useRef`) para não piscar e só ativa quando `types` inclui `Files`. No `dragover`, `preventDefault()` e
   `dropEffect = 'copy'`. No `drop`, `preventDefault()` e `stopPropagation()`, zera o contador e monta as entradas a
   partir de `dataTransfer.items` (`webkitGetAsEntry()?.isDirectory` → pasta; senão `getAsFile()`), com fallback
   para `dataTransfer.files`. Depois chama `onFiles(entries)`. Com o destaque ativo, mostra uma camada absoluta
   (borda tracejada `#38bdf8`, fundo translúcido) com "Solte para compartilhar" e `data-testid="file-drop-overlay"`.
8. **`pages/Room.tsx` (RF-188, RF-189):**
   - remove `isUploading`, `uploadMsg` e `handleFileUpload`;
   - `const { items: uploadItems, enqueue, dismiss, isUploading } = useRoomFileUploads({ roomId: room?.id, token,
     onUploaded: (f) => setUploadedFiles((prev) => [...prev, f]) })`;
   - `<input type="file" multiple onChange>` → `enqueue(Array.from(files))` e limpa o `value`;
   - `filesTabContent` fica dentro de `<FileDropZone onFiles={enqueue}>`;
   - o banner único vira a lista `uploadItems` (nome, estado em texto, mensagem de erro e botão "Dispensar" nos
     erros), com `role="status"`/`aria-live="polite"`;
   - o botão, o texto "Enviando Arquivo..." e a lista "Arquivos Compartilhados Nesta Aula" ficam como estão. A
     listagem inicial (`Room.tsx:1213-1226`) não muda.

### Documentos

9. `003/spec.md` (US-16): nota "arrastar arquivos para a aba Arquivos, com envio em sequência (018)". Smoke `A13b`
   em `docs/metrics/smoke-runbook.md` e `scripts/smoke-report.js`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Endpoint | `POST /rooms/{roomId}/files`, multipart `file`, sem mudança | RNF-183 |
| Fila | sequencial, um `fetch` por vez, ordem de chegada | RF-183, C-186 |
| Pré-validação | 50 MB e pasta, no hook | RF-186, C-184, C-185 |
| Detecção de pasta | `DataTransferItem.webkitGetAsEntry().isDirectory` | C-185 |
| Guard do main | `file:` só para o `index.html` do app | RNF-181, C-182 |
| Guard do renderer | `preventDefault` em `dragover`/`drop` com `Files` | RF-190 |
| Tipos | `RoomFile`/`UploadItem` locais ao desktop; nada em `packages/types` | Princípio VII |
| Testes | vitest + jsdom + testing-library; `DataTransfer` falso nos eventos; `fetch` mockado com `vi.fn` | — |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Comparação de caminho `file:` falha no Windows (maiúsculas, `%20`) | o app não consegue recarregar a própria página | comparar `pathname` decodificado, sem maiúsculas no Windows; testes com espaço e letras diferentes; smoke no instalador |
| `__dirname` do guard diferente do de `main.ts` | o guard bloqueia o próprio app | o guard é empacotado no mesmo `out/main/main.js`; smoke A13b no app empacotado confere janela e overlay |
| Destaque pisca ao passar por filhos | UI instável | contador de `dragenter`/`dragleave`; teste |
| `setState` após desmontar a sala no meio da fila | warning/vazamento | `mountedRef` e `clearTimeout` no unmount; teste |
| jsdom não tem `DataTransfer` | testes frágeis | objeto falso com `types`, `files` e `items` passado no `fireEvent` |
| `tsc --noEmit` do desktop já falha (#51) | typecheck não serve de gate | gate: nenhum erro novo nos arquivos tocados (linha de base: 14 erros) |

## Scope Lock

### IN

- guard de navegação do main restrito ao `index.html` do app;
- bloqueio global de drop de arquivos no renderer;
- service de envio, hook de fila e componente de zona de soltar;
- integração na aba Arquivos do `Room` (zona, seleção múltipla, lista de estados);
- nota na 003 (US-16) e smoke `A13b`.

### OUT

- backend, web app dos alunos, contrato `files.md` e `packages/types`;
- bloqueio de tipos (415) e headers de download;
- progresso em bytes, cancelamento, reenvio, envio paralelo, envio de pastas;
- troca automática de aba; centralização de `API_BASE_URL`.

### Allowed Paths

- `apps/desktop/src/main/navigationGuard.ts`, `apps/desktop/src/main/navigationGuard.test.ts`
- `apps/desktop/src/renderer/main.tsx` (só a chamada do guard)
- `apps/desktop/src/renderer/utils/preventFileDropNavigation.ts` (+ `.test.ts`)
- `apps/desktop/src/renderer/services/files.ts` (+ `.test.ts`)
- `apps/desktop/src/renderer/hooks/useRoomFileUploads.ts` (+ `.test.ts`)
- `apps/desktop/src/renderer/components/FileDropZone.tsx` (+ `.test.tsx`)
- `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/RoomFileDrop.test.tsx`,
  `apps/desktop/src/renderer/pages/Room.test.tsx` (só se um teste existente depender do banner antigo)
- `spec-kit/specs/003-classroom-interaction/spec.md` (só nota de referência)
- `docs/metrics/smoke-runbook.md`, `scripts/smoke-report.js`
- `spec-kit/specs/018-arquivos-arrastar/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (só pelo `npm run bump`)

### Prohibited Paths

- `apps/backend/**`, `apps/web/**`
- `packages/types/**`, `packages/ui/**`
- `spec-kit/specs/003-classroom-interaction/contracts/**`
- `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/annotationOverlayWindow.ts`,
  `apps/desktop/src/main/preload.ts`
- `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`, `apps/desktop/src/renderer/media/**`
- `apps/desktop/src/renderer/services/room.ts`, `apps/desktop/src/renderer/services/auth.ts`
- `apps/desktop/package.json` fora do `npm run bump`; `apps/desktop/electron-builder*`

### Dependencies

- Nenhuma nova. Existentes: `electron`, `react`, `@mlab/ui` (ícones já usados na aba), `vitest`,
  `@testing-library/react`, `jsdom`.

### Non-Goals

- validar tipo de arquivo ou mudar headers de download;
- mudar limites ou mensagens do servidor;
- corrigir os erros de `tsc` da #51.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: limites e autorização continuam no servidor; a pré-validação é só conveniência (RNF-182).
- [x] Princípio III: SFU e mídia intocados.
- [x] Princípio IV: sem meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda; `files.md` consumido como está.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: tipos locais, sem abstração genérica; hook e componente têm um consumidor cada (o `Room`).
- [x] Princípio IX: o escopo retirado da #46 (415/headers) vira issue própria (T186).
- [ ] Princípio VIII: converge ao final (T186).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-10 | Só drag-and-drop; 415 e headers em issue própria | C-181 |
| 2026-11-10 | Renderer + guard do main restrito ao `index.html` | C-182 |
| 2026-11-10 | Feature `018`, IDs `18x` | C-183 |
| 2026-11-10 | Pré-validação de 50 MB e pasta no app | C-184, C-185 |
| 2026-11-10 | Fila sequencial que aceita itens durante o envio; erro não para a fila | C-186, C-187 |
| 2026-11-10 | Botão com `multiple` na mesma fila; lista de estados | C-188 |
| 2026-11-10 | Guard via parâmetro padrão, sem tocar em `main.ts`/overlay | plan §1.2 |
| 2026-11-10 | Versão MINOR | C-189 |
