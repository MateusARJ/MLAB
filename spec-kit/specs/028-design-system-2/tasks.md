# Tasks: Design System 2.0 com Tema Claro e Escuro

Feature: `028-design-system-2`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `npm run test -w apps/desktop`, `npm run test -w apps/web` e `npm run lint` verdes antes de marcar `[x]` nas tasks
  que tocam `apps/` ou `packages/`;
- um commit atômico por task, com `Ref: T28xx` e `Refs #92`;
- nenhuma task toca hooks, serviços, processo principal, backend ou `packages/types`.

### T2801 — Dependência de ícones e fontes embutidas
[ ] T2801
Allowed Paths: `packages/ui/package.json`, `package-lock.json`, `packages/ui/src/styles/fonts/**`
Prohibited Paths: `apps/**`, `packages/types/**`, `packages/ui/src/*.tsx`, `package.json`
Checks:
- [ ] `lucide-react` em `packages/ui/package.json` e no lockfile (RF-2804).
- [ ] Arquivos `woff2` da Atkinson Hyperlegible Next e Mono em `styles/fonts/` (RF-2803).

### T2802 — Tokens e temas claro e escuro
[ ] T2802
Depends On: T2801
Allowed Paths: `packages/ui/src/styles/tokens.css`, `packages/ui/src/tokens.ts`, `packages/ui/src/ThemeToggle.tsx`,
`packages/ui/src/index.ts`
Prohibited Paths: `apps/**`, `packages/types/**`, `package.json`
Checks:
- [ ] Tokens semânticos para `data-theme` escuro e claro; `@font-face` das fontes (RF-2801, RF-2803).
- [ ] `tokens.ts` mantém `colors`, `radii` e `typography` (RF-2801).
- [ ] `initTheme`, `useTheme` e `ThemeToggle` com `localStorage` `mlab-theme` (RF-2802).
- [ ] Sem amarelo nos tokens; atenção azul no escuro e cinza no claro (RF-2807).

### T2803 — Componentes base, ícones e marca
[ ] T2803
Depends On: T2802
Allowed Paths: `packages/ui/src/**`, `packages/ui/package.json`, `package-lock.json`
Prohibited Paths: `apps/**`, `packages/types/**`, `package.json`
Checks:
- [ ] `Button`, `IconButton`, `TextInput`, `StatusBadge`, `Alert` e `Card` com as mesmas props e estados em CSS
  (RF-2805).
- [ ] Ícones Lucide reexportados com os nomes atuais; `@carbon/icons-react` removido (RF-2804, RNF-2804).
- [ ] `BrandMark` com a logo sem nome (RF-2806).

