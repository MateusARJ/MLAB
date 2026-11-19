# Spec: Nome Acessível dos Botões do Cabeçalho do Aluno

Status: READY
Feature ID: `050-nome-acessivel-cabecalho-aluno`
Origem: issue #149 (e2e A13 instável no projeto `mobile`). A análise registrada na issue mostrou que a causa é um
defeito de acessibilidade do app, não do teste. Não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

1. Os botões Arquivos e Chat do cabeçalho do aluno mantêm um nome acessível que descreve a ação, com ou sem selo de
   contagem, no celular e no computador.
2. O e2e A13 deixa de depender da ordem entre o clique e o aviso do arquivo.

## 2. Contexto

Verificado em 2026-11-18 na `development` @ `34716d8` (2.2.0), `apps/web/src/pages/Room.tsx`:

- Botão de Arquivos do cabeçalho: no celular mostra só o ícone (o texto "Arquivos da aula" aparece só fora do
  celular) e tem `title="Arquivos da Aula"`. Com arquivos, o selo `filesBadge` com a contagem fica dentro do botão.
- Botão de Chat do cabeçalho: no celular mostra só o ícone, com `title` "Abrir Chat"/"Recolher Chat"; no computador
  mostra "Chat". Com mensagens não lidas, o selo `unreadBadge` ("3", "99+") fica dentro do botão.
- Os ícones Lucide são `aria-hidden`. Pelo cálculo do nome acessível, o conteúdo de texto tem precedência sobre o
  `title`: no celular, com selo, os botões passam a se chamar "1", "3" etc. Leitores de tela anunciam "1, botão".
- Evidência (#149, comentário de análise): teste de componente em 412 px com 1 arquivo → nenhum botão com nome
  `/Arquivos da aula/i`; e2e real (Pixel 7) com o selo já exibido → cabeçalho com `button "1"`, `button "Abrir Chat"`,
  `button "Sair"`. O A13 faz o upload e procura `/Arquivos da aula/i`; quando o aviso do arquivo chega antes do clique,
  o localizador espera até o timeout (2 falhas em 33 execuções).
- O gatilho do menu em tela cheia tem `aria-label` explícito e não tem o defeito.

## 3. Escopo

### Incluído

- Nome acessível dos botões Arquivos e Chat do cabeçalho do aluno (celular e computador).
- Selos de contagem desses dois botões fora da árvore de acessibilidade, com a contagem no nome.
- E2E A13 esperando o botão com a contagem antes de clicar.

### Não incluído

- Aparência dos botões e dos selos.
- Botões do menu em tela cheia, das gavetas e das abas (já têm texto visível ou `aria-label`).
- Desktop do professor, backend e `packages/`.

## 4. Atores

- **Aluno**, inclusive com leitor de tela (TalkBack, VoiceOver, NVDA).

## 5. User Stories

### US-5001 — Botões do cabeçalho com nome estável

Como aluno com leitor de tela, quero que os botões do cabeçalho digam o que fazem, mesmo quando mostram uma contagem.

- Dado o celular com 1 arquivo compartilhado, quando o leitor de tela chega ao botão de Arquivos, então ele anuncia
  "Arquivos da aula (1 arquivo)", e não "1".
- Dado o celular com 3 mensagens não lidas e o chat fechado, quando o leitor de tela chega ao botão de Chat, então ele
  anuncia "Abrir Chat (3 não lidas)".
- Dado o computador, então o nome continua contendo o texto visível ("Arquivos da aula", "Chat").

### US-5002 — E2E A13 determinístico

Como mantenedor, quero que o A13 passe sempre que o aluno receber e baixar o arquivo.

- Dado o upload do professor, quando o teste procura o botão de Arquivos, então espera o nome com a contagem
  ("Arquivos da aula (1 arquivo)") e o encontra em qualquer ordem entre o clique e o aviso do arquivo.

## 6. Requisitos Funcionais

- RF-5001: o botão de Arquivos do cabeçalho tem nome acessível "Arquivos da aula", acrescido de " (1 arquivo)" ou
  " (N arquivos)" quando há arquivos, no celular e no computador.
- RF-5002: o botão de Chat do cabeçalho tem nome acessível igual ao rótulo da ação: no celular, "Abrir Chat" ou
  "Recolher Chat" (o `title` atual); no computador, "Chat" (o texto visível). Com mensagens não lidas, acrescenta
  " (1 não lida)" ou " (N não lidas)", com "99+" acima de 99.
- RF-5003: os selos `filesBadge` e `unreadBadge` desses dois botões ficam `aria-hidden="true"`; o `title` dos botões
  continua igual.
- RF-5004: o e2e A13, depois do upload, espera o botão `{ name: /Arquivos da aula \(1 arquivo\)/i }` antes de clicar.

## 7. Requisitos Não Funcionais

- RNF-5001 — acessibilidade: o texto visível de cada botão está contido no nome acessível (WCAG 2.5.3); nenhuma mudança
  visual.
- RNF-5002 — regressão: testes existentes do `Room` e o e2e do aluno continuam verdes; A13 no `mobile` verde em 30
  execuções seguidas sem retry.
- RNF-5003 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Nome do botão de Arquivos | Nome do botão de Chat |
|---|---|---|
| celular, sem arquivos, chat fechado, sem não lidas | Arquivos da aula | Abrir Chat |
| celular, 1 arquivo, 3 não lidas, chat fechado | Arquivos da aula (1 arquivo) | Abrir Chat (3 não lidas) |
| celular, chat aberto | Arquivos da aula (…) | Recolher Chat |
| computador, 2 arquivos, 1 não lida | Arquivos da aula (2 arquivos) | Chat (1 não lida) |
| mais de 99 não lidas | — | … (99+ não lidas) |

## 9. Edge Cases

- Selo some (contagem volta a 0): o nome volta ao rótulo sem contagem.
- Chat aberto no computador: o selo de não lidas já não aparece hoje (contador zerado); o nome é "Chat".

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `npx vitest run` e `npm run lint` em `apps/web` verdes, com testes novos para RF-5001 a RF-5003.
- `npx playwright test -g "A13" --project=mobile --repeat-each=30 --retries=0` verde.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-5001 a C-5003).
