# Clarify: Tela Cheia do Aluno sem Bordas

Feature: `049-tela-cheia-sem-bordas`
Status: CLOSED

Decisões registradas em 2026-11-18 na correção da issue #147, pedida pelo responsável.

## C-4901 — Como preencher a tela sem perder conteúdo

- **Opções:** (A) sempre `cover` em tela cheia; (B) `fill` (esticar); (C) alternar entre Preencher (`cover`) e Ajustar
  (`contain`), com Preencher como padrão.
- **Resposta:** **C**, escolhida pelo responsável. (A) pode esconder texto ou código nas bordas da tela do professor
  sem saída para o aluno; (B) distorce a imagem e o texto. Em (C) a tela cheia abre sem bordas, como pede a issue, e o
  aluno volta à imagem inteira com um toque.
- **Impacto em spec:** RF-4901 a RF-4904.

## C-4902 — Onde fica o controle e se a escolha persiste

- **Opções:** (A) botão flutuante próprio sobre o vídeo; (B) item no menu da transmissão em tela cheia, ao lado de PiP
  e "Sair da Tela Cheia".
- **Resposta:** **B**. Em tela cheia todos os controles do aluno já ficam nesse menu (043); um botão flutuante a mais
  cobriria o vídeo. A escolha fica salva no dispositivo, como o tema (`mlab-theme`, 028), na chave `mlab-video-fit`.
  O acesso ao `localStorage` fica em `try/catch`, como em `ThemeToggle`.
- **Impacto em spec:** RF-4904, RF-4905.

## C-4903 — Painéis e área segura em tela cheia

- **Achado:** no computador, o chat começa aberto e continua ocupando 340 px ao lado do vídeo depois de entrar em tela
  cheia; no celular, `videoSectionMobile` reserva a área segura inferior também em tela cheia. Os dois reduzem a área
  do vídeo e contrariam o "esperado" da issue (o vídeo ocupa a tela inteira).
- **Resposta:** ao entrar em tela cheia, Chat e Arquivos fecham (seguem no menu da transmissão); em tela cheia, a área
  segura inferior não é reservada. Abrir Chat ou Arquivos pelo menu continua como hoje.
- **Impacto em spec:** RF-4906, RF-4907.

## C-4904 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `fix/tela-cheia-sem-bordas`.
- **Faixa de IDs:** `US-490x`, `RF-490x`, `RNF-490x`, `C-490x` e `T490x` (sem colisão: busca por `RF-49`, `C-49`,
  `T49` sem resultado).
- **Impacto de versão:** **MINOR**. Além da correção, o aluno ganha uma opção nova (Preencher/Ajustar) salva no
  dispositivo: "nova opção" em `docs/versionamento.md` §2. Nenhum contrato muda. 2.1.5 → 2.2.0.

## Resultado

CLOSED: C-4901 a C-4904 respondidas, sem ambiguidade em aberto.
