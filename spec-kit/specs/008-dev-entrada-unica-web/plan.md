# Plan: Entrada Única do Web do Aluno no Modo de Desenvolvimento

Feature: `008-dev-entrada-unica-web`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-801, C-802)

## 1. Summary

Em `apps/backend/cmd/server/main.go`:

1. `serverConfig` ganha `DevWebPort string`. O `main` preenche com `WEB_PORT` (padrão `5173`) quando
   `MLAB_DEV_MONOREPO=1`; vazio fora do modo de desenvolvimento.
2. `newServer`: com `DevWebPort` preenchido, a rota `/` (que só recebe o que não casou com as rotas de API) usa
   `devWebRedirectHandler(port)`; senão, `spaHandler(WebDir)` como hoje.
3. `devWebRedirectHandler`: `GET`/`HEAD` → `307` para `scheme://<host da requisição>:<port><RequestURI>`, com o host
   sem a porta original (`net.SplitHostPort`, aceitando IPv6) e recomposto por `net.JoinHostPort`; demais métodos →
   `404`. O `scheme` é `http` (o Vite de desenvolvimento não usa TLS).

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Ativação | `MLAB_DEV_MONOREPO=1` (já repassado pelo `turbo.json` e usado pelo link da sala) | RF-801, RF-803 |
| Porta de destino | `WEB_PORT`, padrão `5173` (mesma regra do link em `room/handler.go`) | RF-801 |
| Código HTTP | `307` (preserva método; não é cacheado como o `301`) | C-802 |
| Rotas de API | registradas antes; o `ServeMux` só manda a `/` o que não casou | RNF-801 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Vite parado no dev | redirecionamento para porta sem servidor | dev sempre sobe os dois (`npm run dev`); erro explícito no navegador, melhor que build antigo silencioso |
| E2E abrir página na 8080 | teste quebrado | o E2E abre só `/health` na 8080 (rota de API) e usa a 5173 como `baseURL` |
| Host da requisição manipulado | redirecionamento para outro host | afeta só a própria requisição de quem manipulou o cabeçalho; nenhuma credencial vai junto |

## Scope Lock

### IN

- rota `/` do backend no modo de desenvolvimento e seus testes.

### OUT

- rotas de API, WebSocket, `/health`, CORS, autenticação;
- comportamento do app empacotado;
- web do aluno, app desktop e scripts de dev.

### Allowed Paths

- `apps/backend/cmd/server/main.go`
- `apps/backend/cmd/server/main_test.go`
- `spec-kit/specs/008-dev-entrada-unica-web/**`

### Prohibited Paths

- `apps/backend/internal/**`
- `apps/web/**`, `apps/desktop/**`, `packages/**`
- `scripts/**`, `turbo.json`

### Dependencies

- Nenhuma nova. Biblioteca padrão do Go (`net`, `net/http`).

### Non-Goals

- servir o web atual (não compilado) pela 8080;
- mudar a porta ou o link oficial do modo de desenvolvimento.

## 4. Constitution Check

- [x] Princípio I — spec aprovada.
- [x] Princípio II — autorização no servidor inalterada (C-801).
- [x] Princípio III — SFU intocada.
- [x] Princípio IV — sem meta de desempenho.
- [x] Princípio V — nenhum contrato de API alterado.
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — um handler pequeno, sem dependência.
- [ ] Princípio VIII — converge ao final (T802).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-02 | A 8080 não é controle de acesso; o problema é o build antigo servido no dev | C-801 |
| 2026-11-02 | Redirecionar `GET`/`HEAD` com `307` para a porta do web no dev | C-802 |
