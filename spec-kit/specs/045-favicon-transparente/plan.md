# Plan: Favicon do Aluno Igual ao Ícone do Header do Desktop

Feature: `045-favicon-transparente`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4501 a C-4503)

## 1. Summary

```text
antes:  favicon-32.png        = quadrado #0f172a + mark ~24 px     apple-touch-icon = mark sobre #0f172a
depois: favicon-32.png        = mark 32×22, fundo transparente     apple-touch-icon = mark 158×108 sobre branco
```

1. `apps/web/src/favicon.test.ts`: cita a 045 e exige que o `favicon-32.png` seja RGBA (IHDR, byte 25 = 6).
2. PNGs gerados uma vez por um script PowerShell no scratchpad (fora do repositório), com `System.Drawing` do
   Windows, a partir de `packages/ui/src/assets/mlab-logo-mark.png`:
   - `favicon-32.png`: bitmap 32×32 `Format32bppArgb` transparente; o mark é reduzido em passos (280 → 128 → 32) com
     `HighQualityBicubic` e desenhado em 32×22 na posição (0, 5);
   - `apple-touch-icon.png`: bitmap 180×180 branco; mark 158×108 em (11, 36); salvo como `Format24bppRgb`.
3. Notas de emenda no topo da `025-favicon-web/spec.md` e da `028-design-system-2/spec.md`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Fonte | `packages/ui/src/assets/mlab-logo-mark.png` (só leitura) | RF-4501 |
| Geração | `System.Drawing`, script fora do repositório | RNF-4501 |
| Fundo do favicon | transparente | RF-4501, C-4502 |
| Fundo do apple-touch-icon | branco opaco | RF-4502, C-4501 |
| Versão | PATCH, 2.1.2 | C-4503 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Redução direta 280 → 32 perde detalhe | ícone borrado | redução em passos com `HighQualityBicubic` e conferência visual |
| Contorno escuro some em aba escura | menos contraste | o preenchimento branco e azul segue visível; conferência no Chrome (RNF-4502) |
| `System.Drawing` grava PNG com alfa no 180×180 | iOS mostra fundo preto | clonar para `Format24bppRgb` antes de salvar; teste do byte 25 = 2 |

## Scope Lock

### IN

- os dois PNGs de favicon do web, o teste do favicon e as notas de emenda da 025 e da 028.

### OUT

- `index.html`, logo das páginas, ícones do desktop, `packages/ui`.

### Allowed Paths

- `apps/web/public/favicon-32.png`
- `apps/web/public/apple-touch-icon.png`
- `apps/web/src/favicon.test.ts`
- `spec-kit/specs/045-favicon-transparente/**`
- `spec-kit/specs/025-favicon-web/spec.md` (só a nota de emenda)
- `spec-kit/specs/028-design-system-2/spec.md` (só a nota de emenda)
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (somente pelo `npm run bump`)

### Prohibited Paths

- `apps/web/index.html`, `apps/web/public/MLAB-logo.png`, `apps/web/src/pages/**`, `apps/web/src/hooks/**`
- `apps/desktop/**`, `apps/backend/**`, `packages/*/src/**`
- `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova. `System.Drawing` (Windows) só no script fora do repositório; Vitest, já usado.

### Non-Goals

- favicon SVG, `favicon.ico` ou manifesto PWA;
- mudar o `mlab-logo-mark.png` ou o header do desktop.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a dois assets e um teste.
- [x] Princípio VIII: converge ao final (T4503).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-16 | Favicon sem fundo, mark ocupando a largura | C-4502 |
| 2026-11-16 | Apple-touch-icon com fundo branco | C-4501 |
| 2026-11-16 | Uma feature, um PR, IDs `450x`, PATCH | C-4503 |
