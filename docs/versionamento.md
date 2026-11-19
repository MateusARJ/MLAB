# Versionamento do MLab

Status: **oficial** desde 2026-11-02, a partir da versão **1.7.1**.
Decisão registrada em `spec-kit/docs/adrs/0007-versionamento-semantico.md`; fluxo de entrega e release pela
`spec-kit/docs/adrs/0011-fluxo-de-entrega-somente-main.md`.

O MLab segue o [Versionamento Semântico 2.0.0](https://semver.org/lang/pt-BR/) no formato **`MAJOR.MINOR.PATCH`**.
Este documento define o que cada nível significa no MLab, quando a versão muda e como uma release é publicada. Ele
vale para pessoas e, principalmente, para agentes de IA: **todo PR que muda o app entrega também o incremento de
versão correspondente**, decidido pelas regras da seção 2.

## 1. Regras gerais

1. **Versão única.** O monorepo inteiro tem uma só versão: `package.json` da raiz, `apps/desktop`, `apps/web`,
   `apps/backend`, `packages/types`, `packages/ui` e as entradas correspondentes no `package-lock.json`.
2. **A versão muda no PR da mudança.** Cada PR para a `main` que altera o que é entregue ao professor ou ao
   aluno inclui um único incremento de versão, no nível da seção 2. PRs sem impacto no app não mudam a versão.
3. **Só pelo script.** Use `npm run bump -- patch|minor|major` (ou `--set`). Não edite `"version"` à mão nem use
   `npm version`. Nenhum build (`npm run make*`, `npm run build`) altera a versão.
4. **Versões não voltam.** Uma versão nunca é reaproveitada; `--set` recusa versão menor que a atual.
5. **Release = tag.** Uma versão só é publicada quando recebe a tag `vMAJOR.MINOR.PATCH` (seção 5). Versões
   intermediárias que nunca viram release são normais: a release usa a versão acumulada na `main`.

## 2. Escopo de cada nível

Ao incrementar um nível, os níveis à direita voltam a zero: `1.7.1` → patch `1.7.2` · minor `1.8.0` · major `2.0.0`.

### MAJOR — mudança incompatível

Entra em MAJOR toda mudança que **quebra** o uso atual: quem usava a versão anterior precisa mudar algo (reinstalar,
reconfigurar, aprender um fluxo novo) ou um componente antigo deixa de funcionar com um novo.

- remover ou renomear uma funcionalidade usada pelo professor ou pelo aluno;
- mudar um fluxo existente de forma incompatível (ex.: a remoção do login da ADR 0006);
- mudança incompatível em contrato de `spec-kit/specs/*/contracts/` (HTTP, eventos WebSocket, IPC do desktop):
  remover ou renomear campo, evento ou rota; mudar tipo ou significado; tornar obrigatório o que era opcional;
- aumentar requisitos do sistema: versão mínima de SO, novas portas de firewall obrigatórias, dependência externa
  obrigatória (ex.: exigir TURN ou internet);
- configuração ou dados incompatíveis: variável de ambiente removida ou renomeada, formato salvo que a versão nova
  não lê;
- ADR que muda a forma de operar ou instalar o MLab (ex.: deixar de funcionar em LAN offline).

### MINOR — funcionalidade nova compatível

Entra em MINOR toda **capacidade nova** que não quebra nada do que já existe.

- funcionalidade nova com spec (nova user story ou novo RF em `spec-kit/specs/`), em geral commits `feat`;
- adição compatível em contrato: campo opcional, evento, rota ou canal IPC novos, sem alterar os existentes;
- nova opção de configuração, novo formato suportado (ex.: um novo formato de gravação) ou nova plataforma;
- melhoria visível de um comportamento existente que acrescenta opção ao usuário sem mudar o padrão;
- anúncio de descontinuação (a funcionalidade ainda funciona; a remoção virá numa MAJOR).

### PATCH — correção compatível

Entra em PATCH toda mudança no que é entregue que **não acrescenta capacidade nem quebra compatibilidade**.

- correção de defeito para cumprir a spec aprovada, inclusive regressões (commits `fix`);
- correção de segurança sem mudança de contrato;
- melhoria de desempenho sem mudança de comportamento (commits `perf`);
- refatoração do código entregue (commits `refactor`);
- ajuste de texto, layout ou estilo da interface que corrige o que a spec pede;
- atualização de dependência que vai no instalador, sem mudança de comportamento.

### Sem incremento

Não mudam a versão os PRs que só tocam o que **não vai no app**:

- documentação (`docs`), testes (`test`), CI (`ci`), formatação de código (`style`);
- artefatos do Spec Kit (`spec-kit/**`) sem mudança de código;
- ferramentas de desenvolvimento e build que não mudam o instalador (`build`, `chore`).

### Tabela de decisão pelo tipo de commit

| Commits do PR | Nível |
|---|---|
| algum commit com `!` (`feat(web)!: ...`, `fix(backend)!: ...`) | **MAJOR** |
| algum `feat` | **MINOR** |
| algum `fix`, `perf` ou `refactor` (ou `build`/`chore` que muda o instalador) | **PATCH** |
| só `docs`, `test`, `ci`, `style`, `build`/`chore` de ferramenta | nenhum |

Num PR com vários commits, vale o **maior** nível. O tipo do commit é um indício: a decisão final segue o escopo
acima. Um `feat` que remove algo é MAJOR; um `fix` que acrescenta campo novo a um contrato é MINOR.

## 3. Instruções para agentes de IA

Ao concluir um PR que altera `apps/` ou `packages/`:

1. **Classifique** o PR pela seção 2, olhando todos os commits e as tasks do Spec Kit atendidas. Registre o nível e
   a justificativa no `converge.md` da feature (seção "Impacto de versão") e no campo "Impacto de versão" do PR.
2. **Na dúvida sobre MAJOR, pare e pergunte** ao responsável (AGENTS.md §4). Entre MINOR e PATCH: se o PR criou US
   ou RF novo, é MINOR; se só fez o código cumprir requisito já existente, é PATCH.
3. **Mudança incompatível** leva `!` no tipo do commit que a introduz (`feat(backend)!: remove o evento X`) e um
   parágrafo no corpo começando com `Quebra de compatibilidade:` explicando o que muda para o usuário.
4. **Incremente uma vez por PR**, como último commit, depois dos testes e do converge:

   ```bash
   npm run bump -- patch          # ou minor / major, conforme o passo 1
   npm run version:check
   git commit -am "chore(release): versao X.Y.Z"
   ```

5. **Se a `main` mudou de versão** enquanto o PR estava aberto (conflito nos `package.json`), atualize a
   branch com a `main`, aceite a versão dela nos conflitos e rode o `bump` de novo a partir dela.
6. **Não incremente** em PRs sem impacto no app (seção 2, "Sem incremento").
7. **Nunca** crie tag nem release: a publicação (seção 5) é feita pelo responsável.

## 4. Comandos

| Comando | O que faz |
|---|---|
| `npm run version:check` | Confere se todos os pacotes e o `package-lock.json` estão na mesma versão. Sai com erro se houver divergência. |
| `npm run bump -- patch` | Correção compatível: `1.7.1` → `1.7.2`. |
| `npm run bump -- minor` | Funcionalidade compatível: `1.7.1` → `1.8.0`. |
| `npm run bump -- major` | Mudança incompatível: `1.7.1` → `2.0.0`. |
| `npm run bump -- --set X.Y.Z` | Define uma versão explícita, nunca menor que a atual (correção de divergência ou decisão do responsável). |

## 5. Publicação de uma release

Pré-requisitos: tudo o que vai sair na release está mergeado na `main`, com `npx turbo run build test` e
`npm run spec:check` verdes. A versão já está certa: ela foi incrementada em cada PR.

1. **Escrever as notas** em `docs/releases/vX.Y.Z.md`, num PR `docs` para a `main` antes da tag.
   Use a release anterior como modelo: destaques, downloads, novidades **por versão** desde a última release
   publicada (a partir dos commits `chore(release): versao X.Y.Z` e dos `converge.md`) e limitações conhecidas.
   O workflow usa esse arquivo como texto da release e acrescenta ao final a lista automática de PRs; sem o arquivo,
   a release sai só com a lista automática.

   Não há PR de release (ADR 0011): todo PR para a `main` já roda o build dos três sistemas
   (`.github/workflows/build-all.yml`) e é mergeado com **merge commit** (sem squash) depois dos três builds verdes.
   No PR o build só valida: os instaladores não são publicados (cota de armazenamento da conta, #112). Eles saem
   apenas pela release do passo 2.

2. **Publicar** com a tag, a partir da `main` atualizada:

   ```bash
   git switch main && git pull
   npm run version:check        # mostra a versão a publicar, ex.: 1.8.0
   git tag -a v1.8.0 -m "MLab v1.8.0"
   git push mlab v1.8.0
   ```

   O push da tag dispara o workflow. Ele cria a release `MLab v1.8.0` em **rascunho**, com o texto de
   `docs/releases/v1.8.0.md` seguido das notas automáticas. Cada build envia os próprios instaladores direto para a
   release, sem passar por artefatos do Actions (a cota da conta é menor que um run, #123). A release só é publicada
   quando os três builds passam. Se um build falhar, use **Re-run failed jobs**: o rascunho é reaproveitado e os
   arquivos são substituídos.

   Alternativa sem tag local: na aba **Actions**, rode o workflow manualmente com os campos em branco; a release usa a
   versão do `package.json`.

3. **Conferir** na página de [Releases](https://github.com/MateusARJ/MLAB/releases) os arquivos
   `MLab-Setup-X.Y.Z.exe`, `MLab-Mac-X.Y.Z.dmg`/`.zip` e `MLab-Linux-X.Y.Z.AppImage`/`.deb`/`.tar.gz`.

> **A release traz o código-fonte.** A tag aponta para o commit da `main` que gerou a versão, e o GitHub anexa
> automaticamente `Source code (zip)` e `Source code (tar.gz)` ao lado dos instaladores.

## 6. Builds locais e de teste

- `npm run make`, `make:win`, `make:linux` e `make:mac` geram instaladores com a versão atual, sem alterar arquivos.
- Um instalador local com a mesma versão de uma release publicada não é essa release; para distribuir, publique pela
  seção 5.

## 7. Histórico e ponto de partida

| Versão | Situação |
|---|---|
| até 1.5.5 | Regra antiga; `v1.5.5` é a última release publicada no GitHub (2026-10-11). |
| 1.5.6, 1.5.7 | Criadas pelo incremento automático do `npm run make` (removido), sem release. |
| **1.7.1** | Definida pelo responsável como início do versionamento semântico (2026-11-02); todos os pacotes alinhados. |

A 1.7.1 nunca foi publicada: a primeira release pelo processo novo pode sair como **v1.7.1**. Daí em diante, cada PR
com impacto no app incrementa a versão pela seção 2.
