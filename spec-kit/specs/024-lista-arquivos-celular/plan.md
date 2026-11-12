# Plan: Lista de Arquivos do Celular na Altura da Gaveta

Feature: `024-lista-arquivos-celular`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2401 a C-2403)

## 1. Summary

```text
chatDrawerMobile (fixed, top 0 / bottom 0, coluna)
├── mobileDrawerHeader (abas Chat/Arquivos)
└── mobileFilesContent (flex 1, minHeight 0, coluna, padding 14, sem overflow)   ← C-2401, C-2402
    └── mobileFilesList (flex 1, minHeight 0, overflowY auto, sem maxHeight)      ← RF-2401
        ├── itens
        └── files-end (alvo do scrollIntoView, RF-191)                             ← RF-2403

filesDrawer (desktop) └── filesList (maxHeight 380px)                              ← RF-2402, sem mudança
```

1. `Room.tsx`:
   - estilo novo `mobileFilesList` (literal, sem `maxHeight` e sem `padding`), usado na lista da aba Arquivos do
     celular;
   - `mobileFilesContent` com `minHeight: 0` e sem `overflowY`;
   - `data-testid="files-list"` na lista do desktop e `data-testid="mobile-files-list"` na do celular.
2. `Room.test.tsx`: testes de estilo no `describe` da 018 (largura 400 e 1024).

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Estilo | objeto literal em `styles`, no padrão do arquivo (inline styles React) | RF-2401 |
| Flex | `minHeight: 0` na moldura e na lista para o item flex poder encolher e rolar | RF-2401, C-2401 |
| Desktop | `filesList` intocado | RF-2402 |
| Testes | `toHaveStyle` com jsdom (layout real só na verificação manual) | §11 |
| Versão | PATCH via `npm run bump -- patch` | C-2403 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| jsdom não calcula layout | teste não prova a altura real | teste de estilo + verificação manual (T2402) |
| Lista com poucos itens ficar "esticada" | itens espaçados | `flex-direction: column` sem `justify-content`: itens no topo, `gap` fixo |
| Conflito de versão com o PR da 025 | `version:check` falha | rebase e novo bump no PR que entrar depois |

## Scope Lock

### IN

- estilos e `data-testid` da lista de arquivos do web dos alunos;
- testes desses estilos;
- nota de referência na US-16 da 003;
- incremento PATCH de versão.

### OUT

- gaveta "Arquivos da Aula" do desktop; chat; botão de download; hooks e services do web; backend; app desktop;
  `packages/**`.

### Allowed Paths

- `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`
- `spec-kit/specs/024-lista-arquivos-celular/**`
- `spec-kit/specs/003-classroom-interaction/spec.md` (só a nota na US-16)
- só na T2403, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/src/components/**`, `apps/web/index.html`,
  `apps/web/public/**`
- `apps/backend/**`, `apps/desktop/**`, `packages/**` (fora da T2403)
- `.github/**`, `scripts/**`

### Dependencies

- Nenhuma nova. Internas: `Room.tsx` e sua suíte de testes existente.

### Non-Goals

- Trocar `⬇ Baixar` pelo ícone `Download`; extrair a lista para componente compartilhado; mudar o layout do desktop.

## 4. Validation

- `npm run test -w apps/web`, `npm run lint`, `npm run spec:check -- spec-kit/specs/024-lista-arquivos-celular`.
- Manual no celular ou emulação (T2402).
