# Converge: Favicon do Aluno Igual ao Ícone do Header do Desktop

Feature: `045-favicon-transparente`
Status: DONE
Branch: `feat/favicon-transparente`, a partir da `development` @ `a2d1887` (2.1.1)

## 1. Evidências

- T4501: `npx vitest run src/favicon.test.ts` verde com a asserção nova (`favicon-32.png` RGBA). Como previsto no
  analyze §5, ela já passava com o favicon antigo, que também era RGBA; a ausência do quadrado é verificada pelos
  cantos com alfa 0 e visualmente.
- T4502: PNGs gerados por um script PowerShell com `System.Drawing` no scratchpad, a partir do
  `packages/ui/src/assets/mlab-logo-mark.png` (280×192):
  - `favicon-32.png`: 32×32 `Format32bppArgb`, IHDR byte 25 = 6, pixel (0,0) com alfa 0, centro azul opaco;
  - `apple-touch-icon.png`: 180×180 `Format24bppRgb`, IHDR byte 25 = 2, pixel (0,0) branco.
- T4502: `npx vitest run` em `apps/web` com 5 arquivos e 60 testes verdes; `npm run lint` (`tsc --noEmit`) verde.
- Conferência visual: o favicon novo e o antigo lado a lado, em 16, 32 e 96 px, sobre o fundo de aba claro
  (`#FFFFFF`) e o escuro (`#35363A`) do Chrome. O novo mostra o notebook, o painel de alunos e o sinal sem quadrado,
  maior que o antigo, legível nos dois temas. A conferência foi numa composição de imagem, não numa aba real.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4501 | `favicon-32.png` 32×32 RGBA, mark 32×22 em (0, 5), cantos transparentes; teste do byte 25 = 6 |
| RF-4502 | `apple-touch-icon.png` 180×180 RGB, branco, mark 158×108 em (11, 36); teste do byte 25 = 2 |
| RF-4503 | `index.html` e `MLAB-logo.png` sem diff; teste dos links verde |
| RNF-4501 | nenhuma dependência nova; script fora do repositório |
| RNF-4502 | conferência visual nos dois temas (§1) |

## 3. Desvios registrados

- Nenhum.

## 4. Trabalho restante

- Nenhum nesta feature. O #131 fica resolvido pelo PR desta branch.

## 5. Impacto de versão

**PATCH** (C-4503), 2.1.1 → 2.1.2: troca de asset visual do web do aluno, sem capacidade nova nem contrato
(`docs/versionamento.md` §2).
