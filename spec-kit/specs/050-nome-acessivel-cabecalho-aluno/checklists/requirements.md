# Checklist de Requisitos: Nome Acessível dos Botões do Cabeçalho do Aluno

Feature: `050-nome-acessivel-cabecalho-aluno`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-5001 a RF-5004, RNF-5001 a RNF-5003) tem task.
- [x] Ambiguidades fechadas (C-5001 a C-5003): app ou teste, formato do nome, rótulo do Chat e versão.
- [x] Evidência registrada: `Room.tsx` (botões do cabeçalho, `filesBadge`, `unreadBadge`), teste de componente e e2e
  forçado da análise na #149.
- [x] Edge cases cobertos: contagem voltando a 0, chat aberto, `99+`.

## Coerência

- [x] Testes existentes que usam `/^Chat$/` (computador) seguem válidos: sem não lidas o nome continua "Chat".
- [x] Testes que usam `/Arquivos da Aula/i` no menu em tela cheia não mudam (outro botão).
- [x] 049 (menu em tela cheia) não é afetada.
- [x] PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `500x` não colidem.

## Viabilidade

- [x] `aria-label` e `aria-hidden` suportados pelo jsdom/Testing Library e pelo Playwright (`getByRole`).

## Resultado

APPROVED
