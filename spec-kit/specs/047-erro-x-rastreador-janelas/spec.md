# Spec: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Status: READY
Feature ID: `047-erro-x-rastreador-janelas`
Origem: issue #139 (desvio encontrado na 009/T905 e na 009/T910). Corrige o main process do desktop no Linux; não muda
regra de negócio, contrato nem ADR.

## 1. Objetivo

Impedir que um erro X numa consulta do rastreador de janelas X11 (`nativeWindowTracker.ts`) encerre o processo do app
desktop no Linux. Um XID inválido, como o de uma janela capturada que fechou, passa a dar o resultado de "janela não
encontrada".

## 2. Contexto

Verificado em 2026-11-18 na `development` @ `b17d684` (2.1.4):

- `createLinuxX11Tracker` (`apps/desktop/src/main/nativeWindowTracker.ts`) abre a própria conexão X e consulta janelas
  com `XQueryTree`, `XGetWindowAttributes` e `XTranslateCoordinates`, sem `XSetErrorHandler`. Diante de um XID
  inválido, o servidor X responde `BadWindow`, e o handler padrão do Xlib imprime o erro e chama `exit()`.
- No Linux, `nativeWindowTracker.test.ts` derruba o worker do vitest (`BadWindow`, opcode 15 `X_QueryTree`), e
  `npx turbo run test --force` falha em `@mlab/desktop` (evidência da 009: `evidencias/t910-ubuntu-testes.log`).
- No app real, o `CursorPresenceTracker` (`cursorPresence.ts`) chama o rastreador a cada 16 ms com o XID da janela
  capturada; se ela fechar durante a transmissão, o mesmo erro pode encerrar o processo principal.
- A 009/T911 (#141) resolveu o mesmo defeito em `x11InputShape.ts` com um handler próprio instalado só durante a
  chamada, `XSync` e restauração do handler anterior. A #139 pede que as duas correções usem um mecanismo único, porque
  o handler do Xlib é global por processo.

## 3. Escopo

### Incluído

- Tratamento de erro X nas consultas do rastreador de janelas X11.
- Mecanismo único de captura de erro X, usado pelo rastreador e pela região de entrada da 009.
- Testes unitários com `koffi` simulado e verificação num servidor X real.

### Não incluído

- Mudanças no `CursorPresenceTracker`, na barra de marcação ou nos rastreadores do Windows e do macOS.
- A presença do cursor sob XWayland fora de janelas X11 (#140).

## 4. Atores

- **Professor no Linux:** transmite uma janela e pode fechá-la durante a aula.

## 5. User Stories

### US-4701 — Fechar a janela capturada não fecha o MLab

Como professor no Linux, quero que o MLab continue aberto quando a janela que eu transmito fecha, para não perder a
aula por causa de uma janela de outro programa.

- Dado o rastreador X11 ativo, quando uma consulta usa o XID de uma janela que não existe mais, então o processo segue
  vivo e a consulta devolve o resultado de janela não encontrada.
- Dado o rastreador X11 ativo, quando ocorre outro erro X numa consulta, então o processo segue vivo, o erro é
  registrado no log uma vez por código e a consulta devolve o que conseguiu ler.

## 6. Requisitos Funcionais

- RF-4701: nenhuma consulta do rastreador X11 encerra o processo por erro X. O handler próprio fica instalado só
  durante a consulta e o anterior volta em seguida, também quando a consulta lança.
- RF-4702: `BadWindow` numa consulta dá o resultado de janela não encontrada (`targetBounds` nulo, sem correspondência
  de foco nem de janela sob o cursor), sem log. Outro erro X é registrado com `console.warn` uma vez por código de erro
  e não lança.
- RF-4703: o comportamento da região de entrada da 009 (T911) não muda: `BadWindow` é ignorado com aviso e outro erro
  lança para o manager voltar ao hit-test.

## 7. Requisitos Não Funcionais

- RNF-4701 — Linux: `nativeWindowTracker.test.ts` passa num servidor X real, sem derrubar o worker.
- RNF-4702 — sem regressão: os rastreadores do Windows e do macOS não mudam; a suíte do desktop segue verde no Windows.
- RNF-4703 — custo: uma ida e volta a mais ao servidor X (`XSync`) por consulta, sem temporizador novo.
- RNF-4704 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado esperado |
|---|---|---|
| janela capturada viva | consulta | resultado normal |
| janela capturada fechou (XID inválido) | `BadWindow` na consulta | janela não encontrada, sem log, processo vivo |
| outro erro X | consulta | aviso no log uma vez por código, resultado parcial, processo vivo |
| `koffi.register` indisponível | criação do rastreador | rastreador `null` (fallback do Electron), como já ocorre sem `koffi` |

## 9. Edge Cases

- XID `0` (sem janela-alvo): continua sem consulta ao servidor, como hoje.
- Erro entregue fora de uma consulta: não vaza para a consulta seguinte.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- Testes com `koffi` simulado: `BadWindow` não lança e o handler volta ao anterior; outro erro só gera aviso.
- `nativeWindowTracker.test.ts` verde no WSLg (XWayland), onde antes derrubava o worker.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4701 a C-4703).
