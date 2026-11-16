# Converge: Fixar uma Janela na Transmissão de Múltiplas Janelas

Feature: `032-fixar-janela-transmissao`
Status: PARTIAL — falta a verificação manual no Windows (T3206)
Branch: `feat/fixar-janela-transmissao`, a partir da `development` @ `0873ec8` (2.0.0, com o #93)

## 1. Revalidação antes da implementação (C-3201)

O `Room.tsx` do desktop depois do #93 mantém tudo o que o plan cita: `handleSwitchScreen`, `handleReconfigure` (botão
"Trocar tela", título "Alterar modo ou fonte da transmissão"), `handleEndSession`, o efeito de foco com
`onActiveWindowChanged`, o seletor "Janelas da Aula" e os ícones `Pin`/`PinFilled`. Nenhuma divergência mudou
comportamento; spec, plan e analyze ficaram como estavam.

## 2. Evidências

- `apps/desktop`: `npm run lint` (`tsc --noEmit`) verde; Vitest com 33 arquivos e 376 testes verdes.
- `cursorPresence.test.ts` (novo, 4 testes): o teste da janela fixada falha no código anterior (o alvo do cursor ia
  para a janela em foco) e passa com a T3201.
- `useScreenCapture.test.ts`: 4 testes novos (repasse de `pinnedSourceId`, chamada sem ele, `restartCursorTracking`
  sem `getUserMedia`, `ended` da faixa bruta).
- `Room.test.tsx`: 11 testes novos no bloco "fixar uma janela na transmissão (032)". Removendo a regra do foco com
  janela fixada, 2 deles falham (RF-3203 e RF-3207).
- O teste de múltiplas janelas existente passa sem mudança de asserção.

## 3. Requisitos

| Requisito | Evidência |
|---|---|
| RF-3201 | alfinete por janela com `aria-label` "Fixar/Desafixar <nome>" e `aria-pressed`; teste "mostra o alfinete..." |
| RF-3202 | `handlePinWindow`: sem recaptura se no ar (`restartCursorTracking`), senão `switchToSource` com `pinnedSourceId`; testes "fixar a janela no ar..." e "fixar B com A fixada..." |
| RF-3203 | efeito de foco grava `lastFocusedAuthorizedIdRef` e não troca com fixação; teste "com A fixada, o foco em B..." |
| RF-3204 | `handleUnpinWindow`; testes "desfixar depois do foco em B..." e "desfixar sem foco em outra janela..." |
| RF-3205 | selos "Fixada"/"Em pausa" e prévia "Fixada: <nome>"; teste "mostra o alfinete..." |
| RF-3206 | `clearWindowPin` em `handleReconfigure`, `handleEndSession` e quando `isLiveSession` vira `false`; testes de trocar tela e encerrar |
| RF-3207 | `setCaptureEndedListener` + `handleUnpinWindow`; teste "o fim da captura da janela fixada..." |
| RF-3208 | `cursorPresence.ts`: alvo preso à fixada, evento de foco mantido; `cursorPresence.test.ts` |
| RF-3209 | `handleWindowPillClick`; teste "fixar B com A fixada..." (clique no nome) |
| RF-3210 | teste "sem fixação, nenhuma troca..." (T3205) e teste de múltiplas janelas existente |
| RF-3211 | `cursorPresence.ts` ignora `pinnedSourceId` fora dos autorizados; `cursorPresence.test.ts` |
| RNF-3201 | campo opcional no preload e no contrato `003/contracts/desktop-ipc.md` ("Em vigor desde 032 (T3201)"); sem `packages/types` |
| RNF-3202 | testes de main, hook e componente acima |
| RNF-3203 | nenhuma dependência nova |

## 4. Decisões de implementação

- `handleSwitchScreen` passou a delegar a `switchToSource(source, pinnedSourceId?)`. Sem fixação, a chamada a
  `selectSource` continua com três argumentos, como antes.
- Fixar uma janela zera a "última janela em foco" para ela mesma, para valer o "desde a fixação" do RF-3204: o foco
  anterior à fixação não provoca troca ao desfixar.
- Se a captura falhar ao fixar outra janela, a janela e a fixação anteriores voltam; se falhar ao desfixar, a
  transmissão fica na janela que estava no ar, já desfixada (spec §9).
- O seletor expõe `data-pinned-source-id` (só para testes). Os testes de comportamento da T3203 entraram no commit da
  T3204, porque a fixação só é acionável pela interface; a T3203 só foi marcada `[x]` depois deles.

## 5. Desvios registrados

- Nenhum novo nesta feature.

## 6. Trabalho restante

- **Verificação manual no Windows (T3206)**, com o app instalado ou em `npm run dev` e duas janelas autorizadas:
  fixar A, colocar o foco em B (a transmissão continua em A), desfixar (passa para B), fechar a janela fixada (desfixa
  e volta a seguir o foco), "Trocar tela" (fixação desfeita), cursor e lupa só sobre A enquanto fixada, e a gravação
  local depois de trocas (C-3206). Não foi feita nesta sessão: depende de janelas reais do sistema operacional.

## 7. Impacto de versão

**MINOR** (C-3206): funcionalidade nova compatível, com campo opcional no IPC interno do desktop
(`docs/versionamento.md` §2).
