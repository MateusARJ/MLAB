# Spec: Remoção do Pacote Linux tar.gz

Status: READY
Feature ID: `055-pacote-linux-tar-gz`
Origem: issue #169, desvio registrado na publicação da 2.3.1. Muda a configuração de empacotamento e a documentação;
não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

A configuração de build e a documentação do MLab passam a anunciar só os pacotes Linux que são de fato gerados e
publicados: `.AppImage` e `.deb`.

## 2. Contexto

Verificado em 2026-11-20 na `main` @ `12b0bc9` (2.3.1):

- `apps/desktop/package.json` declara `build.linux.target` = `AppImage`, `deb`, `tar.gz`.
- `npm run make:linux` chama `scripts/build-linux-wsl.js all`, que executa `electron-builder --linux AppImage deb`.
  Com os alvos na linha de comando, o electron-builder ignora a lista do `package.json`, e o `.tar.gz` nunca é gerado.
- `.github/workflows/build-all.yml` envia `*.AppImage *.deb *.tar.gz` com `shopt -s nullglob`: o padrão sem arquivo
  some sem erro, e a falta passa despercebida.
- Nenhuma release teve `.tar.gz` (as assets da `v2.3.0` e da `v2.3.1` são só `.AppImage` e `.deb` no Linux).
- `README.md` (instalação no Linux e tabela de builds) e `docs/versionamento.md` §5 prometem o `.tar.gz`.
- Nenhuma spec exige o formato: a ADR 0002 e a spec 001 citam só `.AppImage`.

## 3. Escopo

### Incluído

- Alvo `tar.gz` em `build.linux.target` e padrão `*.tar.gz` no envio da release.
- Menções ao pacote Linux `.tar.gz` no `README.md` e no `docs/versionamento.md`.

### Não incluído

- `scripts/build-linux-wsl.js`, que já gera só `.AppImage` e `.deb`.
- Notas de releases antigas (`docs/releases/v1.15.10.md` a `v2.3.0.md`), que são histórico.
- O `Source code (tar.gz)` que o GitHub anexa a cada release, que não é pacote do app.

## 4. Atores

- **Professor no Linux**: escolhe o pacote para instalar pelo README e pela release.
- **Mantenedor**: confere os arquivos da release pelo `docs/versionamento.md`.

## 5. User Stories

### US-5501 — Pacotes anunciados são os publicados

Como professor no Linux, quero que o README só ofereça pacotes que existem na release.

- Dado o README, quando procuro como instalar no Linux, então encontro o AppImage (qualquer distribuição) e o `.deb`.
- Dado uma release nova, quando a CI termina, então os pacotes Linux são `.AppImage` e `.deb`, como hoje.

## 6. Requisitos Funcionais

- RF-5501: `build.linux.target` em `apps/desktop/package.json` lista só `AppImage` e `deb`.
- RF-5502: o `release_files` da perna Linux do `build-all.yml` envia só `*.AppImage` e `*.deb`.
- RF-5503: o `README.md` e o `docs/versionamento.md` deixam de citar o pacote Linux `.tar.gz`; o README indica o
  AppImage para outras distribuições.

## 7. Requisitos Não Funcionais

- RNF-5501 — dependências: nenhuma nova.
- RNF-5502 — regressão: o job "Build linux" do CI verde e `npm run make:linux` gerando `.AppImage` e `.deb`.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| release nova | Linux com `.AppImage` e `.deb`, como hoje |
| falta de `.AppImage` e `.deb` | o passo de envio falha, como hoje |

## 9. Edge Cases

- Quem montava o `.tar.gz` a partir do código continua podendo rodar `electron-builder --linux tar.gz`; o formato só
  deixa de ser anunciado e configurado.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `git grep "tar.gz"` sem menção ao pacote Linux do app fora das notas antigas e do `Source code (tar.gz)`.
- Job "Build linux" verde no PR.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-5501 e C-5502).
