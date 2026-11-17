# Spec: Formato Exato da Matrícula do Aluno

Status: READY
Feature ID: `046-formato-matricula`
Origem: issue #134. Emenda a RN-306/RF-307 da `003-classroom-interaction` (C-303) e o RF011 de
`docs/requirements/`; não altera arquitetura nem ADR.

## 1. Objetivo

Aceitar na entrada do aluno somente matrículas no padrão institucional: 7 números, 4 letras da sigla do curso e
4 números (ex.: `2025116TADS0000`), gravando a sigla sempre em maiúsculas.

## 2. Contexto

Verificado em 2026-11-16 na `development` @ `bb2e70c` (2.1.2):

- O responsável entrou numa transmissão com `2025116TADS0` e foi aceito.
- A regra aprovada RN-306 é `^[0-9]+[A-Za-z]{1,4}[0-9]+$` (003/C-303): qualquer quantidade de dígitos antes e depois,
  e de 1 a 4 letras. `2025116TADS0` casa com ela; o código está de acordo com a spec, a spec é que está frouxa.
- Backend: `apps/backend/internal/room/handler.go` (`studentIDRegex`, `handleJoin`) faz `TrimSpace` e valida.
- Web: `apps/web/src/pages/Join.tsx` (`STUDENT_ID_REGEX`) valida antes de chamar a API e envia o valor com `trim`.
- A sessão única (027, ADR 0010) já compara matrículas sem diferenciar maiúsculas.
- A matrícula entra no JWT do aluno (claim `student_id`) e aparece entre parênteses na lista de participantes e no chat.

## 3. Escopo

### Incluído

- Regex exata no backend e no web.
- Normalização para maiúsculas no backend (autoritativa) e no web (antes do envio).
- Mensagem de erro com o formato e o exemplo.

### Não incluído

- Validar o ano, o período ou a existência da sigla do curso.
- Fixtures de teste do desktop (não passam pela validação).

## 4. Atores

- **Aluno:** entra pelo link da sala informando Nome e Matrícula.

## 5. User Stories

### US-4601 — Entrar só com a matrícula completa

Como professor, quero que só entrem alunos com a matrícula no padrão institucional, para identificar cada aluno sem
ambiguidade.

- Dado que o aluno informa `2025116TADS0`, então a entrada é recusada com a mensagem de formato e não chama a API.
- Dado que o aluno informa `2025116tads0000`, então entra e aparece como `2025116TADS0000`.

## 6. Requisitos Funcionais

- RF-4601: a matrícula só é aceita no formato `^[0-9]{7}[A-Za-z]{4}[0-9]{4}$`, validado no backend (`400`) e no web
  (antes da chamada). Substitui a RN-306 da 003.
- RF-4602: o backend remove espaços nas pontas e converte a matrícula para maiúsculas antes de validar e de usar
  (sessão única, claim `student_id`, participante). O web envia o valor já em maiúsculas.
- RF-4603: a mensagem de erro é "Matrícula inválida. Use 7 números, 4 letras da sigla do curso e 4 números (ex.:
  2025116TADS0000)." no web; o backend devolve o mesmo conteúdo no `error` do `400`.

## 7. Requisitos Não Funcionais

- RNF-4601 — dependências: nenhuma nova.
- RNF-4602 — segurança: a validação do servidor vale mesmo que o cliente seja burlado (AGENTS.md §8).

## 8. Estados e Erros

| Situação | Evento | Resultado esperado |
|---|---|---|
| `2025116TADS0000` | entrar | aceita |
| `2025116tads0000` / ` 2025116tads0000 ` | entrar | aceita como `2025116TADS0000` |
| `2025116TADS0`, `202511TADS0000`, `2025116ADS0000`, `2025116TADS00000` | entrar | `400` / erro no web |

## 9. Edge Cases

- Aluno que já tinha entrado com matrícula curta numa versão anterior: ao reentrar após a atualização, precisa
  informar a matrícula completa (estado só em memória, ADR 0005; não há dado gravado a migrar).

## 10. Dados/Contratos impactados

- `001-screen-share-core/contracts/room-api.md`: o `400` do join cita o formato da 046; `student_id` vai em maiúsculas.
- `001-screen-share-core/contracts/auth.md`: claim `student_id` normalizada em maiúsculas.

## 11. Critérios de Sucesso

- `TestJoinValidation` e `Join.test.tsx` cobrem os casos da §8 e ficam verdes.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4601 a C-4603).
