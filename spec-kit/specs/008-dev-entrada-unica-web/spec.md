# Spec: Entrada Única do Web do Aluno no Modo de Desenvolvimento

Status: READY-FOR-PLAN
Feature ID: `008-dev-entrada-unica-web`
Origem: relato do responsável em 2026-11-02 — no `npm run dev`, a transmissão abre pelo IP do professor na porta
8080, além da porta 5173 do link oficial.

## 1. Objetivo

No modo de desenvolvimento (`npm run dev`), o web do aluno é servido pelo Vite na porta 5173, e o link da sala aponta
para ela. O backend Go, na 8080, também serve o web do aluno a partir da pasta compilada `apps/web/dist`, se ela
existir. Isso cria uma segunda entrada:

- a página na 8080 é a do **último build** (`npm run build`/`make`), não o código atual: testar por ela valida código
  antigo sem aviso;
- o professor e quem testa veem duas URLs que funcionam, e só uma corresponde ao link oficial.

O objetivo é que, no modo de desenvolvimento, a 8080 não sirva páginas: ela redireciona para o mesmo caminho no
servidor do Vite. No app empacotado nada muda: lá a 8080 é a única porta e serve o web do aluno.

## 2. Escopo

### Incluído

- redirecionamento das páginas do web do aluno na 8080 para o servidor do Vite, só no modo de desenvolvimento;
- teste do redirecionamento e da preservação das rotas de API.

### Não incluído

- comportamento do app empacotado (backend servindo `web/` na 8080);
- rotas de API, WebSocket e `/health`, que continuam na 8080 em qualquer modo;
- autenticação e autorização (C-801: a porta não é controle de acesso).

## 3. Atores

Professor e desenvolvedores rodando `npm run dev`; alunos de teste acessando pela rede local.

## 4. User Stories

### US-801 — Uma só entrada no desenvolvimento
**Como** quem testa o MLab em desenvolvimento, **quero** que a página do aluno só seja servida pelo Vite, **para** não
testar sem saber uma versão antiga.
- Abrir `http://<ip>:8080/<caminho>` no modo de desenvolvimento leva a `http://<ip>:5173/<caminho>`, com a mesma
  query string.
- `/health`, `/auth/*`, `/rooms/*` e `/ws/*` continuam respondendo na 8080.

## 5. Requisitos

- RF-801: com `MLAB_DEV_MONOREPO=1`, requisições `GET`/`HEAD` que não são de API recebem `307 Temporary Redirect`
  para o mesmo caminho e query no host da requisição, na porta do web (`WEB_PORT`, padrão 5173).
- RF-802: com `MLAB_DEV_MONOREPO=1`, outros métodos fora das rotas de API recebem `404`.
- RF-803: sem `MLAB_DEV_MONOREPO=1`, o backend serve o web do aluno como hoje (`spaHandler`).
- RNF-801: rotas de API, WebSocket e `/health` não mudam em nenhum modo; o E2E e o smoke do backend continuam verdes.

## 6. Regras de Negócio

- RN-801: o acesso pela porta 8080 não concede nada além do que o link oficial concede; as validações de sala, nome e
  matrícula são as mesmas do servidor (C-801).

## 7. Critérios de Sucesso

- Teste do backend cobre o redirecionamento, a query preservada, o `404` de outros métodos e o modo empacotado.
- `go test ./...` do backend e as suítes do monorepo verdes.
- Verificação manual: no `npm run dev`, `http://<ip>:8080/` abre a página da 5173.
