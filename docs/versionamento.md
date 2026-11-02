# Versionamento do MLab

Status: **oficial** desde 2026-11-02, a partir da versão **1.5.7**.

Este documento define como a versão do MLab é numerada, quando muda e como uma release é publicada. Ele vale para
pessoas e agentes de IA.

## 1. Regras

1. **Versão única.** O monorepo inteiro tem uma só versão: `package.json` da raiz, `apps/desktop`, `apps/web`,
   `apps/backend`, `packages/types`, `packages/ui` e as entradas correspondentes no `package-lock.json`.
2. **A versão só muda numa release.** Nenhum build (`npm run make*`, `npm run build`), PR de feature ou de correção
   altera a versão. Os instaladores gerados localmente saem com a versão atual do `package.json`.
3. **A versão só muda pelo script.** Use `npm run bump` (ou `npm run bump -- --set`); não edite `"version"` à mão nem
   use `npm version`.
4. **Toda release publicada tem uma tag `vMAIOR.MENOR.CORRECAO`** igual à versão do `package.json` no momento da
   release.
5. **Versões não voltam.** Uma versão publicada nunca é reaproveitada; `--set` recusa versão menor que a atual
   (igual só serve para realinhar arquivos divergentes).

## 2. Formato e regra de incremento

Formato: `MAIOR.MENOR.CORRECAO`, cada componente de **0 a 9** (regra decimal). Cada release avança uma posição; ao
passar de 9, o componente volta a 0 e o da esquerda sobe:

| Atual | Próxima (`npm run bump`) |
|---|---|
| 1.5.7 | 1.5.8 |
| 1.5.9 | 1.6.0 |
| 1.9.9 | 2.0.0 |

A regra não segue o SemVer: o número indica a ordem das releases, não o tipo de mudança. Para marcar uma mudança
grande (por exemplo, uma nova geração do app), pule para a versão desejada com `npm run bump -- --set 2.0.0`.

## 3. Comandos

| Comando | O que faz |
|---|---|
| `npm run version:check` | Confere se todos os pacotes e o `package-lock.json` estão na mesma versão. Sai com erro se houver divergência. |
| `npm run bump` | Avança para a próxima versão pela regra decimal, em todos os arquivos, e confere o resultado. |
| `npm run bump -- --set X.Y.Z` | Define uma versão explícita (salto de versão ou correção de divergência). |

## 4. Processo de release

Pré-requisitos: tudo o que vai sair na release está mergeado na `development`, com `npx turbo run build test` e
`npm run spec:check` verdes.

1. **Subir a versão** numa branch própria, a partir da `development`:

   ```bash
   git switch development && git pull
   git switch -c release/v1.5.8
   npm run bump                 # 1.5.7 -> 1.5.8
   npm run version:check
   git commit -am "chore(release): versao 1.5.8"
   git push -u mlab release/v1.5.8
   ```

   Abra o PR `release/v1.5.8 → development` e faça o merge.

2. **Levar à `main`**: PR `development → main`. O CI gera os instaladores nos três sistemas
   (`.github/workflows/build-all.yml`); faça o merge com **merge commit** (sem squash) depois dos três builds verdes.

3. **Publicar** com a tag, a partir da `main` atualizada:

   ```bash
   git switch main && git pull
   npm run version:check        # confirma 1.5.8
   git tag -a v1.5.8 -m "MLab v1.5.8"
   git push mlab v1.5.8
   ```

   O push da tag dispara o workflow, que gera os instaladores e cria a release `MLab v1.5.8` com notas automáticas.

   Alternativa sem tag local: na aba **Actions**, rode o workflow manualmente com os campos em branco; a release usa a
   versão do `package.json` (`v1.5.8`).

4. **Conferir** na página de [Releases](https://github.com/MateusARJ/MLAB/releases) os arquivos
   `MLab-Setup-1.5.8.exe`, `MLab-Mac-1.5.8.dmg`/`.zip` e `MLab-Linux-1.5.8.AppImage`/`.deb`/`.tar.gz`.

> **A tag publicada não aponta para o código.** O job de release recria a tag num commit sem código-fonte (só um
> `README.md` de downloads) e a envia com `--force`, para a release não oferecer o código. Para achar o código de uma
> versão, use o commit da `main` que contém o `chore(release): versao X.Y.Z`.

## 5. Correções urgentes

Não existe atalho direto para a `main`. A correção segue o fluxo normal (branch a partir da `development`, PR,
merge) e sai numa nova release pelo processo da seção 4, com a próxima versão.

## 6. Builds locais e de teste

- `npm run make`, `make:win`, `make:linux` e `make:mac` geram instaladores com a versão atual, sem alterar arquivos.
- Um instalador local com a mesma versão de uma release publicada não é essa release; para distribuir, publique pelo
  processo da seção 4.

## 7. Histórico e ponto de partida

| Versão | Situação |
|---|---|
| até 1.5.5 | Releases anteriores; `v1.5.5` é a última publicada no GitHub (2026-10-11). |
| 1.5.6, 1.5.7 | Criadas pelo incremento automático do `npm run make` (removido), sem release publicada. |
| **1.5.7** | Ponto de partida do versionamento oficial; todos os pacotes alinhados nesta versão. |

Como a 1.5.7 nunca foi publicada, a primeira release oficial pode sair como **v1.5.7** sem rodar `npm run bump`
(pule o passo 1 da seção 4). Daí em diante, cada release avança a versão.
