# Plan: [NOME DA FEATURE]

Feature: `[###-slug]`
Status: DRAFT
Spec: `./spec.md`

## 1. Summary

Resumo da solução técnica.

## 2. Technical Context

| Item | Decisão |
|---|---|
| Linguagem | Go / TypeScript |
| Transporte | HTTP / WebSocket / WebRTC |
| SFU | Pion ou decisão registrada em ADR |
| Persistência | em memória (ADR 0005); outra forma exige nova ADR |
| Testes | unit / integration / e2e |

## 3. Architecture

Explique componentes e fluxo de dados.

## 4. Data Model

Referencie `data-model.md` quando existir.

## 5. Contracts

Liste contratos que precisam existir antes da implementação.

## 6. Security

- autorização do professor;
- autorização do aluno;
- tokens;
- validação de entrada;
- secrets.

## 7. Performance and Observability

Defina métricas, método de medição e critérios de aceitação. Não use afirmações sem medição.

## 8. Dependencies

Liste somente dependências aprovadas.

## 9. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| | | |

## 9a. Impacto de versão previsto

Nível previsto pelo escopo de `docs/versionamento.md` §2 (MAJOR / MINOR / PATCH / nenhum) e motivo. Mudança
incompatível (MAJOR) exige aprovação explícita do responsável antes das tasks.

## Scope Lock

### IN

- 

### OUT

- 

### Allowed Paths

- 

### Prohibited Paths

- 

### Dependencies

- 

### Non-Goals

- 

## 11. Constitution Check

- [ ] Princípio I
- [ ] Princípio II
- [ ] Princípio III
- [ ] Princípio IV
- [ ] Princípio V
- [ ] Princípio VI
- [ ] Princípio VII
- [ ] Princípio VIII

## 12. Decision Log

Decisões que não exigem ADR podem ser registradas aqui.
