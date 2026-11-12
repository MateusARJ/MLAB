# Clarify: Versão e Informações do MLab no App Desktop

Feature: `021-sobre-versao-desktop`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-12, com o plano de implementação das issues #52 e #64.

## C-2101 — Onde mostrar

- **Contexto:** a issue #52 lista como opções uma tela "Sobre", o rodapé do dashboard, o painel nativo do Electron
  (`app.setAboutPanelOptions`) e os metadados do executável.
- **Opções:** (A) rodapé + diálogo "Sobre"; (B) só o rodapé com a versão; (C) A + painel nativo.
- **Resposta aprovada:** **A**, nas telas de identificação (`ProfessorEntry`) e de dashboard. A tela da sala fica de
  fora: é a tela de transmissão e não deve ganhar elementos que concorram com o conteúdo. O app não tem menu nativo,
  então o painel nativo não teria por onde ser aberto.
- **Impacto em spec:** RF-2101, RF-2102.

## C-2102 — Quais informações

- **Resposta aprovada:** nome, versão, descrição e direitos autorais. Ficam de fora:
  - a versão do backend embarcado, que é sempre a mesma versão única do monorepo;
  - a licença e o link do repositório;
  - a edição MLab HTTPS, que vive na branch `edicao/https-lan` e não vai para a `development`.
- **Impacto em spec:** RF-2102, §3 "Não incluído".

## C-2103 — Texto único da descrição

- **Contexto:** `description` e `build.linux.description` têm textos diferentes.
- **Resposta aprovada:** "Plataforma de transmissão de tela e interação para aulas ao vivo", nos dois campos e no
  diálogo. O `synopsis` do Linux continua sendo o resumo curto.
- **Impacto em spec:** RF-2105.

## C-2104 — Direitos autorais e metadados do executável

- **Contexto:** o electron-builder 24 monta o `VersionInfo` do Windows assim:
  - `LegalCopyright` vem de `build.copyright`. Sem esse campo, vira `Copyright © <ano corrente> <author.name>`
    (`app-builder-lib/out/appInfo.js`).
  - `FileDescription` é sempre o `productName` (`winPackager.js`).
- **Resposta aprovada** (revista em 2026-11-12 pelo responsável, durante a T2102: o MLab é aberto e lançado em 2026,
  e o titular é Mateus de Araujo):
  - `build.copyright` passa a ser `Copyright © 2026 Mateus de Araujo`. O ano é o de lançamento, um fato fixo, e
    não o ano do build.
  - O app lê esse mesmo campo no build do main (`define` em `electron.vite.config.ts`), sem repetir o texto no código.
  - O `author.name` (campo "Empresa" do executável) continua "MLab".
  - A primeira resposta (remover o `build.copyright` e usar o ano do build) foi descartada. Ela já tinha virado
    código na T2101, que a T2101a ajusta.
  - Limitação aceita: `FileDescription` continua "MLab". Mudar o `productName` mudaria o nome do executável, dos
    atalhos e dos instaladores, e fica fora desta feature.
- **Impacto em spec:** RF-2106.

## C-2105 — Fonte das informações no app

- **Resposta aprovada:**
  - A versão vem de `app.getVersion()` no main. É a versão do `apps/desktop/package.json`, que o `npm run bump` mantém
    igual à da raiz.
  - Nome, descrição e copyright vêm do `apps/desktop/package.json`, lidos no build do main (`define` do electron-vite).
    Assim não há texto duplicado no código.
  - O renderer recebe tudo por um canal IPC sem parâmetros, `get-app-info`, com o tipo `AppInfo` em `packages/types`
    (regra do contrato `desktop-ipc.md`).
- **Impacto em plan/contracts:** contrato `desktop-ipc.md` da 003; `packages/types`.

## C-2106 — Web dos alunos

- **Resposta aprovada:** fora do escopo. Se o responsável quiser, vira issue própria.

## C-2107 — Faixa de IDs e impacto de versão

- **Faixa de IDs:** `US-210x`, `RF-210x`, `RNF-210x`, `RN-210x`, `C-210x` e `T210x`. É a faixa de 4 dígitos
  (precedente da 020), porque a de 3 dígitos `T21x` fica perto da 002.
- **Impacto de versão:** **MINOR** (1.12.2 → 1.13.0). É uma funcionalidade nova e compatível: US nova e canal IPC
  novo (`docs/versionamento.md` §2, AGENTS §13).

## Resultado

CLOSED — C-2101 a C-2107 respondidas; nenhuma ambiguidade em aberto.
