# Converge: Formato Exato da Matrícula do Aluno

Feature: `046-formato-matricula`
Status: DONE
Branch: `feat/formato-matricula`, a partir da `development` @ `bb2e70c` (2.1.2)

## 1. Evidências

- T4601: testes escritos antes do código e vermelhos com a regra antiga — `TestJoinValidation` aceitava (`404` em vez
  de `400`) `2025116TADS0`, `202511TADS0000`, `20251160TADS0000`, `2025116ADS0000` e `2025116TADS00000`;
  `TestJoinRoomBySlug` recebia `student_id` `2025116tads0039` no token.
- T4602: `go test ./...` em `apps/backend` verde (inclui `TestJoinValidation`, `TestJoinRoomBySlug`,
  `TestJoinMatriculaConectada` e o smoke A9).
- T4603: `npx vitest run` em `apps/web` com 5 arquivos e 65 testes verdes; `npm run lint` (`tsc --noEmit`) verde.
- T4603 corrigiu dois casos do `Join.test.tsx` da T4601 que a UI não produz: o campo já converte para maiúsculas e
  corta em 15 caracteres (`maxLength`), então `2025116TADS00000` virava `2025116TADS0000` (válida) e
  `' 2025116tads0000 '` perdia o último dígito. O caso de 5 números finais fica coberto no backend; o web testa
  `2025116TADS000`. O path do teste foi incluído na T4603 do `tasks.md`.
- T4603 também atualizou o texto de ajuda do campo, que descrevia a regra antiga ("números com a sigla do curso no
  meio").

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4601 | `studentIDRegex` (`handler.go`) e `STUDENT_ID_REGEX` (`Join.tsx`) = `^[0-9]{7}[A-Za-z]{4}[0-9]{4}$`; casos inválidos nos dois testes |
| RF-4602 | `strings.ToUpper(strings.TrimSpace(...))` no join; claim `2025116TADS0039` em `TestJoinRoomBySlug`; web envia em maiúsculas |
| RF-4603 | `errStudentIDFormat` no backend e `STUDENT_ID_ERROR` no web, mesma redação; teste do web pelo texto exato |
| RNF-4601 | nenhuma dependência nova |
| RNF-4602 | validação repetida no servidor; `TestJoinValidation` chama a API direto |

## 3. Desvios registrados

- Nenhum. Os avisos do analisador em `handler.go` (`resolveBaseURL` sem uso), `mdns.go` e `room_security_test.go`
  já existiam e não afetam esta feature.

## 4. Trabalho restante

- Nenhum nesta feature. O #134 fica resolvido pelo PR desta branch.

## 5. Impacto de versão

**PATCH** (C-4603), 2.1.2 → 2.1.3: correção da regra de validação da matrícula, sem campo novo ou removido no
contrato; backend e web saem juntos no mesmo instalador (`docs/versionamento.md` §2).
