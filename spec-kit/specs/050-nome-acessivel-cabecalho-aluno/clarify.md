# Clarify: Nome Acessível dos Botões do Cabeçalho do Aluno

Feature: `050-nome-acessivel-cabecalho-aluno`
Status: CLOSED

Decisões registradas em 2026-11-18 na correção da issue #149, pedida pelo responsável.

## C-5001 — Corrigir o app ou só o teste

- **Opções:** (A) só trocar o localizador do A13 (ex.: pelo `title`); (B) corrigir o nome acessível dos botões e
  ajustar o A13 para esperar a contagem.
- **Resposta:** **B**. (A) esconderia o defeito real: no celular, com selo, leitores de tela anunciam "1, botão". Com
  (B), o A13 passa a verificar também que o aviso do arquivo chegou ao aluno.
- **Impacto em spec:** RF-5001 a RF-5004.

## C-5002 — Formato do nome com contagem

- **Opções:** (A) só o número entre parênteses ("Arquivos da aula (1)"); (B) número com a unidade ("Arquivos da aula
  (1 arquivo)", "Abrir Chat (3 não lidas)").
- **Resposta:** **B**: o número sozinho não diz o que conta. O rótulo vem primeiro, para conter o texto visível
  (WCAG 2.5.3) e manter a busca por `/Arquivos da aula/i`. O rótulo do Chat segue o que cada tela já expõe: `title`
  no celular ("Abrir Chat"/"Recolher Chat") e texto visível no computador ("Chat"), para não mudar nomes que os testes
  e os usuários já conhecem.
- **Impacto em spec:** RF-5001, RF-5002.

## C-5003 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `fix/nome-acessivel-cabecalho-aluno`.
- **Faixa de IDs:** `US-500x`, `RF-500x`, `RNF-500x`, `C-500x` e `T500x` (busca por `RF-50`, `C-50`, `T50` sem
  resultado).
- **Impacto de versão:** **PATCH**. Correção de acessibilidade, sem capacidade nova nem contrato
  (`docs/versionamento.md` §2). 2.2.0 → 2.2.1.

## Resultado

CLOSED: C-5001 a C-5003 respondidas, sem ambiguidade em aberto.
