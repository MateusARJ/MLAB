# Analyze: Entrada Única do Web do Aluno no Modo de Desenvolvimento

Feature: `008-dev-entrada-unica-web`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. A feature só muda a rota `/` do backend no modo de desenvolvimento; o app empacotado e as rotas de API
seguem como estão. A regra de porta (`WEB_PORT`, padrão 5173) é a mesma usada no link da sala
(`room/handler.go:getWebPort`).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-801 | T801, T802 |
| RF-802 | T801 |
| RF-803 | T801 |
| RNF-801 | T801 |

## 3. Contratos

Nenhum contrato alterado: rotas de API, WebSocket e payloads iguais.

## 4. Tarefas fora do Scope Lock

Nenhuma. T801 altera só `cmd/server/main.go` e `main_test.go`; T802 só a pasta da feature.

## 5. Riscos

- Vite parado no dev: o redirecionamento falha de forma visível (preferível ao build antigo silencioso).
- E2E: usa a 5173 como `baseURL` e só `/health` na 8080.

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T801.
