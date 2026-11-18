# Converge: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Feature: `047-erro-x-rastreador-janelas`
Status: DONE
Branch: `fix/erro-x-rastreador-janelas`, a partir da `development` @ `b17d684` (2.1.4)

## 1. Evidências

- T4701, vermelho antes da correção: `npx vitest run src/main/nativeWindowTracker.test.ts` com 5 falhas (`BadWindow`
  lança "handler padrão do Xlib: exit()", sem `XSync`, rastreador criado sem `koffi.register`, sem `unregister`); os 2
  testes existentes verdes.
- T4702: `x11ErrorTrap.test.ts` 7/7; `x11InputShape.test.ts` 12/12 sem alteração no arquivo (RF-4703);
  `annotationOverlayWindow.test.ts` 24/24; `tsc --noEmit` sem erros.
- T4703, Windows: `npx vitest run` no desktop com 34 arquivos e 393 testes verdes; `tsc --noEmit` sem erros.
- T4704, servidor X real (WSLg, XWayland), clone limpo com `npm ci`, mesmo `package-lock.json`
  (`evidencias/t4704-wslg-badwindow.log`):
  - antes (`development` @ `b17d684`): `BadWindow` em `X_QueryTree` e "Worker exited unexpectedly";
  - depois: `nativeWindowTracker.test.ts` 7/7; suítes X11 da 009 e da 047 66/66; desktop completo 393/393 no Linux
    (a 009 registrava 374/376 por causa da #139); `tsc --noEmit` sem erros.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4701 | `nativeWindowTracker.ts`: `queryWindow` e `queryTopWindowAtCursor` em `trap.run`; `x11ErrorTrap.ts` restaura o handler em `finally`; testes da T4701 e da T4702; WSLg sem `exit()` |
| RF-4702 | `guarded` em `createLinuxX11Tracker`: `BadWindow` sem log, outro erro com aviso único por código; testes "BadWindow…" e "outro erro X…" |
| RF-4703 | `x11InputShape.ts` usa o trap; `x11InputShape.test.ts` 12/12 sem alteração |
| RNF-4701 | WSLg: `nativeWindowTracker.test.ts` verde, antes derrubava o worker |
| RNF-4702 | diff de `nativeWindowTracker.ts` só no import e em `createLinuxX11Tracker`; suíte do desktop no Windows 393/393 |
| RNF-4703 | uma chamada `XSync` por `run`, sem temporizador novo |
| RNF-4704 | nenhuma dependência nova (`package-lock.json` sem mudança além do `npm run bump`) |

## 3. Divergências (código ≠ spec/plan)

- Nenhuma. A spec previa rastreador `null` sem `koffi.register`; a implementação também fecha o display aberto nesse
  caso, no rastreador e na região de entrada, para não deixar a conexão X pendurada.

## 4. Desvios registrados

- Nenhum novo.

## 5. Trabalho restante

- Nenhum nesta feature. A #139 fica resolvida pelo PR desta branch.
- Não verificado: fechar a janela capturada durante uma transmissão real no app empacotado. O caminho de código é o
  mesmo do teste com XID inválido no WSLg.

## 6. Impacto de versão

**PATCH** (C-4703), 2.1.4 → 2.1.5: correção de estabilidade no desktop, sem mudança de capacidade nem de contrato
(`docs/versionamento.md` §2).
