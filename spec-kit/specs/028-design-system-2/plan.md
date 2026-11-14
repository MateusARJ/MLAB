# Plan: Design System 2.0 com Tema Claro e Escuro

Feature: `028-design-system-2`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2801 a C-2809)
ADR: não se aplica (C-2808)

## 1. Summary

```text
packages/ui
  styles/tokens.css      primitivos + tokens semânticos; [data-theme="dark"|"light"]        (RF-2801)
  styles/components.css  classes ml-* com hover/foco/desabilitado em CSS                    (RF-2805)
  styles/fonts/*.woff2   Atkinson Hyperlegible Next e Mono, via @font-face                  (RF-2803)
  tokens.ts              colors/radii/typography → var(--token)                             (RF-2801)
  ThemeToggle.tsx        initTheme(), useTheme(), <ThemeToggle/> (localStorage mlab-theme)  (RF-2802)
  icons.tsx + index.ts   lucide-react reexportado com os nomes atuais                       (RF-2804)
  Brand.tsx + assets/    <BrandMark/> com a logo sem nome                                   (RF-2806)

apps/desktop/src/renderer/pages   ProfessorEntry, Dashboard (etapa 1), Room (etapa 2 + ao vivo): só JSX e estilos
apps/web/src/pages                Join, Room: só JSX e estilos
apps/web/public                   favicon-32.png e apple-touch-icon.png novos; favicon.svg excluído  (RF-2814)
```

1. `@mlab/ui` importa `tokens.css` e `components.css` no `index.ts` e chama `initTheme()` ao carregar; os apps não
   precisam de configuração extra (Vite já resolve CSS e `woff2` importados pelo pacote).
2. Os componentes base mantêm as props. O estilo sai do `style` inline e vai para classes `ml-*`.
3. As páginas são reescritas na marcação e nos estilos. O estado, os efeitos, os handlers e as chamadas a hooks e
   serviços ficam como estão.
4. Barra de marcação interna (RF-2815): uma função pura `clampAnnotationToolbarPosition` limita a posição pela
   altura e largura reais da barra e da prévia; é usada no arraste e quando a prévia muda de tamanho
   (`ResizeObserver`). A barra recebe `maxHeight` igual à altura da prévia menos a margem e `overflowY: auto`.
5. Favicon (RF-2814): os PNGs são gerados uma vez, fora do repositório, a partir de
   `packages/ui/src/assets/mlab-logo-mark.png` sobre um quadrado `#0f172a` com cantos arredondados (o de 180×180 é
   opaco de ponta a ponta).

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Tokens | CSS custom properties; `tokens.ts` aponta para `var(--…)` para não quebrar os imports atuais | RF-2801 |
| Tema | `data-theme` no `<html>`; salvo em `localStorage` (`mlab-theme`); padrão do sistema | RF-2802 |
| Fonte | Atkinson Hyperlegible Next/Mono, licença OFL, `woff2` no pacote | RF-2803, RNF-2803 |
| Ícones | `lucide-react` (licença ISC); nomes antigos mantidos por reexportação | RF-2804 |
| Ordem das dependências | `lucide-react` entra na T2801; `@carbon/icons-react` sai na T2803, junto com a troca dos ícones, para cada commit compilar | RNF-2804 |
| Atenção sem amarelo | `--attention` azul (escuro) e cinza (claro) | C-2805 |
| Barra flutuante fora do MLab | intocada; os testes dela fixam cor e geometria | spec §3 |
| Lógica | só a posição da barra de marcação interna | RNF-2801, C-2807 |
| Testes | mudam rótulos e papéis; teste novo do clamp; teste do favicon atualizado | RNF-2805 |
| Versão | MAJOR via `npm run bump -- major` | C-2809 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Regressão de comportamento ao reescrever JSX | função some da tela | hooks e handlers intocados; suítes do desktop (308) e da web verdes; validação manual do responsável |
| Commits intermediários com visual misto | só durante a branch | cada commit compila; o PR entra inteiro |
| Favicon em cache | ícone antigo na aba | recarregar sem cache na validação |
| Fonte não carregar no Electron | cai na fonte do sistema | `font-family` com fallback; `woff2` empacotado pelo Vite |
| Conflito de versão com outro PR enquanto este espera | `version:check` falha | atualizar a branch e refazer só o commit de release |
| E2E do aluno com textos novos | teste quebra | textos do e2e atualizados; execução registrada no converge |

## Scope Lock

### IN

- design system em `packages/ui` (tokens, temas, fonte, ícones, componentes, marca);
- marcação e estilos das telas do professor e do aluno;
- favicon da web; barra de marcação interna dentro da prévia (#89);
- testes afetados, `docs/design-system.md`, `README.md`, notas nas specs 001 e 025;
- incremento MAJOR.

### OUT

- backend, processo principal, preload, hooks, serviços, `packages/types`, contratos;
- barra flutuante fora do MLab;
- issues #90 e #91; funcionalidades do protótipo fora das specs.

### Allowed Paths

- `packages/ui/package.json`, `packages/ui/src/**`
- `apps/desktop/src/renderer/index.css`, `apps/desktop/src/renderer/pages/**`,
  `apps/desktop/src/renderer/components/AppInfoFooter.tsx`, `apps/desktop/src/renderer/components/FileDropZone.tsx`
- `apps/web/index.html`, `apps/web/public/**`, `apps/web/src/index.css`, `apps/web/src/App.tsx`,
  `apps/web/src/pages/**`, `apps/web/src/favicon.test.ts`, `apps/web/e2e/**`
- `docs/design-system.md`, `README.md`
- `spec-kit/specs/028-design-system-2/**`, `spec-kit/specs/001-screen-share-core/spec.md`,
  `spec-kit/specs/025-favicon-web/spec.md`
- `package-lock.json` (T2801 e T2803, por `npm install`)
- só na T2810, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/**`
- `apps/desktop/src/main/**`, `apps/desktop/src/preload.ts`, `apps/desktop/src/renderer/hooks/**`,
  `apps/desktop/src/renderer/services/**`,
  `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx` e o teste dele
- `apps/web/src/hooks/**`, `apps/web/src/services/**`
- `packages/types/**`
- `spec-kit/specs/*/contracts/**`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Entra: `lucide-react` em `packages/ui`.
- Sai: `@carbon/icons-react`.
- Fontes Atkinson Hyperlegible Next e Mono como arquivos, sem pacote npm.

### Non-Goals

- mudar padrões de captura, gravação ou áudio;
- QR code, zoom do aluno, fixar janela;
- redesenhar a barra flutuante fora do MLab;
- corrigir o aviso de mão levantada (#90).

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma decisão de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: `packages/ui` tem dois consumidores reais (desktop e web).
- [ ] Princípio VIII: converge ao final (T2810).
- [x] Princípio IX: desvios #89 (corrigido aqui, C-2807), #90 e #91 registrados.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-13 | Design system próprio, claro e escuro, telas iguais ao protótipo | C-2801 |
| 2026-11-13 | Só interface; padrões mantidos | C-2802 |
| 2026-11-13 | Logo sem nome no cabeçalho | C-2804 |
| 2026-11-13 | Sem amarelo; atenção azul/cinza; pausa girando | C-2805 |
| 2026-11-14 | Rótulos novos, com nota na 001 | C-2803 |
| 2026-11-14 | Favicon com a logo do cabeçalho; `favicon.svg` excluído | C-2806 |
| 2026-11-14 | #89 corrigida na 028 | C-2807 |
| 2026-11-14 | MAJOR 2.0.0; PR em rascunho até a 1.15.0 ir para a `main` | C-2809 |
