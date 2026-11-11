# Spec: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Status: READY
Feature ID: `019-validador-ids-tarefa`
Origem: issue #50 (desvio registrado durante a preparação da 012): o `validate_spec.py` ignora tarefas com ID de 4
dígitos.

## 1. Objetivo

Garantir que o gate "toda tarefa declara `Allowed Paths:` e `Prohibited Paths:`" (AGENTS §4, Princípio VI) valha para
qualquer ID de tarefa, e que um cabeçalho de tarefa fora do padrão nunca passe em silêncio.

## 2. Contexto

`spec-kit/.specify/scripts/validate_spec.py` procura os blocos de tarefa com `^###\s+(T\d{3}[a-z]?)\b`. Em
`### T1101`, o trecho `T110` é seguido de `1`, o `\b` não casa e o bloco não é verificado: o `spec:check` dá PASS mesmo
sem os paths. Verificado em 2026-11-11 na `development` @ `5600c61`:

- os 126 cabeçalhos `### T` das 16 features seguem o padrão de 3 dígitos, então hoje nenhuma tarefa escapa do gate;
- a 012 (C-127) e a 017 (C-179) escolheram a faixa de IDs por causa da limitação, e a faixa `T20x` da próxima feature
  colide com a 002 (`T201`–`T208`);
- a 011 (edição HTTPS, só na `edicao/https-lan`) usa `T1101`–`T1106`, fora do gate.

## 3. Escopo

### Incluído

- aceitar IDs `T` + 3 ou mais dígitos + letra minúscula opcional;
- falhar explicitamente em cabeçalho `### T<dígito>` que não segue esse padrão;
- teste automatizado do validador com a biblioteca padrão do Python.

### Não incluído

- executar o teste no CI ou num script npm;
- renumerar tarefas existentes;
- editar a 011 ou a `edicao/https-lan`.

## 4. Requisitos

- RF-191: todo bloco iniciado por `### T<3+ dígitos>[a-z]` passa pelo gate de `Allowed Paths:`/`Prohibited Paths:`.
- RF-192: um cabeçalho `### T` seguido de dígito e fora do padrão de RF-191 (ex.: `### T12`, `### T101ab`) faz o
  validador falhar com mensagem que cita o ID. Cabeçalhos que não começam com `T` + dígito (ex.: `### Testes`) não são
  tarefas.
- RNF-191: só biblioteca padrão do Python (sem dependência nova); os demais gates não mudam; as features existentes
  continuam em PASS.

## 5. Critérios de Sucesso

- Teste automatizado: tarefa `T1101` sem paths → FAIL; com paths → PASS; cabeçalho malformado → FAIL.
- `npm run spec:check` com PASS em todas as features, incluindo a `019-validador-ids-tarefa`.
- Validador corrigido sobre uma cópia da `011-https-lan` exportada da `edicao/https-lan` → PASS.
