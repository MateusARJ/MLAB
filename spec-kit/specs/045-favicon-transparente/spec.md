# Spec: Favicon do Aluno Igual ao Ícone do Header do Desktop

Status: READY
Feature ID: `045-favicon-transparente`
Origem: issue #131. Melhoria visual do web app dos alunos. Emenda o RF-2814 da `028-design-system-2` e o RF-2502 da
`025-favicon-web`; não altera requisito funcional, contrato, backend nem ADR.

## 1. Objetivo

Fazer a aba do web app dos alunos mostrar o mesmo ícone do header do app desktop (notebook com tela compartilhada,
painel de alunos e sinal de transmissão), sem o quadrado escuro em volta, ocupando o espaço do favicon.

## 2. Contexto

Verificado em 2026-11-16 na `development` @ `a2d1887` (2.1.1):

- O header do desktop usa `packages/ui/src/assets/mlab-logo-mark.png` (280×192, RGBA, fundo transparente) pelo
  `BrandMark` de `packages/ui/src/Brand.tsx`, que documenta: "Fundo transparente: funciona nos temas claro e escuro".
- `apps/web/public/favicon-32.png` (32×32, RGBA) já é esse desenho, mas reduzido a ~24 px de largura sobre um
  quadrado arredondado `#0f172a` (028/RF-2814, 025/RF-2502). Na aba ele aparece como um bloco escuro com um desenho
  miúdo, e não como o ícone do header — é a diferença que a issue #131 aponta.
- `apps/web/public/apple-touch-icon.png` (180×180, RGB) é o mesmo desenho sobre `#0f172a` opaco.
- A interpretação do 028/C-2806 partiu de "a logo é branca". O mark não é branco: tem preenchimento branco e azul e
  contorno azul-marinho, por isso fica legível sem fundo em aba clara e escura.
- `apps/web/index.html` declara `/favicon-32.png` (32×32) e `/apple-touch-icon.png`; `apps/web/src/favicon.test.ts`
  fixa esses links, os tamanhos e o apple-touch-icon RGB sem alfa.
- `MLAB-logo-w.jpg` não serve de fonte: por ser JPG, o xadrez de "transparência" está pintado nos pixels.

## 3. Escopo

### Incluído

- Novo `favicon-32.png` com o mark do header sobre fundo transparente.
- Novo `apple-touch-icon.png` com o mark do header sobre fundo branco opaco.
- Teste que exige o canal alfa no `favicon-32.png`.

### Não incluído

- `apps/web/index.html` (os nomes dos arquivos não mudam).
- Logo das páginas (`MLAB-logo.png`), ícones do app desktop e o próprio `mlab-logo-mark.png`.
- Manifesto PWA, `favicon.ico` e favicon SVG.

## 4. Atores

- **Aluno:** abre o link da sala no navegador do computador ou do celular.

## 5. User Stories

### US-4501 — Reconhecer o MLab na aba

Como aluno, quero ver na aba do navegador o mesmo ícone do MLab que o professor vê no app, para reconhecer a aula
entre as outras abas.

- Dado que abri a sala em tema claro ou escuro, então a aba mostra o notebook com o painel de alunos e o sinal, sem
  quadrado escuro em volta, legível nos dois temas.
- Dado que adicionei o link à tela inicial do celular, então aparece o mesmo ícone sobre fundo branco.

## 6. Requisitos Funcionais

- RF-4501: `apps/web/public/favicon-32.png` é o `mlab-logo-mark.png` reduzido a 32 px de largura, com a proporção
  preservada (32×22), centralizado na vertical num PNG 32×32 RGBA com fundo transparente. Substitui o quadrado escuro
  do 028/RF-2814 e do 025/RF-2502 no favicon.
- RF-4502: `apps/web/public/apple-touch-icon.png` é um PNG 180×180 RGB opaco, fundo branco `#FFFFFF`, com o mesmo mark
  centralizado e margem lateral de 11 px (mark 158×108).
- RF-4503: `apps/web/index.html` e `apps/web/public/MLAB-logo.png` não mudam.

## 7. Requisitos Não Funcionais

- RNF-4501 — dependências: nenhuma nova; os PNGs são gerados uma vez, fora do repositório, a partir do
  `mlab-logo-mark.png`.
- RNF-4502 — legibilidade: o favicon é conferido na aba do Chrome em tema claro e escuro.

## 8. Estados e Erros

| Situação | Evento | Resultado esperado |
|---|---|---|
| aba em tema claro | carregar a página | mark sem fundo, contorno escuro visível |
| aba em tema escuro | carregar a página | mark sem fundo, preenchimento branco e azul visível |
| iOS "Adicionar à Tela de Início" | salvar atalho | mark sobre branco, sem transparência |

## 9. Edge Cases

- O mark não é quadrado (280:192): o favicon tem 5 px transparentes acima e abaixo; não é esticado.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `favicon.test.ts` verde com a nova asserção de alfa; conferência visual na aba em tema claro e escuro.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4501 a C-4503).
