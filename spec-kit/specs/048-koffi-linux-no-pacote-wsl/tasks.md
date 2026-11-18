# Tasks: Pacote Linux Gerado pelo WSL Leva o Binário Linux do koffi

Feature: `048-koffi-linux-no-pacote-wsl`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- um commit atômico por task, com `Ref: T480x` e `Refs #138`.

### T4801 — Binário Linux do koffi no build pelo WSL
[ ] T4801
Allowed Paths: `scripts/build-linux-wsl.js`, `spec-kit/specs/048-koffi-linux-no-pacote-wsl/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`, `.github/**`,
`scripts/build-backend.js`, `scripts/bump-version.mjs`
Checks:
- [ ] No caminho Windows, `ensureLinuxKoffi()` baixa `@koromix/koffi-linux-x64` na versão do `koffi`, confere versão e
  sha512 com o `package-lock.json` e extrai nos `node_modules` (RF-4801, RF-4802).
- [ ] A chamada ao WSL roda em `try/finally`; a limpeza remove só o diretório criado pelo script (RF-4803).
- [ ] Caminho Linux nativo sem mudança (RNF-4801).
- [ ] Integridade divergente interrompe o build antes do `electron-builder` (teste com o lockfile alterado numa cópia
  temporária, sem commit).

### T4802 — Verificação do pacote gerado
[ ] T4802
Depends On: T4801
Allowed Paths: `spec-kit/specs/048-koffi-linux-no-pacote-wsl/**`
Prohibited Paths: `apps/**`, `packages/**`, `scripts/**`, `package.json`, `package-lock.json`
Checks:
- [ ] Antes (`development`): o `.deb` de `npm run make:linux:deb` não tem `koffi-linux-x64`.
- [ ] Depois: o `.deb` contém `@koromix/koffi-linux-x64/linux_x64/koffi.node`, e o Electron do pacote carrega o `koffi`
  do `app.asar` no WSL.
- [ ] Depois do build, `node_modules/@koromix/koffi-linux-x64` não existe no Windows e o `git status` está limpo
  (RF-4803).
- [ ] Evidência em `evidencias/`.

### T4803 — Converge
[ ] T4803
Depends On: T4802
Allowed Paths: `spec-kit/specs/048-koffi-linux-no-pacote-wsl/**`
Prohibited Paths: `apps/**`, `packages/**`, `scripts/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (sem incremento, C-4803).
- [ ] `npm run spec:check -- spec-kit/specs/048-koffi-linux-no-pacote-wsl` com PASS.
