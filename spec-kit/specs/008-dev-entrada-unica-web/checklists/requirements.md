# Checklist de Requisitos: Entrada Única do Web do Aluno no Modo de Desenvolvimento

Feature: `008-dev-entrada-unica-web`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-801 a RF-803, RNF-801) tem task.
- [x] Ambiguidades fechadas (C-801, C-802).
- [x] Causa registrada com evidência (`resolveWebDir` acha `../web/dist` a partir de `apps/backend`; `spaHandler` na
  rota `/`).

## Coerência

- [x] App empacotado inalterado (RF-803).
- [x] Rotas de API e autorização inalteradas (RNF-801, RN-801).
- [x] Nenhuma dependência nova.

## Viabilidade

- [x] Validação automatizada por `httptest` em `main_test.go`; verificação manual no `npm run dev`.

## Resultado

APPROVED
