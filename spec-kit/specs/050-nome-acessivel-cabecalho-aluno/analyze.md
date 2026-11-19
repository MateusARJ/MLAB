# Analyze: Nome Acessível dos Botões do Cabeçalho do Aluno

Feature: `050-nome-acessivel-cabecalho-aluno`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-5001 a C-5003) e plan concordam: `aria-label` calculado nos botões Arquivos e Chat do cabeçalho,
  contagem com unidade, selos `aria-hidden`, A13 esperando a contagem, PATCH.
- Os nomes já usados por testes não mudam sem contagem ("Chat" no computador; `title` no celular).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-5001 a RF-5003 | T5001 |
| RF-5004 | T5002 |
| RNF-5001 | T5001 |
| RNF-5002 | T5001 (testes de componente), T5002 (e2e) |
| RNF-5003 | todas: nenhuma dependência nova |

## 3. Contratos

- Nenhum contrato muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. A T5001 toca só `Room.tsx` e `Room.test.tsx`; a T5002 só `aluno.e2e.ts`; a T5003 só documentos da feature;
a T5004 só os manifests, via `npm run bump`.

## 5. Riscos

- Mudança de nome em testes existentes, divergência entre selo e nome e A13 esperando a contagem: mitigados no plan §3.

## 6. Resultado

- [ ] FAIL
- [x] PASS: a próxima execução é a T5001.
