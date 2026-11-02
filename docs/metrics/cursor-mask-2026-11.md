# Medição: Ocultação do Cursor na Janela Específica (007)

Status: **PENDENTE** (T705, manual)
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

1. Linha de base: app empacotado a partir da `development` **sem** a 007 (commit `7e27bd3`).
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
