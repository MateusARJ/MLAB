# Converge: Adulteração Determinística do JWT no Teste de Segurança

Feature: `040-adulteracao-deterministica-do-jwt`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-15
Commits avaliados: `0fd9267` (artefatos), `9dd6ddf` (T4001)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-4001 e C-4002), `plan.md`, `tasks.md` (T4001 e T4002)
- código: `internal/auth/auth_security_test.go` (`TestAuthSecurity_ClaimManipulation`)
- suítes:
  - `go vet ./...` e `go test -count=1 ./...` em `apps/backend`: todos os pacotes verdes;
  - `gofmt -l` vazio no arquivo alterado (conferido sem o CRLF da cópia de trabalho);
  - `go test -count=1000 -run TestAuthSecurity_ClaimManipulation ./internal/auth/`: verde;
  - o mesmo teste, uma execução por segundo durante 200 s (tokens com `iat`/`exp` diferentes): 0 falhas em 200;
  - prova do defeito, com um teste temporário (não versionado) sobre o código da `development` @ `ecf1583`: em 6400
    tokens com `iat` diferentes, a troca do caractere `len-5` por `A` não mudou o token em 89 (≈ 1/72, perto do 1/64
    esperado), e `ParseToken` aceitou exatamente esses 89, que eram legítimos. Nenhum token de fato adulterado foi
    aceito: `ParseToken` não tem defeito.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-4001 | `auth_security_test.go` (decodifica o payload, confere `role = aluno`, troca para `professor`, recodifica com `RawURLEncoding`, mantém header e assinatura) |
| RF-4002 | `auth_security_test.go` (falha se `tamperedToken == tokenStr`; exige erro do `ParseToken`) |
| RNF-4001 | 1000 execuções seguidas e 200 em segundos diferentes sem falha |
| RNF-4002 | só stdlib (`encoding/base64`, `encoding/json`, `strings`) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Plan diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Nenhum.

## 6. Novas tasks necessárias

- Nenhuma.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| sem incremento | — | Só teste (`test`); nada do que é entregue muda (C-4002). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED: o teste adultera a claim `role` de forma determinística e só falha se `ParseToken` aceitar um token
  de fato adulterado.
