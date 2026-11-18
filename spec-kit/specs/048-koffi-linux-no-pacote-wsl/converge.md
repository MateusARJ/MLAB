# Converge: Pacote Linux Gerado pelo WSL Leva o Binário Linux do koffi

Feature: `048-koffi-linux-no-pacote-wsl`
Status: DONE
Branch: `fix/koffi-linux-no-pacote-wsl`, a partir da `development` @ `b17d684` (2.1.4)

## 1. Evidências

`evidencias/t4802-pacote-wsl.log`:

- Antes (script da `development`): o `.deb` de `npm run make:linux:deb` só tem
  `@koromix/koffi-win32-x64/win32_x64/koffi.node`; no WSL, o Electron do pacote falha ao carregar o `koffi` ("Cannot
  find the native Koffi module").
- Depois: o script baixa `@koromix/koffi-linux-x64@3.3.4`, confere o sha512 e o remove ao fim; o `.deb` tem
  `@koromix/koffi-linux-x64/linux_x64/koffi.node` (e `musl_x64`), e o Electron do pacote carrega o `koffi` do
  `app.asar` e abre o display X no WSLg.
- Depois do build, `node_modules/@koromix` no Windows só tem `koffi-win32-x64`; `package-lock.json` sem mudança.
- Integridade divergente (alterada só no disco e restaurada): o build para com código 1 antes do WSL, sem deixar nada
  nos `node_modules`.
- O `tar` do Git Bash (GNU) extraiu no build; o `tar.exe` do Windows extraiu o mesmo `.tgz` com os mesmos argumentos.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4801 | `ensureLinuxKoffi()` em `scripts/build-linux-wsl.js`; log "conferido e colocado em node_modules"; `.deb` com `linux_x64/koffi.node` |
| RF-4802 | conferência de versão e sha512 com o `package-lock.json`; teste de integridade divergente com código 1 |
| RF-4803 | `try/finally` em volta do WSL; log "removido de node_modules"; `node_modules/@koromix` sem o pacote Linux depois do build |
| RNF-4801 | diff só no caminho Windows do script (o bloco `process.platform === 'linux'` não muda) |
| RNF-4802 | nenhuma dependência nova: `npm pack`, `tar` e `node:crypto` |
| RNF-4803 | diff só em `scripts/build-linux-wsl.js` e nos artefatos da feature |

## 3. Divergências (código ≠ spec/plan)

- Nenhuma. O plan previa localizar o `koffi` por `require.resolve('koffi/package.json')`, mas o `exports` do `koffi`
  não expõe esse arquivo; o script resolve o pacote e sobe até a raiz dele. A extração usa caminhos relativos ao
  diretório temporário, porque o GNU tar do Git Bash leria `C:\...` como host remoto.

## 4. Desvios registrados

- Nenhum novo.

## 5. Trabalho restante

- Nenhum nesta feature. A #138 fica resolvida pelo PR desta branch.
- Não verificado: o AppImage (`make:linux:appimage`), que sai do mesmo `electron-builder` sobre os mesmos
  `node_modules`, e a interface do app instalado (só o carregamento do `koffi` e a conexão X).

## 6. Impacto de versão

**Sem incremento** (C-4803): a mudança fica em `scripts/` e não altera `apps/` nem `packages/`; o instalador oficial,
gerado pelo CI, não muda (`AGENTS.md` §13).
