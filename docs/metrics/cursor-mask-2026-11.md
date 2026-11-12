# Medição: Ocultação do Cursor na Janela Específica (007)

Status: **PENDENTE** (T705, manual). Rodada preliminar de 2026-11-11 inconclusiva, com indício de queda de FPS
(seção 6).
Feature: `spec-kit/specs/007-mascara-cursor-janela` — RNF-701, RF-703, RF-704.

## 1. Ambiente

| Item | Valor |
|---|---|
| Data | |
| Máquina do professor (CPU/GPU/SO) | |
| Versão do app (empacotado) | |
| `chrome://gpu` no app — "Canvas" | (Hardware accelerated / Software only) |
| Navegador do aluno | Chrome |
| Fonte transmitida | janela específica, 1920×1080 |
| FPS alvo configurado | |

## 2. Procedimento

1. Linha de base: app empacotado a partir da `development` **sem** a 007 (desde 2026-11-11: `3e5e657`, versão
   1.12.1; antes, `7e27bd3`).
2. Versão com a 007: app empacotado a partir da branch `fix/mascara-cursor-janela`.
3. Em cada versão, transmitir uma janela e abrir no aluno `chrome://webrtc-internals` → `inbound-rtp` (vídeo).
4. Cada cenário por 60 s; anotar a média de `framesPerSecond` e, no início e no fim, `frameWidth`/`frameHeight`,
   `keyFramesDecoded` e `freezeCount`.
5. Cenários:
   - **V** — cursor visível: janela transmitida em foco, cursor movendo sobre ela.
   - **O** — cursor oculto: outra janela cobrindo parte da janela transmitida, cursor movendo sobre essa parte.
   - **T** — alternância: entrar e sair da área coberta a cada ~2 s (verifica keyframes extras).
   - **A** — anotação ativa (pincel) com cursor visível.
6. No app com a 007, conferir o log do renderer: nenhuma linha `[CursorMask] ... suspensa` indica que a máscara
   coube no orçamento de 8 ms.

## 3. Resultados

| Cenário | Versão | FPS médio | Resolução | Δ keyFramesDecoded | Δ freezeCount | Cursor oculto? |
|---|---|---|---|---|---|---|
| V | base | | | | | n/a |
| V | 007 | | | | | n/a |
| O | base | | | | | (esperado: não) |
| O | 007 | | | | | |
| T | base | | | | | |
| T | 007 | | | | | |
| A | base | | | | | n/a |
| A | 007 | | | | | n/a |

Log `[CursorMask]` durante O/T: 

## 4. Critérios (RNF-701)

- [ ] V: FPS e resolução da 007 iguais à base.
- [ ] O: FPS ≥ 95% do alvo; resolução igual à de V.
- [ ] T: Δ keyFramesDecoded da 007 sem aumento em relação à base (nenhum keyframe por alternância).
- [ ] A: resolução igual à de V (RF-704).
- [ ] Cursor oculto em O, sem mancha visível.

## 5. Conclusão

PENDENTE.

## 6. Rodada preliminar (2026-11-11) — inconclusiva

Feita pelo responsável com os dois apps empacotados. O aluno rodou no mesmo notebook do professor, porque a outra
máquina não funcionou. Os quatro cenários (V, O, T e A) ficaram misturados numa única gravação de cerca de 1 min por
versão. Não foram registrados o `chrome://gpu` nem o log `[CursorMask]`. Dumps do `chrome://webrtc-internals` do
aluno guardados fora do repositório.

| Métrica (`inbound-rtp` de vídeo, aluno) | 007 (23:31) | base (23:35) |
|---|---|---|
| Duração | 65 s | 77 s |
| FPS médio / mediana | 22,8 / 24 | 40,2 / 44 |
| FPS p10 / máximo | 8 / 41 | 24 / 58 |
| Segundos abaixo de 20 fps | 17 de 65 | 2 de 77 |
| `freezeCount` / `totalFreezesDuration` | 19 / 6,3 s | 4 / 1,7 s |
| `framesDropped` / `pliCount` | 10 / 2 | 0 / 0 |
| Resolução | 1920×1080 constante | 1920×1080 constante |
| Keyframes | a cada 10 s, sem extras | a cada 10 s, sem extras |
| Perda de pacotes / RTT máximo | 0 / 8 ms | 0 / 13 ms |
| Bitrate médio | 2,46 Mbps | 1,71 Mbps |
| Decodificador / tempo médio de decodificação | libvpx (VP8, software) / 9,7 ms | libvpx (VP8, software) / 6,1 ms |

Leitura:

- RF-704 e o critério de keyframes de RNF-701 se sustentam: a resolução não muda e não há keyframe fora do ritmo
  de 10 s.
- O FPS da 007 ficou bem abaixo da base, com cinco vezes mais travamentos. O responsável também percebeu a
  transmissão "um pouco travada". Isso **não atende** RNF-701 nesta rodada.
- A rodada não basta para concluir. Com o aluno no mesmo notebook, a decodificação VP8 em software (4 GB de RAM,
  8 threads) disputa a CPU com a captura e o worker. Como os cenários estão misturados, não dá para saber se a queda
  vem da máscara (O/T) ou do repasse (V/A). A ordem 007 → base também não descarta aquecimento.

Para a rodada válida:

1. Aluno em outro dispositivo da rede (outro PC ou celular em `mlab.local`).
2. Um dump por cenário e por versão (V, O, T, A), cada um com 60 s.
3. Ordem base → 007 → base, para descartar aquecimento.
4. No app com a 007, rodar também com `localStorage.setItem('mlab.cursorMask', 'off')` (worker desligado), para
   isolar o custo do worker.
5. Registrar o `chrome://gpu` (Canvas) e copiar as linhas `[CursorMask]` do log do renderer.
