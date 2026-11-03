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

## C-703 — Movimento rápido e cursor parado (teste do professor, 2026-11-02)

- **Contexto:** no primeiro teste com as T701–T703, o professor relatou:
  1. com o mouse rápido sobre outra janela que cobre a transmitida, o cursor ainda aparece;
  2. com o cursor parado, aparece um quadrado borrado no lugar dele.
- **Causa 1:** o retângulo usa a posição atual do ponteiro (folga máxima de 28 px por lado), mas o quadro capturado
  chega 2 a 4 quadros depois, com o cursor numa posição anterior, fora do retângulo.
- **Causa 2:** a regra herdada de antes do `29c54d0` troca a placa pelo preenchimento borrado após 350 ms parado; e a
  placa, atualizada só durante a ocultação, nascia com o cursor desenhado.
- **Resposta aprovada:** apagar a união dos retângulos ocultos dos últimos 150 ms (rastro); manter a placa atualizada
  também no repasse, a cada 250 ms, preservando a área do cursor; usar a placa sempre que a região estiver limpa, e o
  borrão só sem pixel limpo conhecido. A atualização da placa entra na proteção de FPS (C-701 continua valendo). Sob
  cursor parado sobre vídeo, a área mostra o último conteúdo limpo (aceito: aulas usam majoritariamente conteúdo
  estático).

## C-704 — Conteúdo em movimento sob o cursor (teste do professor, 2026-11-03)

- **Contexto:** com vídeo ou animação na janela transmitida e o cursor oculto (outra janela em foco), um quadrado
  borrado acompanha o cursor. Com conteúdo parado, a ocultação funciona. Reproduzido em harness com janela animada:
  a placa congela a área do cursor e do rastro enquanto ele passa, então a área apagada mostra conteúdo de 0,3 a
  0,5 s atrás. Não há como saber o conteúdo real sob o cursor num quadro de vídeo.
- **Alternativas consideradas:** reduzir a área e atualizar a placa a cada quadro (quadrado menor, ainda visível);
  preencher pelo entorno do quadro atual (mancha borrada do tamanho do cursor); mostrar o cursor.
- **Resposta aprovada:** mostrar o cursor quando o conteúdo em volta da área apagada estiver mudando; com conteúdo
  parado, continuar ocultando. A mudança é detectada comparando, num anel em volta da área apagada, o quadro atual
  com a placa de fundo; a máscara volta 500 ms depois da última mudança, para o cursor não piscar. Substitui a
  aceitação de C-703 para o cursor parado sobre vídeo.

## Resultado

CLOSED — C-701, C-702, C-703 e C-704 respondidas; nenhuma ambiguidade em aberto.
