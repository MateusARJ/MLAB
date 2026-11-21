# Converge: Remoção do Pacote Linux tar.gz

Feature: `055-pacote-linux-tar-gz`
Status: DONE
Branch: `fix/pacote-linux-tar-gz`, a partir da `main` @ `12b0bc9` (2.3.1)

## 1. Evidências

- Antes: `build.linux.target` = `AppImage`, `deb`, `tar.gz`; `release_files` com `*.tar.gz`; assets Linux da `v2.3.0`
  e da `v2.3.1` só com `.AppImage` e `.deb`; `scripts/build-linux-wsl.js` com os alvos `AppImage deb`.
- Depois: `build.linux.target` = `["AppImage","deb"]` (conferido com `node -p`), `release_files` da perna Linux com
  `*.AppImage` e `*.deb`.
- `git grep "tar.gz"` restante: só o `Source code (tar.gz)` do GitHub (README e `docs/versionamento.md`), o pacote do Go
  nas instruções de desenvolvimento e as notas de releases antigas, todos fora do escopo (spec §3).
- O `npm run make:linux` local via WSL não foi rodado; a verificação do empacotamento Linux é o job "Build linux" do
  PR, que roda o mesmo `make:linux` no runner Ubuntu.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-5501 | `apps/desktop/package.json` → `build.linux.target` = `AppImage`, `deb` |
| RF-5502 | `.github/workflows/build-all.yml` → `release_files` = `*.AppImage *.deb` |
| RF-5503 | README (instalação no Linux e tabela de builds) e `docs/versionamento.md` §5 sem o pacote `.tar.gz` |
| RNF-5501 | nenhuma dependência nova |
| RNF-5502 | job "Build linux" do PR |

## 3. Desvios registrados

- Nenhum.

## 4. Trabalho restante

- Nenhum nesta feature. Fecha a issue #169.

## 5. Impacto de versão

**PATCH → 2.3.2** (C-5502): a configuração do instalador passa a refletir o que já é entregue, sem capacidade nova nem
perda (`docs/versionamento.md` §2).
