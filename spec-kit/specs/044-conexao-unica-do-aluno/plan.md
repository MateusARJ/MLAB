# Plan: Uma Única Conexão de Sinalização por Entrada do Aluno

Feature: `044-conexao-unica-do-aluno`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4401 e C-4402)

## 1. Summary

```text
antes:  efeito → connect() → new WebSocket (ws1)       ← StrictMode: cleanup fecha ws1 em CONNECTING
        efeito → connect() → new WebSocket (ws2)       ← hub registra ws2 e depois ws1 → 4001 no ws2

depois: efeito → setTimeout(connect, 0)                ← StrictMode: cleanup cancela o timer
        efeito → setTimeout(connect, 0) → ws (único)
```

1. `apps/web/src/hooks/useWebRTCSubscriber.ts`: o efeito de conexão agenda `connect()` com `setTimeout(..., 0)` num
   ref (`initialConnectTimerRef`); o cleanup cancela o timer antes do restante da limpeza.
2. `apps/web/src/hooks/useWebRTCSubscriber.test.ts`: teste com `renderHook(..., { wrapper: React.StrictMode })` que
   exige um único WebSocket; os testes existentes avançam um tick antes de ler o WebSocket criado.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Abertura da conexão | adiada um tick, cancelável no cleanup | C-4401 |
| Reconexão com backoff | inalterada (já usa timer próprio) | RF-4402 |
| Tratamento do `4001` | inalterado | RF-4402 |
| Versão | PATCH, 2.1.1 | C-4402 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Testes que leem o WebSocket logo após `renderHook` | testes falham | avançar um tick (`act` assíncrono ou `vi.advanceTimersByTime(0)`) |
| Atraso de um tick na primeira conexão | nenhum perceptível | timer de 0 ms |

## Scope Lock

### IN

- abertura da conexão de sinalização no `useWebRTCSubscriber` e seus testes unitários.

### OUT

- backend, regra de sessão única e fechamento `4001`;
- `main.tsx`, páginas, e2e e fixtures.

### Allowed Paths

- `apps/web/src/hooks/useWebRTCSubscriber.ts`
- `apps/web/src/hooks/useWebRTCSubscriber.test.ts`
- `spec-kit/specs/044-conexao-unica-do-aluno/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (somente pelo `npm run bump`)

### Prohibited Paths

- `apps/backend/**`, `apps/desktop/**`, `packages/*/src/**`
- `apps/web/src/main.tsx`, `apps/web/src/pages/**`, `apps/web/e2e/**`
- `spec-kit/specs/027-matricula-unica-na-transmissao/**`, `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova. React, Vitest e Testing Library, já usados.

### Non-Goals

- mudar a regra de sessão única ou o aviso da 005/C-502;
- tornar o e2e independente do modo de desenvolvimento do Vite.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda; o servidor continua decidindo o `4001`.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a um hook e seus testes.
- [ ] Princípio VIII: converge ao final (T4404).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-16 | Adiar a abertura do WebSocket no hook, cancelável no cleanup | C-4401 |
| 2026-11-16 | Uma feature, um PR, IDs `440x`, PATCH | C-4402 |
