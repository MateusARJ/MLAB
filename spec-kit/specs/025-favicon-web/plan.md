# Plan: Favicon Próprio do Web App dos Alunos

Feature: `025-favicon-web`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2501 a C-2504)

## 1. Summary

```text
apps/web/public/favicon.svg ──(script descartável, Chromium do Playwright)──► favicon-32.png
                                                                           └► apple-touch-icon.png
apps/web/index.html:
  <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

1. `favicon.svg`: `viewBox="0 0 32 32"`; `<rect rx="7">` `#0f172a` de borda a borda; moldura do notebook em branco
   (`#f8fafc`), tela com gradiente azul da marca, cursor branco, dois arcos de sinal azuis no canto superior direito.
   Formas com pelo menos 2 unidades de espessura.
2. PNGs renderizados do SVG: 32×32 com cantos transparentes; 180×180 opaco (fundo `#0f172a` de ponta a ponta).
3. `index.html` com os três links; o SVG vem depois do PNG para ter preferência nos navegadores que o aceitam.
4. `apps/web/src/favicon.test.ts`: lê `index.html`, `public/` e o cabeçalho IHDR dos PNGs com `fs`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Formato | SVG inline, sem `<text>`, sem `<image>`, < 2 KB | RF-2501, RNF-2502 |
| Contraste | fundo escuro próprio, sem media query | RF-2502 |
| PNG | `page.screenshot` no Chromium do Playwright, script no scratchpad | RF-2503, C-2503 |
| Teste | vitest com `fs` e `path` relativos ao `apps/web` | §11 |
| Versão | PATCH via `npm run bump -- patch` | C-2504 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Cache do favicon | verificação mostra o ícone antigo | recarregar sem cache / aba anônima na T2503 |
| Detalhe pequeno demais em 16px | borrão | só formas grossas; conferir a 16px na T2503 |
| Navegador preferir o PNG ao SVG | ícone menos nítido em telas de alta densidade | SVG declarado por último, sem `sizes` |

## Scope Lock

### IN

- favicon SVG, fallbacks PNG e links no `index.html` do web dos alunos;
- teste dos ícones;
- incremento PATCH de versão.

### OUT

- app desktop; logo das páginas (`MLAB-logo.png`); manifesto PWA; `favicon.ico`; backend; `packages/**`.

### Allowed Paths

- `apps/web/index.html`
- `apps/web/public/favicon.svg`, `apps/web/public/favicon-32.png`, `apps/web/public/apple-touch-icon.png`
- `apps/web/src/favicon.test.ts`
- `spec-kit/specs/025-favicon-web/**`
- só na T2504, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/web/public/MLAB-logo.png`, `apps/web/src/assets/**`, `apps/web/src/pages/**`, `apps/web/src/components/**`
- `apps/desktop/**`, `apps/backend/**`, `packages/**` (fora da T2504)
- `.github/**`, `scripts/**`

### Dependencies

- Nenhuma nova. Ferramenta usada só fora do repositório: `@playwright/test` (já em `apps/web`).

### Non-Goals

- Redesenhar a logo da marca; trocar ícones do desktop; PWA instalável.

## 4. Validation

- `npm run test -w apps/web`, `npm run lint`, `npm run build -w apps/web`,
  `npm run spec:check -- spec-kit/specs/025-favicon-web`.
- Manual em Chrome, Firefox e Edge, tema claro e escuro (T2503).
