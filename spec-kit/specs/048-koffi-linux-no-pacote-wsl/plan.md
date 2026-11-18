# Plan: Pacote Linux Gerado pelo WSL Leva o Binário Linux do koffi

Feature: `048-koffi-linux-no-pacote-wsl`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4801 a C-4803)

## 1. Summary

```text
antes:  Windows → wsl electron-builder --linux  (node_modules do Windows: só koffi-win32-x64) → pacote sem koffi Linux

depois: Windows → ensureLinuxKoffi():
            versão: koffi/package.json (optionalDependencies)  integridade: package-lock.json
            npm pack @koromix/koffi-linux-x64@<versão> → sha512 confere → tar → node_modules/@koromix/koffi-linux-x64
        → wsl electron-builder --linux → pacote com koffi Linux
        → finally: remove o diretório, se foi o script que criou
```

1. `scripts/build-linux-wsl.js`, só no caminho Windows: função `ensureLinuxKoffi()` que devolve uma função de limpeza.
   - Localiza o `koffi` instalado a partir de `apps/desktop` (`require.resolve('koffi/package.json')`) e o
     `node_modules` que o contém.
   - Se `@koromix/koffi-linux-x64` já existe, não faz nada.
   - Lê a versão nas `optionalDependencies` do `koffi` e a entrada do `package-lock.json` da raiz; confere a versão.
   - `npm pack @koromix/koffi-linux-x64@<versão> --pack-destination <temp>`; calcula o sha512 do `.tgz` e compara com o
     `integrity` do lockfile.
   - Extrai com `tar -xzf` num diretório temporário e copia `package/` para o destino.
   - Erros param o build com mensagem `[build-linux-wsl]` e código 1.
2. A chamada ao WSL roda dentro de `try/finally`; o `finally` chama a limpeza e o diretório temporário é apagado.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Como levar o binário | `npm pack` + conferência + extração; remoção ao fim | C-4801 |
| Versão e integridade | `optionalDependencies` do `koffi` + `package-lock.json` | C-4802 |
| Caminho Linux nativo (CI) | inalterado | RNF-4801 |
| Versão do monorepo | sem incremento | C-4803 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `electron-builder` ignorar o pacote opcional | binário fora do pacote | verificação do `.deb` gerado (T4802) |
| Build interrompido no meio (Ctrl+C) | diretório fica nos `node_modules` do Windows | é o mesmo conteúdo que o npm instala no Linux; o próximo `npm ci` o remove |
| Download adulterado | binário errado no pacote | sha512 do `package-lock.json` |
| `tar` ausente no Windows | build falha | `tar.exe` faz parte do Windows 10 1803+; erro claro se faltar |

## Scope Lock

### IN

- etapa de preparação do binário Linux do `koffi` no caminho Windows → WSL de `scripts/build-linux-wsl.js`.

### OUT

- caminho Linux nativo do script e pipeline do CI;
- configuração do `electron-builder` e `asarUnpack`;
- código do app.

### Allowed Paths

- `scripts/build-linux-wsl.js`
- `spec-kit/specs/048-koffi-linux-no-pacote-wsl/**`

### Prohibited Paths

- `apps/**`, `packages/**`, `package.json`, `package-lock.json`
- `.github/**`, `scripts/build-backend.js`, `scripts/bump-version.mjs`
- `spec-kit/specs/009-marcacao-linux/**`, `spec-kit/docs/adrs/**`, `docs/**`

### Dependencies

- Nenhuma nova. `npm pack`, `tar` (Windows 10 1803+) e `node:crypto`.

### Non-Goals

- tornar o build pelo WSL independente dos `node_modules` do Windows;
- suportar outras arquiteturas Linux além de x64 (o script empacota só x64, como hoje).

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a um script de build.
- [x] Princípio VIII: converge ao final (T4803).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-18 | Baixar o binário com `npm pack`, conferir pelo lockfile e remover ao fim | C-4801, C-4802 |
| 2026-11-18 | Uma feature, um PR, IDs `480x`, sem incremento de versão | C-4803 |
