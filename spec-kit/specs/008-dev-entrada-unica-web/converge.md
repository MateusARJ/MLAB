# Converge: Entrada Única do Web do Aluno no Modo de Desenvolvimento

Feature: `008-dev-entrada-unica-web`
Mode: READ-ONLY sobre o código (só este arquivo e o check da T802 são escritos)
Data: 2026-11-02
Commit avaliado: `7b123d9` (branch `fix/dev-redireciona-web`)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-801, C-802), `plan.md`, `tasks.md` (T801–T802)
- Suítes: `go test ./...` do backend verde; smoke do backend (`-tags smoke`) verde (T801)
- Verificação manual do responsável no `npm run dev` em 2026-11-02 (T802)

## 1. Requisitos atendidos

| Requisito | Evidência |
|---|---|
| RF-801 `GET`/`HEAD` fora da API → `307` para a porta do web | `apps/backend/cmd/server/main.go`; `main_test.go` (caminho, query e IPv6); verificação manual |
| RF-802 outros métodos fora da API → `404` | `main_test.go` |
| RF-803 sem `MLAB_DEV_MONOREPO=1`, `spaHandler` como antes | `main_test.go` (modo empacotado) |
| RNF-801 API, WebSocket e `/health` inalterados | `main_test.go`; smoke do backend verde |
| RN-801 a porta não concede acesso extra | redirecionamento não toca validações de sala, nome e matrícula (C-801) |

## 2. Divergências

Nenhuma entre código e spec/plan desta feature.

## 3. Código sem requisito

Nenhum.

## 4. Testes faltantes / limitações de verificação

- O redirecionamento em outro dispositivo da LAN foi verificado manualmente; não há E2E automatizado para o modo de
  desenvolvimento (fora do escopo da 008).

## 5. Novas tasks necessárias

Nenhuma nesta feature.

## 6. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.9.0 | A 008 cria requisitos novos (RF-801 a RF-803, RNF-801, RN-801), e PR que cria RF novo é MINOR (`docs/versionamento.md` §3). O comportamento novo só existe com `MLAB_DEV_MONOREPO=1`; o app empacotado mantém o `spaHandler` (RF-803), sem quebrar contrato nem fluxo existente. A branch foi criada antes da regra do §13 do `AGENTS.md` e foi rebaseada sobre a 1.8.0. |

## 7. Resultado

- [ ] OPEN
- [x] CONVERGED — T801–T802 entregues e verificadas.
