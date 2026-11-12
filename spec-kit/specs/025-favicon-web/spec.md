# Spec: Favicon Próprio do Web App dos Alunos

Status: READY
Feature ID: `025-favicon-web`
Origem: issue #68. Melhoria visual do web app dos alunos; não altera requisito funcional existente.

## 1. Objetivo

Trocar o ícone da aba do navegador do web app dos alunos por um ícone próprio para tamanho pequeno: legível em
16/32px e com contraste em abas claras e escuras.

## 2. Contexto

Verificado em 2026-11-12 na `development` @ `1f93d5e`:

- `apps/web/index.html` usa `<link rel="icon" type="image/png" href="/MLAB-logo.png" />`.
- `apps/web/public/MLAB-logo.png` é a logo completa (1024×1024): ilustração de notebook com tela compartilhada,
  painel de participantes, ondas de sinal e o texto "MLAB", com margem transparente larga. Reduzida a 16/32px, vira um
  borrão; o "LAB" quase branco some em aba clara.
- A mesma logo aparece dentro das páginas (`Join.tsx`, `Room.tsx`) e continua lá.
- O app desktop usa `apps/desktop/resources/icon*.{ico,png}` para janela e barra de tarefas; o `<link rel="icon">` do
  renderer Electron não aparece para o usuário.

## 3. Escopo

### Incluído

- Favicon SVG dedicado, só com o símbolo, sobre fundo escuro arredondado.
- Fallbacks PNG 32×32 e 180×180 (`apple-touch-icon`).
- Links no `apps/web/index.html`.

### Não incluído

- App desktop (ícones de janela, barra de tarefas e o `<link rel="icon">` do renderer).
- Logo exibida nas páginas (`MLAB-logo.png`).
- Manifesto PWA e `favicon.ico`.

## 4. Atores

- **Aluno:** abre o link da sala no navegador do computador ou do celular.

## 5. User Stories

### US-2501 — Reconhecer a aba do MLab

Como aluno, quero reconhecer a aba do MLab entre as outras abas, em tema claro ou escuro.

- Dado que abri a sala no navegador em tema claro, então o ícone da aba aparece nítido e com contraste.
- Dado que abri em tema escuro, então o ícone também aparece nítido e com contraste.
- Dado que adicionei o link à tela inicial do celular, então aparece o ícone do MLab, e não um recorte da página.

## 6. Requisitos Funcionais

- RF-2501: o web app tem um favicon SVG (`apps/web/public/favicon.svg`) só com o símbolo do MLab (tela com cursor e
  ondas de sinal), sem texto, ocupando a área do ícone.
- RF-2502: o favicon tem contraste em aba clara e escura sem depender de `prefers-color-scheme`: o símbolo fica sobre
  um quadrado arredondado escuro (`#0f172a`), com o azul da marca e branco.
- RF-2503: existem fallbacks PNG gerados do mesmo desenho: `favicon-32.png` (32×32) e `apple-touch-icon.png`
  (180×180, opaco).
- RF-2504: `apps/web/index.html` declara o PNG 32×32, o SVG e o `apple-touch-icon`; a logo das páginas continua sendo
  `MLAB-logo.png`.

## 7. Requisitos Não Funcionais

- RNF-2501 — dependências: nenhuma dependência nova; os PNGs são gerados uma vez, fora do repositório.
- RNF-2502 — peso: o SVG não embute imagem raster e fica abaixo de 2 KB.

## 8. Estados e Erros

| Navegador | Ícone usado |
|---|---|
| com suporte a SVG no favicon (Chrome, Edge, Firefox) | `favicon.svg` |
| sem suporte a SVG no favicon | `favicon-32.png` |
| iOS/Android ao adicionar à tela inicial | `apple-touch-icon.png` |

## 9. Edge Cases

- Cache do favicon no navegador: pode exigir recarregar sem cache para ver o ícone novo na verificação.
- iOS não aplica transparência no `apple-touch-icon`: o PNG 180×180 é opaco, com o fundo escuro de ponta a ponta.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- Teste do web: `index.html` declara os três ícones; os arquivos existem em `public/`; o SVG tem `viewBox` quadrado,
  não tem `<text>` nem `<image>` e tem menos de 2 KB; os PNGs têm 32×32 e 180×180.
- `npm run build -w apps/web` copia os três arquivos para `dist/`.
- Manual: ícone nítido nas abas do Chrome, Firefox e Edge, em tema claro e escuro.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-2501 a C-2504).
