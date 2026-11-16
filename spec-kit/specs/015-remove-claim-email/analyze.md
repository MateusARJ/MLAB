# Analyze: Remoção da Claim `email` do JWT do Professor

Feature: `015-remove-claim-email`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. ADR 0009, spec, clarify (C-151 a C-155), plan e contrato concordam: claims `sub`, `role`, `name`, `iat`,
`exp`; fallbacks `professor` e `"Participante"`; versão PATCH. A faixa `15x` não colide com outras features
(verificado por busca em `spec-kit/` e `docs/`).

Observação: o converge (T155) registra a versão que o bump (T154) gera; o commit `chore(release)` fica por último no
PR, depois do commit do converge (AGENTS §13).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-151 | T151 |
| RF-152 | T152 (slug), T153 (signaling) |
| RNF-151 | T151–T153 (testes existentes de slug e nome com `name` presente continuam verdes) |

## 3. Contratos

`001/contracts/auth.md` emendado no commit da spec, antes do código: sai `email` do payload e da descrição do token
do professor. Nenhum outro contrato muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. As Allowed Paths de T151–T155 estão contidas nas do plan.

## 5. Riscos

- Chamadas de 2 argumentos que passariam o e-mail como nome: revisão manual exigida no T151 (C-154).

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T151.
