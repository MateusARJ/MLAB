# Plan: Nome Acessível dos Botões do Cabeçalho do Aluno

Feature: `050-nome-acessivel-cabecalho-aluno`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-5001 a C-5003)

## 1. Summary

```text
<button title="Arquivos da Aula" aria-label="Arquivos da aula (1 arquivo)">
  [ícone aria-hidden] [texto visível só fora do celular] <span aria-hidden="true">1</span>
</button>

<button title="Abrir Chat" aria-label={isMobile ? "Abrir Chat" : "Chat"} + " (3 não lidas)">
  [ícone aria-hidden] [texto "Chat" só fora do celular] <span aria-hidden="true">3</span>
</button>
```

1. `apps/web/src/pages/Room.tsx`:
   - funções puras no módulo: `filesButtonLabel(count)` e `withUnread(label, count)` (singular/plural, `99+`);
   - `aria-label` nos dois botões do cabeçalho; `aria-hidden="true"` nos selos desses botões; `title` sem mudança.
2. `apps/web/src/pages/Room.test.tsx`: `describe` novo da 050 (celular e computador, com e sem contagem).
3. `apps/web/e2e/aluno.e2e.ts`: no A13, localizador `{ name: /Arquivos da aula \(1 arquivo\)/i }`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Nome acessível | `aria-label` calculado; prevalece sobre conteúdo e `title` | C-5001 |
| Formato | rótulo + " (N unidade)", singular/plural, `99+` | C-5002 |
| Rótulo do Chat | `title` no celular, "Chat" no computador | C-5002 |
| Selos | `aria-hidden="true"` (a contagem já está no nome) | RF-5003 |
| E2E | A13 espera o nome com a contagem | RF-5004 |
| Versão | PATCH (2.2.0 → 2.2.1) | C-5003 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Nome do Chat no computador mudar | testes `/^Chat$/` quebram | "Chat" sem contagem quando não há não lidas (C-5002) |
| Contagem do nome divergir do selo | anúncio errado | mesma variável (`sharedFiles.length`, `unreadCount`) e mesma regra do `99+` |
| A13 esperar a contagem e o aviso não chegar | timeout do teste | é o comportamento exigido (o aluno precisa ver o arquivo); falha passa a ser real |

## Scope Lock

### IN

- nome acessível e selos dos botões Arquivos e Chat do cabeçalho do aluno; localizador do A13.

### OUT

- aparência dos botões; menu em tela cheia; gavetas e abas; desktop do professor; backend; `packages/`.

### Allowed Paths

- `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/e2e/aluno.e2e.ts`
- `spec-kit/specs/050-nome-acessivel-cabecalho-aluno/**`
- só na T5004, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/e2e/fixtures.ts`, `apps/desktop/**`,
  `apps/backend/**`, `packages/**/src/**`
- `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- `aria-expanded`/`aria-controls` nos botões do cabeçalho;
- revisar a acessibilidade das demais telas do aluno.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a atributos de dois botões e a um localizador do e2e.
- [ ] Princípio VIII: converge ao final (T5003).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-18 | Corrigir o nome acessível no app e o localizador do A13 | C-5001 |
| 2026-11-18 | Rótulo + contagem com unidade; Chat com `title` no celular e "Chat" no computador | C-5002 |
| 2026-11-18 | Uma feature, um PR, IDs `500x`, PATCH | C-5003 |
