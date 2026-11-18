# Converge: Nome Acessível dos Botões do Cabeçalho do Aluno

Feature: `050-nome-acessivel-cabecalho-aluno`
Status: DONE
Branch: `fix/nome-acessivel-cabecalho-aluno`, a partir da `development` @ `34716d8` (2.2.0)

## 1. Evidências

- `apps/web`: `npx vitest run` — 5 arquivos, 77 testes verdes (5 novos no `describe` da 050); `npm run lint`
  (`tsc --noEmit`) verde.
- Dois testes antigos (018/RF-191 e 024/RF-2401) procuravam a aba Arquivos da gaveta do celular com `/^Arquivos/i` e
  só a achavam porque, com arquivos na lista, o botão do cabeçalho se chamava "1". Com o nome corrigido, os dois
  botões casavam; o localizador passou a `/^Arquivos( \d+)?$/i`, que só casa a aba. Nenhuma asserção mudou.
- A13 no `mobile`: `npx playwright test -g "A13" --project=mobile --repeat-each=30 --retries=0` → 30/30 (antes: 2
  falhas em 33).
- Cenário forçado (e2e temporário fora do repositório, Pixel 7): selo do arquivo exibido antes do clique. Antes da
  050, o cabeçalho expunha `button "1"` e o localizador achava 0 botões. Agora expõe
  `button "Arquivos da aula (1 arquivo)"`, `button "Abrir Chat"`, `button "Sair"`, e o clique abre a lista.
- Suíte e2e do aluno: 12 verdes e 1 instável. O A3 `[desktop]` passou no retry; ver §3.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-5001 | `filesButtonLabel()`; testes "no celular, o botão de Arquivos..." e "no computador, o nome do botão de Arquivos..." |
| RF-5002 | `withUnread()` com rótulo por tela; testes do Chat no celular, `99+` e "Chat" no computador |
| RF-5003 | selos com `aria-hidden="true"`; `title` sem mudança; asserções nos mesmos testes |
| RF-5004 | A13 com `{ name: /Arquivos da aula \(1 arquivo\)/i }`; 30/30 no `mobile` |
| RNF-5001 | texto visível contido no nome ("Arquivos da aula", "Chat"); nenhum estilo alterado |
| RNF-5002 | 72 testes anteriores verdes; A13 30/30; suíte e2e verde exceto o desvio #153 |
| RNF-5003 | nenhuma dependência nova |

## 3. Desvios registrados

- #153 — `fix(web): e2e A3 cai por timeout porque o video do professor nao chega ao aluno`. Não bloqueante: o vídeo
  do publisher simulado às vezes não chega ao aluno (palco preto, status Conectado). Sem a 050 (`Room.tsx` da
  `development`), o A3 falhou 3 vezes em 30; com a 050, 1 vez em 20. A causa é anterior a esta feature.

## 4. Trabalho restante

- Nenhum nesta feature. Teste com leitor de tela real (TalkBack/VoiceOver) fica para a validação manual do
  responsável.

## 5. Impacto de versão

**PATCH** (C-5003): correção de acessibilidade do web do aluno, sem capacidade nova nem mudança de contrato
(`docs/versionamento.md` §2). 2.2.0 → 2.2.1.
