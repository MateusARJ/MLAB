# Clarify: Lint de Tipos do App Desktop sem Erros

Feature: `020-lint-tipos-desktop`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-11, com o plano de correção da issue #51.

## C-2001 — Selo "Proteção de Privacidade Ativa"

- **Contexto:** o selo saiu da UI no commit `2a0e2c2`, e o teste da sala já afirma que ele não aparece. Sobraram o
  estado `isPrivacyShieldActive`, três `setIsPrivacyShieldActive(false)` e a assinatura de
  `onActiveWindowUnauthorized`, que só alimentava esse estado.
- **Alternativas:** (A) remover o estado, os setters e a assinatura; (B) remover só o estado e manter a assinatura
  com callback vazio.
- **Resposta aprovada:** **A**. O selo não deve ficar na UI (RF-2002). O teste mantém a asserção negativa como guarda
  contra regressão.

## C-2002 — Canal IPC `active-window-unauthorized`

- **Resposta aprovada:** fica como está no `preload.ts`, no `cursorPresence.ts` e no contrato
  `003-classroom-interaction/contracts/desktop-ipc.md`. Um canal Main → Renderer sem assinante não quebra nada; tirá-lo
  é mudança de contrato e fica fora desta feature.

## C-2003 — Código morto do worker do cursor

- **Contexto:** o commit `29c54d0` removeu de propósito o inpainting de 1080p na CPU para manter 60 fps. As funções e
  variáveis que só ele usava ficaram no arquivo.
- **Resposta aprovada:** remover tudo o que só servia ao inpainting. Retomar a ocultação do cursor é escopo da 007
  (`fix/mascara-cursor-janela`, não mergeada) e não é afetado por esta feature.

## C-2004 — Lint no CI

- **Resposta aprovada:** entra nesta feature, em tarefa e commit `ci` próprios, como etapa do `build-all.yml` depois
  do build de `@mlab/types` e antes dos testes. O workflow continua disparando só em PR para a `main`, por tag e
  manualmente.

## C-2005 — Faixa de IDs

- **Contexto:** `T201`–`T209` e `C-201`–`C-205` já são da 002. Desde a 019 o validador aceita IDs com 3 ou mais
  dígitos.
- **Resposta aprovada:** a 020 usa `RF-200x`, `RNF-200x`, `C-200x` e `T200x`.

## C-2006 — Impacto de versão

- **Resposta aprovada:** **PATCH** (1.12.0 → 1.12.1). Muda `apps/desktop` sem nova capacidade nem contrato
  (`docs/versionamento.md` §2, AGENTS §13).

## Resultado

CLOSED — C-2001 a C-2006 respondidas; nenhuma ambiguidade em aberto.
