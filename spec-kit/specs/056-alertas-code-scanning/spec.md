# Spec: Correção dos Alertas do Code Scanning

Status: READY
Feature ID: `056-alertas-code-scanning`
Origem: 8 alertas abertos do CodeQL (Code Scanning do GitHub) na `main` @ `e5de09d` (2.3.2), pedido do responsável.
Endurece o tratamento de dados externos em quatro pontos; não muda comportamento visível, contrato nem ADR.

## 1. Objetivo

Zerar os alertas abertos do Code Scanning com correções mínimas, tratando como não confiáveis os dados que hoje
chegam do servidor, da requisição HTTP ou do SDP remoto (AGENTS §8).

## 2. Contexto

Alertas verificados em 2026-11-20 com `gh api repos/{owner}/{repo}/code-scanning/alerts?state=open`:

| Alerta | Regra | Local | Gravidade |
|---|---|---|---|
| #4, #5 | `js/client-side-unvalidated-url-redirection` | `apps/web/src/pages/Room.tsx` (gavetas desktop e celular) | medium |
| #6, #7 | `js/xss` | `apps/web/src/pages/Room.tsx` (mesmos `href`) | high |
| #1 | `go/path-injection` | `apps/backend/cmd/server/main.go` (`spaHandler`) | high |
| #2, #3 | `js/regex-injection` | `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts` (`enforceHighBitrateSDP`) | high |
| #8 | `js/incomplete-sanitization` | `scripts/smoke-report.js` (escape de barra vertical) | high (warning) |

- **Web:** o link "Baixar" usa `file.url` do payload `file-shared`/`files-history` e do `GET /rooms/{id}/files` sem
  validação. Um `url` com `javascript:` ou outro host executaria script ou levaria o JWT do aluno (vai na query).
  O backend hoje gera a URL fixa do contrato 003 (`/rooms/{roomId}/files/{fileId}/download`).
- **Backend:** o `spaHandler` faz `os.Stat(filepath.Join(webDir, filepath.Clean(r.URL.Path)))` para decidir entre
  arquivo físico e `index.html`. O caminho vem da requisição.
- **Desktop:** `enforceHighBitrateSDP` monta `new RegExp` com o payload type lido do SDP, inclusive da answer do
  servidor. O valor só tem dígitos, mas não passa por escape.
- **Script:** o relatório de smoke escapa a barra vertical sem escapar a barra invertida antes.

## 3. Escopo

### Incluído

- Montagem do link de download do aluno, contenção do `spaHandler` na pasta web, escape do payload type no SDP e
  escape da barra invertida no relatório de smoke.

### Não incluído

- Mudança no backend de arquivos (`internal/room/files.go`), nos contratos ou em `packages/types`.
- Configuração do CodeQL e regras de supressão de alertas.

## 4. Atores

- **Aluno**: baixa arquivos compartilhados pelo professor.
- **Professor**: transmite (SDP ajustado pelo desktop) e serve a web do aluno pelo backend embarcado.
- **Mantenedor**: gera o relatório de smoke.

## 5. User Stories

### US-5601 — Link de download sempre na mesma origem

Como aluno, quero que o botão "Baixar" sempre aponte para o download do próprio MLab, mesmo que um payload venha
adulterado.

- Dado um arquivo compartilhado, quando clico em "Baixar", então baixo o arquivo como hoje.
- Dado um payload com `url` adulterado, quando a lista aparece, então o link continua apontando para
  `/rooms/{roomId}/files/{fileId}/download`.

## 6. Requisitos Funcionais

- RF-5601: o web do aluno monta o link de download a partir do `roomId` e do `id` do arquivo, com
  `encodeURIComponent`, no formato do contrato 003, e ignora o campo `url` recebido.
- RF-5602: o `spaHandler` só verifica a existência de arquivos dentro da pasta web; caminhos que tentam sair dela caem
  no fallback do `index.html`.
- RF-5603: `enforceHighBitrateSDP` escapa o payload type antes de montar a expressão regular; o SDP gerado não muda.
- RF-5604: `scripts/smoke-report.js` escapa a barra invertida antes da barra vertical no detalhe das falhas.

## 7. Requisitos Não Funcionais

- RNF-5601 — compatibilidade: nenhum contrato, rota ou comportamento visível muda.
- RNF-5602 — dependências: nenhuma nova.
- RNF-5603 — verificação: os alertas #1 a #8 fechados na análise do CodeQL do PR.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| payload com `url` adulterado | link montado pelo cliente, na mesma origem |
| requisição com `..` ou barra invertida para fora da pasta web | `index.html` (fallback de SPA), sem acessar arquivo de fora |
| SDP com payload types válidos | saída igual à de hoje |
| detalhe de falha com barra invertida | Markdown escapado corretamente |

## 9. Edge Cases

- `id` de arquivo com `/`, `?`, `#`: escapado com `encodeURIComponent`, sem mudar a rota.
- Pasta web inexistente: o `spaHandler` responde 404, como hoje.

## 10. Dados/Contratos impactados

- Nenhum. O formato da URL já é o de `spec-kit/specs/003-classroom-interaction/contracts/files.md`.

## 11. Critérios de Sucesso

- Testes unitários de web, desktop e backend verdes.
- Nenhum alerta aberto do CodeQL na análise do PR.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-5601 a C-5603).
