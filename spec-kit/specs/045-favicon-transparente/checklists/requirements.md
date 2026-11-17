# Checklist de Requisitos: Favicon do Aluno Igual ao Ícone do Header do Desktop

Feature: `045-favicon-transparente`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4501 a RF-4503, RNF-4501, RNF-4502) tem task.
- [x] Ambiguidades fechadas (C-4501 a C-4503): fundo do apple-touch-icon, premissa do 028/C-2806, entrega e versão.
- [x] Evidência registrada: tamanhos e formatos dos PNGs atuais e do `mlab-logo-mark.png`, `index.html`,
  `favicon.test.ts`, `Brand.tsx`.
- [x] Edge case da proporção não quadrada coberto (spec §9).

## Coerência

- [x] As emendas ao 028/RF-2814 e ao 025/RF-2502 estão registradas (C-4502) e serão anotadas nas duas specs.
- [x] Nenhum contrato muda; PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `450x` não colidem (busca por `RF-45`, `C-45`, `T45` sem resultado).
- [x] Não há `docs/requirements/**` citando RF-2502 ou RF-2814 para espelhar.

## Viabilidade

- [x] `System.Drawing` disponível no Windows do responsável; nenhuma dependência nova no repositório.

## Resultado

APPROVED
