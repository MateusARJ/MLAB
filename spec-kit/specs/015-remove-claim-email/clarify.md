# Clarify: Remoção da Claim `email` do JWT do Professor

Feature: `015-remove-claim-email`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-10, com o plano de correção das issues #41, #42 e #43 e com a ADR 0009.

## C-151 — Precisa de ADR?

- **Contexto:** o item 5 da ADR 0006 fixa as claims do professor, incluindo `email`; AGENTS.md §9 exige ADR para
  alterar autenticação.
- **Resposta aprovada:** sim. ADR 0009 nova (não emenda na 0006), aprovada em 2026-11-10. A 0008 já é usada pela
  edição HTTPS, por isso o número 0009.

## C-152 — Fallback do slug sem nome

- **Resposta aprovada:** `professor`, como pede a issue #42. O handler já usa `professor` quando o slug do nome fica
  vazio; basta remover o ramo do e-mail. `professor@mlab.local` também gerava `professor`, então nada muda.

## C-153 — Fallback do nome no signaling sem claim `name`

- **Resposta aprovada:** continua `"Participante"`, o fallback que já existe. Sai só o ramo do e-mail. Com tokens do
  próprio backend esse caminho não roda.

## C-154 — Assinatura das funções de `auth`

- **Contexto:** `ProfessorMapClaims(professorID, email string, name ...string)` e `SignProfessorToken` com a mesma
  forma. Tirar só o parâmetro `email` mantém compilando as chamadas antigas de 2 argumentos, que passariam o e-mail
  como nome.
- **Resposta aprovada:** novas assinaturas `ProfessorMapClaims(professorID string, name ...string)` e
  `SignProfessorToken(professorID string, name ...string)`, com revisão manual de todas as chamadas (lista no plan).

## C-155 — Impacto de versão

- **Resposta aprovada:** PATCH. O contrato muda, mas o token é emitido e lido pelo mesmo backend, o segredo é
  aleatório por execução (nenhum token antigo sobrevive à atualização) e nenhum cliente lê `email`
  (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-151 a C-155 respondidas; nenhuma ambiguidade em aberto.
