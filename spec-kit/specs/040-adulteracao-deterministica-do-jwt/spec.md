# Spec: Adulteração Determinística do JWT no Teste de Segurança

Status: READY
Feature ID: `040-adulteracao-deterministica-do-jwt`
Origem: issue #116 (desvio encontrado na análise da #112, builds do PR de release #26). Corrige só um teste; não muda
regra de negócio, contrato nem ADR.

## 1. Objetivo

Fazer `TestAuthSecurity_ClaimManipulation` sempre adulterar o token e cobrir de fato a elevação de claim (aluno →
professor) exigida pela ADR 0004 §2.2.1, sem falso positivo intermitente.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `ecf1583`:

- O teste (`apps/backend/internal/auth/auth_security_test.go`) troca o caractere `len-5` do token por `A`. Com HS256,
  a assinatura tem 43 caracteres base64url; o caractere `len-5` está na **assinatura**, não no payload como diz o
  comentário, e carrega 6 bits completos.
- Quando esse caractere já é `A` (1 chance em 64), o token não muda, `ParseToken` aceita corretamente um token legítimo
  e o teste acusa `security violation`. Foi o que aconteceu na run 43735279050 (job macOS) do PR #26.
- `ParseToken` não tem defeito; o problema é só o teste.

## 3. Escopo

### Incluído

- Adulterar o payload de forma determinística: trocar a claim `role` de `aluno` para `professor`, recodificar o
  segmento e manter header e assinatura originais.
- Conferir que o token adulterado difere do original antes de exigir a recusa.

### Não incluído

- Mudanças em `jwt.go`, `middleware.go`, `handler.go` ou em qualquer código de produção.
- Testes novos de outros ataques.

## 4. Atores

- **Mantenedor do backend:** depende do CI estável para liberar o PR de release.

## 5. User Stories

### US-4001 — Teste de manipulação de claim sem falso positivo

Como mantenedor do backend, quero que o teste de manipulação de claim sempre adultere o token, para que ele só falhe
quando `ParseToken` aceitar de fato um token adulterado.

- Dado um token legítimo de aluno, quando o teste troca `role` para `professor` no payload e mantém a assinatura, então
  o token adulterado difere do original e `ParseToken` o recusa.
- Dado qualquer instante de execução (`iat`/`exp` diferentes), então o resultado do teste é o mesmo.

## 6. Requisitos Funcionais

- RF-4001: o teste decodifica o payload do token legítimo, confere `role = aluno`, troca para `professor`, recodifica
  com base64url sem padding e remonta o token com o header e a assinatura originais.
- RF-4002: o teste falha se o token adulterado for igual ao original e exige que `ParseToken` devolva erro.

## 7. Requisitos Não Funcionais

- RNF-4001 — estabilidade: o teste passa em todas as execuções, em instantes diferentes.
- RNF-4002 — dependências: nenhuma nova; só stdlib (`encoding/base64`, `encoding/json`, `strings`).

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| token adulterado igual ao original | o teste falha com mensagem própria (nunca acontece com a troca de claim) |
| `ParseToken` aceita o token adulterado | o teste falha com `security violation` |
| `ParseToken` recusa | o teste passa |

## 9. Edge Cases

- A ordem das claims no JSON recodificado pode diferir da original: irrelevante, pois a assinatura não confere de
  qualquer forma.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `go test -count=1000 -run TestAuthSecurity_ClaimManipulation ./internal/auth/` sem falha.
- O mesmo teste, rodado uma vez por segundo durante 200 s, sem falha.
- `go vet ./...` e `go test ./...` em `apps/backend` verdes.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4001 e C-4002).
