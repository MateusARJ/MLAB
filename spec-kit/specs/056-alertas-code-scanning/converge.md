# Converge: Correção dos Alertas do Code Scanning

Feature: `056-alertas-code-scanning`
Status: DONE
Branch: `fix/alertas-code-scanning`, a partir da `main` @ `e5de09d` (2.3.2)

## 1. Evidências

- Antes: 8 alertas abertos do CodeQL na `main` (#1 `go/path-injection`, #2 e #3 `js/regex-injection`, #4 e #5
  `js/client-side-unvalidated-url-redirection`, #6 e #7 `js/xss`, #8 `js/incomplete-sanitization`).
- Depois: a análise do CodeQL do PR #176 (`refs/pull/176/head` @ `4cfa7ba`, o último commit de código) teve 0
  resultados em `go`, `javascript-typescript`, `actions` e `python`, e nenhum alerta aberto na ref do PR.
- Web: `npm test` (81 testes) e `npm run lint` verdes; os testes novos conferem o `href` montado por
  `roomInfo.room_id` + `file.id` com `url: 'javascript:...'` no payload, nas gavetas do desktop e do celular.
- Backend: `go test ./...` e `go vet ./...` verdes; `gofmt -l` vazio nos arquivos alterados (conferido sobre o
  conteúdo com LF, porque a cópia de trabalho do Windows usa CRLF). Os testes novos cobrem `..`, `%2f` e `%5c` sem
  servir arquivo de fora da pasta web.
- Desktop: `npm test` (411 testes) e `npm run lint` verdes; o snapshot da saída exata do SDP (VP8, H264 e Opus, em
  30 e 60 fps) foi gravado antes da mudança e continua igual depois dela.
- Script: `node --check` OK; a expressão de escape verificada com entradas que têm barra vertical e barra invertida.
- `npm run spec:check` com PASS em todas as features.

### Validação manual (2026-11-20, depois do merge do PR #176, na 2.3.3)

Feita pelo responsável no app rodando, com a web do aluno compilada e servida pelo backend:

- RF-5602: `curl.exe --path-as-is http://localhost:8080/../go.mod` recebe o `307` do `http.ServeMux` para `/go.mod`;
  seguindo o redirecionamento (`-L`), a resposta é o `index.html` da web do aluno, sem o conteúdo do `go.mod`.
  `/..%5c..%5cgo.mod` recebe `400 invalid URL path`; a rota de entrada do aluno carrega a página normalmente.
- RF-5601: o `href` do botão "Baixar" ficou em `/rooms/<sala>/files/<arquivo>/download?token=...`, com o nome do
  arquivo no atributo `download`; o download funcionou na gaveta "Arquivos da Aula" (desktop) e na aba "Arquivos" em
  largura de celular.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-5601 | `fileDownloadPath` em `apps/web/src/services/api.ts`; dois `href` de `Room.tsx`; testes em `api.test.ts` e `Room.test.tsx` |
| RF-5602 | `isWebFile` em `apps/backend/cmd/server/main.go`; `TestSpaHandler_NaoSaiDaPastaWeb` e `TestIsWebFile` |
| RF-5603 | `escapeRegExp` em `useWebRTCPublisher.ts`; snapshot em `useScreenCapture.test.ts` |
| RF-5604 | escape de barra invertida em `scripts/smoke-report.js` |
| RNF-5601 | suítes de web, desktop e backend verdes; nenhum contrato ou rota alterado |
| RNF-5602 | nenhuma dependência nova |
| RNF-5603 | análise do CodeQL do PR #176 sem resultados |

## 3. Diferenças em relação ao plan

- O plan citava o `roomId` disponível em `Room.tsx`. O componente recebe a sala como `roomInfo.room_id`, que é o valor
  usado.
- O plan previa abrir o `os.Root` uma vez, na criação do `spaHandler`. Esse handle mantinha a pasta web presa durante
  toda a vida do handler e, no Windows, quebrava a limpeza de pasta temporária de `TestNewServer_PackagedMode_ServesWebDir`.
  O `os.Root` passou a ser aberto e fechado a cada verificação em `isWebFile`, junto com a guarda `filepath.IsLocal`
  (o fallback da C-5602, aplicado desde o início). O comportamento de SPA não muda.
- Requisições com `..` no caminho continuam recebendo o `400 invalid URL path` do `http.ServeFile` no fallback, como
  antes da mudança. O teste aceita o `index.html` ou esse 400 e exige que o arquivo de fora nunca seja servido.

## 4. Desvios registrados

- Nenhum.

## 5. Trabalho restante

- Nenhum nesta feature. Os alertas #1 a #8 fecham na `main` quando o CodeQL rodar depois do merge.

## 6. Impacto de versão

**PATCH → 2.3.3** (C-5603): correções de segurança em `apps/` sem capacidade nova nem mudança de contrato
(`docs/versionamento.md` §2).
