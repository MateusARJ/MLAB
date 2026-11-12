# Converge: Favicon Próprio do Web App dos Alunos

Feature: `025-favicon-web`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-12
Commits avaliados: `6b01b66` (T2501), `06c12bd` (T2502)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2501 a C-2504), `plan.md`, `tasks.md` (T2501 a T2504)
- código: `apps/web/index.html`, `apps/web/public/favicon.svg`, `apps/web/public/favicon-32.png`,
  `apps/web/public/apple-touch-icon.png`; teste: `apps/web/src/favicon.test.ts`
- suítes: `npm run test -w apps/web`, `npm run lint` e `npm run build -w apps/web`
- verificação manual (T2503): aprovada pelo responsável nos navegadores ("aprovado").

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2501 | `favicon.svg` só com o símbolo (tela, cursor, ondas); teste "o SVG é quadrado, só vetorial, sem texto…"; manual (T2503) |
| RF-2502 | fundo `rect rx=7` `#0f172a` de borda a borda, sem media query; prévia em fundo branco e `#35363a` (T2501); manual (T2503) |
| RF-2503 | `favicon-32.png` 32×32 com cantos transparentes e `apple-touch-icon.png` 180×180 opaco; teste "os PNGs de fallback têm 32x32 e 180x180" |
| RF-2504 | `index.html` com os três links, SVG depois do PNG; `MLAB-logo.png` mantida; teste dos links e dos arquivos |
| RNF-2501 | nenhuma dependência nova; PNGs gerados por script no scratchpad (Playwright do `apps/web` + Chrome instalado), não versionado |
| RNF-2502 | SVG com 786 bytes, sem `<image>` |

Totais: web com 5 arquivos e 51 testes verdes; `npm run lint` verde; `npm run build -w apps/web` copia os três ícones
para `dist/`.

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

- O clarify (C-2503), o plan e o checklist foram ajustados em `003da4c` antes da T2501: o Chromium do Playwright não
  estava baixado, e o script usou o Chrome instalado. Sem efeito no resultado.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Nenhum automatizado. A nitidez na aba depende do navegador e foi coberta pela verificação manual.

## 6. Novas tasks necessárias

- Nenhuma na 025.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.14.3 | Ajuste visual de asset, sem capacidade nova nem mudança de contrato (C-2504). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o web app dos alunos tem favicon próprio em SVG, legível em 16/32px e com contraste em abas claras e
  escuras, com fallbacks PNG e `apple-touch-icon`.
