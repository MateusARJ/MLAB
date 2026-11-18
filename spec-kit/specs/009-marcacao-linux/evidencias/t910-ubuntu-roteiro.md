# 009 / T910 — roteiro manual no Ubuntu real, 2026-11-17

Ambiente: Ubuntu 26.04.1 LTS, GNOME Shell 50.1, kernel 7.0.0-30-generic, Node v22.23.5, `npm run dev` no commit
`45fa0aa` (MLab 2.1.3). Executado e aprovado pelo responsável.

Para cada sessão: `npm run dev`, criar sala, transmitir e abrir a barra de marcação.

## 1. GNOME Wayland (XWayland)

| Item | Resultado |
|---|---|
| Cliques em cada botão (ferramentas, desfazer, refazer, limpar, lupa) e no popover de cores, vindo de app Wayland nativo e de cima da janela do MLab (US-901) | OK |
| Clique fora da barra atravessa com a ferramenta cursor (US-901) | OK |
| Pincel e demais ferramentas desenham na tela inteira; voltar ao cursor libera a tela (US-901) | OK |
| Recolher/expandir pelo botão, pelo botão redondo e por `Alt+H` (US-902) | OK |
| Atalhos `Alt+…` com o MLab em foco; com app Wayland nativo em foco não disparam, como previsto; nenhum `atalho recusado` no log (US-903, RF-903) | OK (conforme esperado) |
| RF-904: letras únicas depois de clicar na barra | OK |
| Passagem do painel do MLab para o overlay com o pincel (C-903) | OK |
| Arrastar a barra e clicar de novo na posição nova | OK |

## 2. Escala de 200%

| Item | Resultado |
|---|---|
| Cliques e desenho com a área clicável alinhada à barra | OK |

## 3. X11 puro (sessão Openbox)

| Item | Resultado |
|---|---|
| Itens do bloco 1 | OK |
| Atalhos `Alt+…` com qualquer janela em foco (US-903) | OK |

## Pendente

- Nenhum: o smoke no Windows foi feito em 2026-11-18 (`t910-windows-smoke.md`).