### T2804 — Desktop: identificação e preparo da aula
[ ] T2804
Depends On: T2803
Allowed Paths: `apps/desktop/src/renderer/index.css`, `apps/desktop/src/renderer/pages/ProfessorEntry.tsx`,
`apps/desktop/src/renderer/pages/ProfessorEntry.test.tsx`, `apps/desktop/src/renderer/pages/Dashboard.tsx`,
`apps/desktop/src/renderer/pages/Dashboard.test.tsx`, `apps/desktop/src/renderer/components/AppInfoFooter.tsx`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/preload.ts`, `apps/desktop/src/renderer/hooks/**`,
`apps/desktop/src/renderer/services/**`, `apps/web/**`, `apps/backend/**`, `packages/**`, `package.json`
Checks:
- [ ] Identificação com "Como a turma vai ver seu nome?", "Seu nome" e "Continuar" (RF-2808).
- [ ] Etapa 1 com "Nome da aula", "Link direto" (`mlab.local:8080`) e "Link pelo IP" (RF-2809).
- [ ] Botão de tema e logo no cabeçalho (RF-2802, RF-2806).
- [ ] Testes de `ProfessorEntry` e `Dashboard` verdes.

### T2805 — Desktop: escolha da transmissão e sala ao vivo
[ ] T2805
Depends On: T2804
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`,
`apps/desktop/src/renderer/pages/RoomHandRaise.test.tsx`, `apps/desktop/src/renderer/pages/RoomFileDrop.test.tsx`,
`apps/desktop/src/renderer/components/FileDropZone.tsx`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/preload.ts`, `apps/desktop/src/renderer/hooks/**`,
`apps/desktop/src/renderer/services/**`,
`apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`, `apps/web/**`, `apps/backend/**`,
`packages/**`, `package.json`
Checks:
- [ ] Etapa 2 com "O que transmitir", "Qualidade" e "Gravação"; padrões 1080p 60 fps, sem gravação, mudo, `.webm`
  (RF-2810).
- [ ] Sala ao vivo com cabeçalho de estado, barra de controles e painel com abas (RF-2811).
- [ ] Mão levantada sem amarelo (RF-2807).
- [ ] Estado, efeitos e handlers do `Room.tsx` sem mudança (RNF-2801).
- [ ] Testes `Room*` verdes.

### T2806 — Web: entrada e sala do aluno
[ ] T2806
Depends On: T2803
Allowed Paths: `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/App.tsx`,
`apps/web/src/pages/Join.tsx`, `apps/web/src/pages/Join.test.tsx`, `apps/web/src/pages/Room.tsx`,
`apps/web/src/pages/Room.test.tsx`, `apps/web/e2e/**`
Prohibited Paths: `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/public/**`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`, `package.json`
Checks:
- [ ] Entrada com "Nome completo", "Matrícula" e "Entrar na aula"; mensagem da matrícula conectada mantida (RF-2812).
- [ ] Sala com estado da conexão, mão, janela flutuante, tela cheia e abas; pausa com ícone girando (RF-2813).
- [ ] Tratamento do close `4002` (027) preservado no `Room.tsx`.
- [ ] Testes da web verdes.

### T2807 — Web: favicon com a logo do cabeçalho
[ ] T2807
Depends On: T2806
Allowed Paths: `apps/web/index.html`, `apps/web/public/favicon-32.png`, `apps/web/public/apple-touch-icon.png`,
`apps/web/public/favicon.svg`, `apps/web/src/favicon.test.ts`
Prohibited Paths: `apps/web/src/pages/**`, `apps/web/src/hooks/**`, `apps/web/public/MLAB-logo.png`,
`apps/desktop/**`, `apps/backend/**`, `packages/**`, `package.json`
Checks:
- [ ] `favicon-32.png` (32×32) e `apple-touch-icon.png` (180×180, opaco) com a logo do cabeçalho (RF-2814).
- [ ] `favicon.svg` excluído e sem link no `index.html` (RF-2814).
- [ ] `favicon.test.ts` atualizado e verde.

### T2808 — Desktop: barra de marcação dentro da prévia
[ ] T2808
Depends On: T2805
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`,
`apps/desktop/src/renderer/pages/annotationToolbarPosition.ts`,
`apps/desktop/src/renderer/pages/annotationToolbarPosition.test.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/preload.ts`, `apps/desktop/src/renderer/hooks/**`,
`apps/desktop/src/renderer/services/**`,
`apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`, `apps/web/**`, `apps/backend/**`,
`packages/**`, `package.json`
Checks:
- [ ] A posição é limitada pela altura e largura reais da barra e da prévia, no arraste e no redimensionamento
  (RF-2815).
- [ ] Prévia mais baixa que a barra: rolagem interna, nenhum botão fora da área (RF-2815).
- [ ] Teste unitário do limite; testes `Room*` verdes.

### T2809 — Documentação do design system
[ ] T2809
Depends On: T2806
Allowed Paths: `docs/design-system.md`, `README.md`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/**`, `package.json`
Checks:
- [ ] `docs/design-system.md` descreve tokens, temas, tipografia, ícones, componentes e a regra do amarelo (RF-2816).
- [ ] `README.md` sem menção a Carbon (RF-2816).

### T2810 — Converge e versão
[ ] T2810
Depends On: T2807, T2808, T2809
Allowed Paths: `spec-kit/specs/028-design-system-2/**`, `package.json`, `package-lock.json`, `apps/*/package.json`,
`packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `apps/backend/cmd/**`, `packages/**/src/**`,
`.github/**`
Checks:
- [ ] `converge.md` com evidências, desvios (#89, #90, #91) e impacto de versão (MAJOR, C-2809).
- [ ] `npm run bump -- major` e `npm run version:check`; commit `chore(release): versao 2.0.0`.
- [ ] `npm run spec:check -- spec-kit/specs/028-design-system-2` com PASS.
