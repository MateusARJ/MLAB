# Spec: Uma Única Conexão de Sinalização por Entrada do Aluno

Status: READY
Feature ID: `044-conexao-unica-do-aluno`
Origem: issue #127 (desvio encontrado na 042/T4201 e na 043/T4301). Corrige o web do aluno; não muda regra de
negócio, contrato, backend nem ADR.

## 1. Objetivo

Garantir que a página ao vivo do aluno abra uma única conexão de sinalização por entrada, para que o fechamento
`4001` (027/RF-2704, 005/C-502) só apareça quando o mesmo aluno abrir de fato outra aba ou dispositivo.

## 2. Contexto

Verificado em 2026-11-16 na `development` @ `a972cb2` (2.1.0):

- O e2e do aluno cai de forma intermitente (A13, A14, A20 e o primeiro teste depois que o servidor sobe): a única aba
  recebe `4001` e volta para `/entrar` com "Sua sessão foi aberta em outra aba ou dispositivo." (issue #127).
- `apps/web/src/main.tsx` monta o app em `React.StrictMode`, e o e2e serve o web pelo Vite em modo de
  desenvolvimento (`apps/web/playwright.config.ts`). Nesse modo o React monta, desmonta e monta de novo os efeitos.
- `apps/web/src/hooks/useWebRTCSubscriber.ts` cria o WebSocket de forma síncrona dentro do efeito. A desmontagem
  simulada fecha esse primeiro WebSocket ainda em `CONNECTING` e a remontagem abre um segundo com o mesmo token.
- O pedido de upgrade do primeiro WebSocket já saiu; o backend o registra no hub mesmo assim. As duas conexões chegam
  ao `onRegister` (`apps/backend/internal/signaling/hub.go`) em ordem não determinística. Quando a descartada
  registra por último, o hub fecha a conexão viva com `4001` (027/RF-2704, comportamento correto do backend), e o web
  mostra o aviso de sessão substituída.
- No build de produção o React não duplica efeitos, mas a mesma corrida vale para qualquer remontagem da página ao
  vivo com uma conexão ainda em `CONNECTING`.

## 3. Escopo

### Incluído

- Abrir a conexão de sinalização do aluno só depois que a montagem da página ao vivo se confirma, sem conexão
  descartável a caminho do servidor.
- Teste unitário que reproduz a montagem dupla do `StrictMode`.

### Não incluído

- Mudanças no backend, na regra de sessão única (RN-04, ADR 0010) ou no fechamento `4001` (027/RF-2704).
- Mudanças no aviso do `4001` (005/C-502), em `main.tsx` ou nos e2e.

## 4. Atores

- **Aluno:** entra na aula por uma única aba.

## 5. User Stories

### US-4401 — Entrada sem aviso falso de sessão duplicada

Como aluno, quero continuar ao vivo depois de entrar por uma única aba, para não ser devolvido à entrada com um aviso
de outra aba que eu não abri.

- Dado um aluno que entra por uma única aba, quando a página ao vivo monta (inclusive com a montagem dupla do
  `StrictMode`), então o web abre uma única conexão de sinalização e o aluno continua em `/ao-vivo`.
- Dado um aluno com uma conexão ativa, quando o mesmo token abre outra conexão em outra aba, então a anterior continua
  recebendo `4001` e mostrando o aviso da 005/C-502.

## 6. Requisitos Funcionais

- RF-4401: a página ao vivo do aluno abre no máximo uma conexão de sinalização por montagem efetiva; uma montagem
  desfeita antes de se confirmar não abre conexão.
- RF-4402: o tratamento do `4001` (status `duplicate`, sem reconexão, aviso da 005/C-502) não muda.

## 7. Requisitos Não Funcionais

- RNF-4401 — estabilidade: `npx playwright test --repeat-each=3 --retries=0` em `apps/web` sem `4001` falso.
- RNF-4402 — contrato e backend: nenhum contrato, payload ou arquivo do backend muda.
- RNF-4403 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado esperado |
|---|---|---|
| página ao vivo monta, desmonta e monta (StrictMode) | efeitos | uma única conexão aberta |
| página ao vivo desmonta antes de abrir a conexão | cleanup | nenhuma conexão aberta |
| conexão ativa | `4001` (outra aba com o mesmo token) | status `duplicate`, sem reconexão (RF-4402) |

## 9. Edge Cases

- Desmontagem real logo após a montagem (aluno sai antes de conectar): nenhuma conexão chega ao servidor.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- Teste unitário com `StrictMode` cria um único WebSocket; e2e completo sem `4001` falso em três repetições sem retry.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4401 e C-4402).
