# Tasks: Pacote Linux Gerado pelo WSL Leva o Binário Linux do koffi

Feature: `048-koffi-linux-no-pacote-wsl`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- um commit atômico por task, com `Ref: T480x` e `Refs #138`.

### T4801 — Binário Linux do koffi no build pelo WSL
[x] T4801
Allowed Paths: `scripts/build-linux-wsl.js`, `spec-kit/specs/048-koffi-linux-no-pacote-wsl/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`, `.github/**`,
`scripts/build-backend.js`, `scripts/bump-version.mjs`
Checks:
- [x] No caminho Windows, `ensureLinuxKoffi()` baixa `@koromix/koffi-linux-x64` na versão do `koffi`, confere versão e
  sha512 com o `package-lock.json` e extrai nos `node_modules` (RF-4801, RF-4802).
- [x] A chamada ao WSL roda em `try/finally`; a limpeza remove só o diretório criado pelo script (RF-4803).
- [x] Caminho Linux nativo sem mudança (RNF-4801).
- [x] Integridade divergente interrompe o build antes do `electron-builder`: com o `integrity` alterado só no disco
  (restaurado em seguida, sem commit), o script baixa, acusa "integridade ... não confere com o package-lock.json
  (sha512)", sai com código 1 e não deixa nada em `node_modules`.
- [x] Funciona com o `tar` do Git Bash (GNU) e do Windows: a extração usa caminhos relativos ao diretório
  temporário. O `koffi` é localizado pelo pacote resolvido, porque o `exports` dele não expõe `package.json`.

### T4802 — Verificação do pacote gerado
[x] T4802
Depends On: T4801
Allowed Paths: `spec-kit/specs/048-koffi-linux-no-pacote-wsl/**`
Prohibited Paths: `apps/**`, `packages/**`, `scripts/**`, `package.json`, `package-lock.json`
Checks:
- [x] Antes (`development`): o `.deb` de `npm run make:linux:deb` só tem `koffi-win32-x64`, e o Electron do pacote
  falha ao carregar o `koffi` no WSL.
- [x] Depois: o `.deb` contém `@koromix/koffi-linux-x64/linux_x64/koffi.node`, e o Electron do pacote carrega o `koffi`
  do `app.asar` e abre o display X no WSLg.
- [x] Depois do build, `node_modules/@koromix/koffi-linux-x64` não existe no Windows e o `package-lock.json` não muda
  (RF-4803).
- [x] Evidência em `evidencias/t4802-pacote-wsl.log`.

### T4803 — Converge
[x] T4803
Depends On: T4802
Allowed Paths: `spec-kit/specs/048-koffi-linux-no-pacote-wsl/**`
Prohibited Paths: `apps/**`, `packages/**`, `scripts/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (sem incremento, C-4803).
- [x] `npm run spec:check -- spec-kit/specs/048-koffi-linux-no-pacote-wsl` com PASS.
