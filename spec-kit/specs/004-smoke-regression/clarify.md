# Clarify: Matriz de Smoke de Regressão

Feature: `004-smoke-regression`
Status: CLOSED

Decisões tomadas com o dono do produto em 2026-11-01 (abordagem híbrida aprovada; recursos: celular e Linux/WSL).

## C-401 — Dependência de E2E

- **Resposta aprovada:** `@playwright/test` como devDependency **somente** de `apps/web`, com o Chromium baixado pelo
  próprio Playwright (`npx playwright install chromium`). Nenhuma dependência nova em runtime.

## C-402 — Montagem do servidor reutilizável em teste

- **Contexto:** `apps/backend/cmd/server/main.go` monta store, SFU, handlers, broadcasters e rotas dentro de `main()`;
  não há como subir o servidor real num teste.
- **Resposta aprovada:** extrair essa montagem para uma função do mesmo pacote (`newServer`), chamada pelo `main()`.
  Mesmo comportamento, mesmas rotas e middlewares; a suíte existente valida a extração.

## C-403 — A19 e o close code 4001

- **Contexto:** o Anexo A espera `4001` para sessão duplicada do mesmo aluno, mas o backend fecha a conexão antiga
  sem código (o navegador vê `1005`).
- **Resposta aprovada:** o smoke registra o comportamento real e marca A19 como FALHA conhecida. A correção não entra
  nesta feature; vira proposta de task.

## C-404 — A17 (ngrok)

- **Resposta aprovada:** sem conta ngrok disponível, A17 é N/E com justificativa. Se o responsável criar uma conta, o
  roteiro já traz os passos.

## C-405 — Timeout de reconexão do professor (A18)

- **Resposta aprovada:** o smoke espera os 30 s reais de `publisherReconnectTimeout`; a constante não fica
  configurável (evita mudar código de produção por causa de teste).

## C-406 — CI

- **Resposta aprovada:** fora desta feature. Alterar `.github/workflows/**` fica como proposta para depois que a
  suíte estiver estável localmente.

## C-407 — Sem segundo computador

- **Resposta aprovada:** o celular faz o papel do "outro dispositivo da LAN" em A2 e A16.

## Resultado

CLOSED — C-401 a C-407 respondidas; nenhuma ambiguidade em aberto.
