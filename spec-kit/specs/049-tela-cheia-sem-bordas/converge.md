# Converge: Tela Cheia do Aluno sem Bordas

Feature: `049-tela-cheia-sem-bordas`
Status: DONE
Branch: `fix/tela-cheia-sem-bordas`, a partir da `development` @ `3566bae` (2.1.5)

## 1. Evidências

- `apps/web`: `npx vitest run` — 5 arquivos, 72 testes verdes (7 novos no `describe` da 049); `npm run lint`
  (`tsc --noEmit`) verde.
- `npx turbo run build --filter=@mlab/web...` verde (`@mlab/types`, `@mlab/ui`, `@mlab/web`).
- Verificação visual com o backend e o Vite reais (Playwright, suíte temporária fora do repositório), vídeo 16:9 do
  fixture (640×360), tela cheia nativa. Faixa = sobra entre o vídeo desenhado e o elemento, por lado:

| Tela | Antes (fora da tela cheia) | Tela cheia, Preencher | Tela cheia, Ajustar |
|---|---|---|---|
| 1920×1080 | vídeo 1580×1024 (chat aberto), faixa vertical 68 px | 1920×1080, sem faixa | 1920×1080, sem faixa |
| 2560×1080 | faixa lateral 200 px | 2560×1080, sem faixa | faixa lateral 320 px |
| 844×390 (celular) | faixa lateral 126 px | 844×390, sem faixa | faixa lateral 75 px |

- Em 1920×1080 o vídeo ocupa a tela inteira porque o chat fecha ao entrar em tela cheia (RF-4906); antes, o painel
  de 340 px continuava ao lado do vídeo.
- A primeira captura em 844×390 mostrou uma faixa escura na borda direita: a sombra do menu da transmissão e da
  gaveta do celular, fechados fora da tela. Virou RF-4908/C-4905 (`27cc2ce`) e foi corrigida; a nova captura não tem a
  faixa.
- `npx playwright test` (e2e do aluno): 12 verdes e 1 instável. A10 e A15 verdes nos projetos `desktop` e `mobile`
  (RNF-4901). A13 `[mobile]` passou só no retry; ver §3.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4901 | `objectFit: effectiveFullscreen ? videoFit : 'contain'`; teste "em tela cheia o vídeo preenche..."; tabela acima |
| RF-4902 | mesmo teste (fora da tela cheia e após sair); coluna Ajustar |
| RF-4903 | `readVideoFit()` devolve `cover` sem valor salvo; mesmo teste |
| RF-4904 | item `video-fit-toggle` no menu; teste "o menu em tela cheia alterna..." (menu continua aberto) |
| RF-4905 | `mlab-video-fit` com `try/catch`; testes "usa a escolha salva..." e "armazenamento indisponível..." |
| RF-4906 | efeito na transição de `effectiveFullscreen`; teste "ao entrar em tela cheia o chat fecha..." |
| RF-4907 | `videoSectionMobile` só fora da tela cheia; teste "no celular, a área segura inferior..." |
| RF-4908 | `boxShadow: 'none'` fechados; teste "menu em tela cheia e gaveta do celular fechados..."; captura 844×390 |
| RNF-4901 | 65 testes anteriores verdes; A10 e A15 verdes; layout fora da tela cheia sem mudança |
| RNF-4902 | `aria-label` = título visível; mesmo `fullscreenActionButton` dos demais itens |
| RNF-4903 | só `Expand`/`Shrink` re-exportados do `lucide-react` já instalado |

## 3. Desvios registrados

- #149 — `fix(web): e2e A13 no mobile cai por timeout esperando o botao de arquivos`. Não bloqueante: 2 falhas em 33
  execuções, sempre na entrada da sala, antes do código alterado; A10 e A15 exigidos pela RNF-4901 passaram.

## 4. Trabalho restante

- Nenhum nesta feature. Verificação em aparelho real (Android em paisagem e iPhone em pseudo-fullscreen) fica para o
  teste manual do responsável.

## 5. Impacto de versão

**MINOR** (C-4904): além da correção, o aluno ganha a opção Preencher/Ajustar salva no dispositivo ("nova opção",
`docs/versionamento.md` §2). Nenhum contrato muda. 2.1.5 → 2.2.0.
