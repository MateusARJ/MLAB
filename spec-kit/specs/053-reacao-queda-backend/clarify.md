# Clarify: Reação do App à Queda do Backend

Feature: `053-reacao-queda-backend`
Status: CLOSED

Decisões registradas em 2026-11-19 com o responsável.

## C-5301 — O que fazer depois de reiniciar o backend

- **Opções:** (A) recriar a sala sozinho e voltar a publicar; (B) avisar e pedir ao professor ("Retomar aula");
  (C) só avisar e voltar ao dashboard.
- **Resposta:** **A**. A aula volta sem ação do professor; o link fixo continua o mesmo porque o slug vem do nome e
  do título.
- **Impacto em spec:** RF-5305, RF-5306, RF-5307.

## C-5302 — Detecção do travamento

- **Opções:** (A) `/health` a cada 3 s, 3 falhas; (B) a cada 5 s, 4 falhas; (C) só pela saída do processo.
- **Resposta:** **A** (~9 s até agir).
- **Impacto em spec:** RF-5302, RNF-5301, RNF-5302.

## C-5303 — Limite de reinícios

- **Decisão do agente, dentro do pedido:** no máximo 3 reinícios em 60 s, para não entrar em loop se o backend cair
  logo após subir. Acima disso, `failed`.
- **Impacto em spec:** RF-5303.

## C-5304 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, branch `feat/reacao-queda-backend`, a partir da `main` e para a `main`, por decisão
  do responsável (a `development` não existe mais no remoto). É feature própria, separada da `052`.
- **Faixa de IDs:** `US-530x`, `RF-530x`, `RNF-530x`, `C-530x` e `T530x` (busca sem resultado).
- **Impacto de versão:** **MINOR**. Capacidade nova (US/RF novos) e canal IPC novo, sem alterar os existentes
  (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-5301 a C-5304 respondidas, sem ambiguidade em aberto.
