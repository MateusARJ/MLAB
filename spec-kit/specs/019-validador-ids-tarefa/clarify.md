# Clarify: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Feature: `019-validador-ids-tarefa`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-11, com o plano de correção da issue #50.

## C-191 — Aceitar 3+ dígitos ou falhar no ID fora do padrão

- **Contexto:** a issue aceita as duas saídas: a regex aceita `T\d{3,}` **ou** o validador falha em `### T` fora do
  padrão.
- **Resposta aprovada:** as duas. `T\d{3,}[a-z]?` entra no gate (RF-191), e qualquer outro cabeçalho `### T<dígito>`
  falha (RF-192). Assim, nenhum formato de ID novo volta a passar em silêncio.

## C-192 — Como provar a correção

- **Alternativas:** (A) `unittest` da biblioteca padrão, com features temporárias; (B) só execução manual registrada
  no converge.
- **Resposta aprovada:** **A**. O arquivo é `spec-kit/.specify/scripts/test_validate_spec.py` e roda com
  `py -m unittest discover -s spec-kit/.specify/scripts -p "test_*.py"`. O CI fica fora (Non-Goal).

## C-193 — Terceiro critério da issue (rodar o `spec:check` na 011)

- **Contexto:** a 011 vive só na `edicao/https-lan`, que nunca vai para a `development` e é atualizada por rebase.
- **Resposta aprovada:** o validador corrigido roda sobre uma cópia da `spec-kit/specs/011-https-lan` exportada da
  `edicao/https-lan` (`git archive`). Nada é editado na edição. Se faltar algum path, abre-se uma issue de desvio
  (AGENTS §14).

## C-194 — Impacto de versão

- **Resposta aprovada:** sem incremento. Só muda `spec-kit/**` (`docs/versionamento.md` §2, AGENTS §13), e o instalador
  não muda.

## Resultado

CLOSED — C-191 a C-194 respondidas; nenhuma ambiguidade em aberto.
