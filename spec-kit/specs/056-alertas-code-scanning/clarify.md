# Clarify: Correção dos Alertas do Code Scanning

Feature: `056-alertas-code-scanning`
Status: CLOSED

Decisões registradas em 2026-11-20, no pedido do responsável para corrigir os alertas do Code Scanning.

## C-5601 — Validar `file.url` ou montar a URL no cliente

- **Opções:** (A) montar a URL no cliente a partir de `roomId` + `file.id`; (B) validar `file.url` contra o padrão do
  contrato e esconder o link quando não bater.
- **Resposta:** **A**. O formato já é fixo no contrato 003, então montar a URL no cliente não muda o contrato. Sem o
  dado externo no começo do `href`, não há esquema nem host para injetar. A opção (B) manteria o dado externo no
  `href` e criaria um caminho de UI novo (link escondido).
- **Impacto em spec:** RF-5601.

## C-5602 — Contenção no `spaHandler`

- **Resposta:** usar `os.Root` (Go 1.24+, o `go.mod` está em 1.26.11) para verificar a existência do arquivo dentro
  da pasta web. Se o CodeQL não reconhecer o `os.Root`, acrescentar a guarda `filepath.IsLocal` na mesma task.
- **Impacto em spec:** RF-5602.

## C-5603 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, branch `fix/alertas-code-scanning`, da `main` para a `main` (ADR 0011), com um
  commit por correção, feitas uma de cada vez na ordem web → backend → desktop → script (escolha do responsável).
- **Faixa de IDs:** `US-560x`, `RF-560x`, `RNF-560x`, `C-560x` e `T560x` (busca sem resultado).
- **Impacto de versão:** **PATCH** (2.3.3). É correção de segurança em `apps/`, sem capacidade nova nem mudança de
  contrato (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-5601 a C-5603 respondidas, sem ambiguidade em aberto.
