# Clarify: Pacote Linux Gerado pelo WSL Leva o Binário Linux do koffi

Feature: `048-koffi-linux-no-pacote-wsl`
Status: CLOSED

Decisões registradas em 2026-11-18 na correção da issue #138, pedida pelo responsável. Ficam abertas à revisão no PR.
Nenhuma altera o app, regra de negócio, contrato ou arquitetura.

## C-4801 — Como levar o binário Linux ao pacote

- **Opções:**
  - (A) no script, antes do `electron-builder`, baixar `@koromix/koffi-linux-x64` com `npm pack`, conferir a
    integridade do `package-lock.json`, extrair nos `node_modules` e remover ao fim;
  - (B) `npm install --no-save --os=linux --cpu=x64 @koromix/koffi-linux-x64` nos `node_modules` do Windows;
  - (C) rodar `npm ci` dentro do WSL antes do build;
  - (D) incluir `@koromix/**` no `asarUnpack` ou ajustar o `electron-builder`.
- **Resposta:** **A**. Só acrescenta um diretório e o remove depois, sem reorganizar a árvore do Windows. (B) faz o
  npm recalcular a árvore inteira e pode podar ou trocar pacotes; (C) substituiria os `node_modules` usados pelo
  Windows, que ficam no mesmo diretório (`/mnt/c/...`); (D) não resolve, porque o binário nem está nos
  `node_modules`.
- **Impacto em spec:** RF-4801 a RF-4803.

## C-4802 — Origem da versão e da integridade

- **Resposta:** a versão vem das `optionalDependencies` do `koffi` instalado; a integridade e a versão esperadas vêm de
  `packages["node_modules/@koromix/koffi-linux-x64"]` no `package-lock.json` da raiz. Divergência entre elas, entrada
  ausente ou sha512 diferente do arquivo baixado interrompem o build. Assim o pacote local usa exatamente o binário
  que o CI instala pelo mesmo lockfile.
- **Impacto em spec:** RF-4802, §9.

## C-4803 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `fix/koffi-linux-no-pacote-wsl`.
- **Faixa de IDs:** `US-480x`, `RF-480x`, `RNF-480x`, `C-480x` e `T480x`.
- **Impacto de versão:** **sem incremento**. A mudança fica em `scripts/` (ferramenta de build local) e não altera
  `apps/` nem `packages/`; o instalador oficial, gerado pelo CI, não muda (`AGENTS.md` §13).

## Resultado

CLOSED: C-4801 a C-4803 respondidas, sem ambiguidade em aberto.
