# 009 / T910 — smoke manual da barra no Windows, 2026-11-18

Ambiente: Windows 11 Home 10.0.26300, Node v24.16.0, Electron 31.7.7, `npm run dev` na branch
`docs/converge-009-ubuntu` (commit `3d8b1ab`, MLab 2.1.4, com a T911). Executado e aprovado pelo responsável, que
relatou todos os itens como OK; não foram anexados prints nem trecho de log.

Preparação: `npm run dev`, criar sala, transmitir e abrir a barra de marcação, com outro app do Windows aberto ao
fundo.

| Item | Resultado |
|---|---|
| Cliques em cada botão (cursor, caneta, marca-texto, seta, retângulo, borracha, lupa/holofote, zoom) com outro app em foco (RNF-901) | OK |
| Popover de cores abre e a cor é aplicada | OK |
| Clique fora da barra atravessa para o app de baixo com a ferramenta cursor (RNF-901) | OK |
| Caneta, marca-texto, seta e retângulo desenham na tela inteira, sobre outros apps; borracha apaga | OK |
| Desfazer, refazer e limpar pelos botões e por `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+X` | OK |
| Recolher/expandir pelo botão e por `Alt+H` | OK |
| Holofote por `Alt+L` e por duplo `Ctrl`; níveis de zoom por `Alt+Z` | OK |
| Atalhos globais `Alt+V/P/M/A/R/E` e variantes `Alt+Shift+…` (incl. `U`, `Y`, `X`) com outro app em foco; nenhum `atalho recusado` no log (RF-903) | OK |
| Letras únicas (`V`, `P`, `M`, `A`, `R`, `E`, `L`, `Z`, `H`) depois de clicar na barra (RF-904) | OK |
| Com o MLab em foco a barra flutuante some e o painel usa a barra interna (C-903, RN-901) | OK |

Resultado: sem regressão no Windows; o caminho `setIgnoreMouseEvents(true, { forward: true })` segue como antes
(RNF-901) e as regras de anotação da 003 valem como estão (RN-901).
