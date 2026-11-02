# Clarify: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Status: CLOSED

Decisões tomadas com o dono do produto em 2026-11-02.

## C-701 — Prioridade entre FPS e ocultação do cursor

- **Contexto:** a ocultação exige compor o quadro num canvas. Em máquinas sem aceleração de canvas por GPU, isso pode
  custar vários milissegundos por quadro em 1080p. O `29c54d0` removeu a ocultação por esse motivo; a versão anterior
  desligava a máscara para sempre ao passar de 8,5 ms.
- **Alternativas consideradas:** ocultar sempre (pode derrubar o FPS); desligar para sempre ao primeiro estouro
  (versão anterior).
- **Resposta aprovada:** o FPS e a qualidade têm prioridade ("não diminuir a qualidade e o fps das transmissões"). A
  ocultação só roda nos quadros que precisam dela e é suspensa quando passa do orçamento, com nova tentativa
  posterior (espera crescente para não piscar o cursor). As anotações continuam sendo desenhadas como hoje.

## C-702 — Modo tela cheia

- **Contexto:** desde o `29c54d0` a tela cheia usa a captura crua, sem worker. Ocultar o cursor sobre o MLab exigiria
  voltar ao worker em tempo integral (opção A) ou trocar de faixa com `replaceTrack` só durante a ocultação (opção B).
- **Resposta aprovada:** opção C. A tela cheia continua com a captura crua e o requisito da 003 é ajustado (US-20,
  RF-310): o cursor não é ocultado sobre a área do MLab nesse modo. A opção B fica como estudo futuro, com protótipo e
  medição.

## Resultado

CLOSED — C-701 e C-702 respondidas; nenhuma ambiguidade em aberto.
