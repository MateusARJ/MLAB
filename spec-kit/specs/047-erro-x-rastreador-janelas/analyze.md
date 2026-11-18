# Analyze: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Feature: `047-erro-x-rastreador-janelas`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-4701 a C-4703) e plan concordam: módulo único de captura, handler só durante a chamada, `BadWindow`
  sem log no rastreador, aviso único por código para outros erros, região de entrada da T911 inalterada, PATCH.
- A 009/T911 não é contrariada: o plan mantém o comportamento dela e protege a suíte dela (path proibido).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-4701 | T4701, T4702, T4703 |
| RF-4702 | T4701, T4703 |
| RF-4703 | T4702 |
| RNF-4701 | T4704 |
| RNF-4702 | T4703 |
| RNF-4703 | T4702, T4703 (uma chamada `XSync` por `run`) |
| RNF-4704 | todas: nenhuma dependência nova |

## 3. Contratos

- Nenhum contrato muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. T4701 e T4703 tocam o rastreador e seu teste; T4702 cria o módulo de captura e adapta a região de entrada;
T4704 e T4705 só documentos da feature. O `chore(release)` toca só os `package.json`/`package-lock.json` pelo
`npm run bump`.

## 5. Riscos

- Refatoração da T911, custo do `XSync` e log inundado: mitigados no plan §3.

## 6. Resultado

- [ ] FAIL
- [x] PASS: a próxima execução é a T4701.
