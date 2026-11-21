# Plan: Remoção do Pacote Linux tar.gz

Feature: `055-pacote-linux-tar-gz`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-5501 e C-5502)

## 1. Summary

1. `apps/desktop/package.json`: tirar `"tar.gz"` de `build.linux.target` (RF-5501).
2. `.github/workflows/build-all.yml`: tirar `apps/desktop/dist/*.tar.gz` do `release_files` da perna Linux (RF-5502).
3. `README.md`: trocar a linha "Outras distribuições (.tar.gz)" pela indicação do AppImage e tirar o `.tar.gz` da
   tabela de builds; `docs/versionamento.md` §5: tirar o `.tar.gz` da lista de arquivos a conferir (RF-5503).

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Formato | remover, não gerar | C-5501 |
| Script de build | inalterado (já gera `AppImage deb`) | spec §3 |
| Versão | PATCH, 2.3.2 | C-5502 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Algum fluxo depender do `.tar.gz` | build ou release quebrar | nenhum `.tar.gz` é gerado hoje; o job "Build linux" do PR confirma |
| Usuário de distro sem `.deb` ficar sem opção | instalação | o README indica o AppImage, que roda em qualquer distribuição |

## Scope Lock

### IN

- Alvo `tar.gz` do electron-builder, padrão de envio da release e menções no README e no `docs/versionamento.md`.

### OUT

- `scripts/**`; código do app; notas de releases antigas; backend; web.

### Allowed Paths

- `apps/desktop/package.json`
- `.github/workflows/build-all.yml`
- `README.md`
- `docs/versionamento.md`
- `spec-kit/specs/055-pacote-linux-tar-gz/**`
- arquivos de versão alterados por `npm run bump` (`package.json`, `package-lock.json`, `apps/*/package.json`,
  `packages/*/package.json`)

### Prohibited Paths

- `scripts/**`, `apps/desktop/src/**`, `apps/web/src/**`, `apps/backend/**` exceto `package.json`,
  `packages/*/src/**`, `docs/releases/**`, `spec-kit/docs/adrs/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- Passar a gerar o `.tar.gz` (C-5501, opção B).
- Fazer o envio da release falhar quando um padrão não acha arquivo.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita à configuração de empacotamento e à documentação.
- [ ] Princípio VIII: converge ao final (T5503).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-20 | Remover o `.tar.gz` | C-5501 |
| 2026-11-20 | Branch e PR da/para a `main`; IDs `550x`; PATCH | C-5502 |
