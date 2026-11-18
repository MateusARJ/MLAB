# Spec: Pacote Linux Gerado pelo WSL Leva o Binário Linux do koffi

Status: READY
Feature ID: `048-koffi-linux-no-pacote-wsl`
Origem: issue #138 (desvio encontrado na 009/T910). Corrige o script de empacotamento Linux pelo WSL; não muda o app,
regra de negócio, contrato nem ADR.

## 1. Objetivo

Fazer o `.deb` e o AppImage gerados no Windows por `npm run make:linux` (via WSL) levarem o binário Linux do `koffi`,
como os pacotes gerados pelo CI, para a região de entrada X11 da 009 e o rastreador de janelas funcionarem no app
instalado.

## 2. Contexto

Verificado em 2026-11-18 na `development` @ `b17d684` (2.1.4):

- `scripts/build-linux-wsl.js` roda `electron-builder --linux` no WSL dentro de `/mnt/<drive>/.../apps/desktop`,
  reaproveitando os `node_modules` instalados pelo Windows. O npm só instala o binário opcional do `koffi` da
  plataforma do host (`@koromix/koffi-win32-x64`), então o pacote Linux sai sem `@koromix/koffi-linux-x64` (#138).
- Sem esse binário, `require('koffi')` falha no Linux, `createX11InputShaper()` devolve `null` e a barra de marcação
  volta ao hit-test, que congela sob XWayland: o app instalado reproduz a #30.
- O pacote do CI (`build-all.yml`, `ubuntu-latest`, release v1.15.10) leva o binário dentro do `app.asar`, e ele carrega
  (comentário de 2026-11-18 na #138). O problema é só do build local pelo WSL.
- O `package-lock.json` registra `node_modules/@koromix/koffi-linux-x64` (3.3.4) com `resolved` e `integrity`
  (sha512), embora o npm não o instale no Windows.

## 3. Escopo

### Incluído

- Garantir o binário Linux do `koffi` nos `node_modules` durante o empacotamento Linux pelo WSL, conferido pela
  integridade do `package-lock.json`, e removê-lo ao fim se foi o script que o colocou.

### Não incluído

- O caminho Linux nativo do script (CI), que já instala o binário certo.
- `asarUnpack`, configuração do `electron-builder`, código do app e o pipeline do CI.

## 4. Atores

- **Responsável pelo build:** gera o pacote Linux no Windows com `npm run make:linux`.

## 5. User Stories

### US-4801 — Pacote Linux local igual ao do CI

Como responsável pelo build, quero que o pacote Linux gerado no Windows leve o binário Linux do `koffi`, para o app
instalado no Linux ter a barra de marcação e o rastreador de janelas funcionando, como o pacote do CI.

- Dado o Windows com `node_modules` instalados pelo npm do Windows, quando rodo `npm run make:linux`, então o pacote
  gerado contém `@koromix/koffi-linux-x64/linux_x64/koffi.node`, e o `koffi` carrega dele no Linux.
- Dado que o binário Linux já está nos `node_modules`, quando rodo o build, então o script não baixa nem remove nada.
- Dado que o download não confere com a integridade do `package-lock.json`, quando rodo o build, então o build para
  com erro claro, sem empacotar.

## 6. Requisitos Funcionais

- RF-4801: no caminho Windows → WSL, antes do `electron-builder`, o script garante
  `node_modules/@koromix/koffi-linux-x64` na versão exigida pelo `koffi` instalado.
- RF-4802: o pacote baixado é conferido pelo `integrity` (sha512) do `package-lock.json`; versão ou integridade
  divergente interrompe o build.
- RF-4803: ao fim do build, com sucesso ou falha, o script remove o diretório que ele mesmo criou; um binário que já
  existia fica intocado.

## 7. Requisitos Não Funcionais

- RNF-4801 — sem efeito no CI: o caminho Linux nativo do script não muda.
- RNF-4802 — dependências: nenhuma nova; usa `npm pack`, `tar` e o `crypto` do Node.
- RNF-4803 — sem efeito no app: nenhum arquivo de `apps/` ou `packages/` muda.

## 8. Estados e Erros

| Situação | Evento | Resultado esperado |
|---|---|---|
| binário Linux ausente | build pelo WSL | baixa, confere, empacota e remove ao fim |
| binário Linux presente | build pelo WSL | nada a baixar nem a remover |
| integridade divergente | download | build para com erro, nada é empacotado |
| sem rede e sem cache do npm | download | build para com o erro do `npm pack` |
| `electron-builder` falha | build | o diretório criado pelo script é removido mesmo assim |

## 9. Edge Cases

- `koffi` sem `@koromix/koffi-linux-x64` nas dependências opcionais ou sem entrada no `package-lock.json`: o build
  para com erro claro em vez de gerar um pacote sem o binário.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `.deb` gerado por `npm run make:linux:deb` no Windows contém `@koromix/koffi-linux-x64/linux_x64/koffi.node`, e o
  Electron do pacote carrega o `koffi` do `app.asar` no Linux (WSL).
- Depois do build, `node_modules/@koromix/koffi-linux-x64` não existe mais no Windows e o `git status` está limpo.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4801 a C-4803).
