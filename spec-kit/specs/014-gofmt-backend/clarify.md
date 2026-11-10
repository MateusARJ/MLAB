# Clarify: Formatação do Backend com gofmt

Feature: `014-gofmt-backend`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-10, com o plano de correção das issues #41, #42 e #43.

## C-141 — Só o `store.go` ou o backend inteiro

- **Contexto:** a issue #41 descreve o `store.go`, mas o segundo critério de aceite dela é `gofmt -l` vazio em
  `apps/backend`, e há outros 8 arquivos fora do formato (spec, seção 2).
- **Alternativas:** (A) os 9 arquivos num único commit `style(backend)`; (B) os 9 e mais `*.go text eol=lf` no
  `.gitattributes`; (C) só o `store.go`, com issue nova para os demais.
- **Resposta aprovada:** **A**. O `.gitattributes` e a checagem no CI ficam fora (Non-Goals).

## C-142 — Como verificar com `core.autocrlf=true`

- **Contexto:** a cópia de trabalho no Windows tem CRLF, e o `gofmt -l` acusa todos os arquivos por isso.
- **Resposta aprovada:** a verificação usa o conteúdo versionado (`git show <rev>:<arquivo> | gofmt -l`), que é LF.

## C-143 — Impacto de versão

- **Resposta aprovada:** sem incremento. É `style` (`docs/versionamento.md` §2, AGENTS §13); o binário gerado é o
  mesmo.

## Resultado

CLOSED — C-141 a C-143 respondidas; nenhuma ambiguidade em aberto.
