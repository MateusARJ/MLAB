# Spec: Tela Cheia do Aluno sem Bordas

Status: READY
Feature ID: `049-tela-cheia-sem-bordas`
Origem: issue #147 (relato de uso: em tela cheia, o vídeo do aluno mostra bordas nos dois lados, no PC e no
celular). Muda só a apresentação do vídeo na página do aluno; não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

1. Em tela cheia, o vídeo da transmissão ocupa a tela inteira do aluno, sem faixas laterais.
2. O aluno pode voltar a ver a tela do professor inteira (com faixas) quando o corte atrapalhar a leitura.

## 2. Contexto

Verificado em 2026-11-18 na `development` @ `3566bae` (2.1.5):

- `apps/desktop/src/renderer/hooks/useScreenCapture.ts`: a captura limita a 1920×1080 e mantém a proporção da fonte.
  Uma tela 16:10 gera 1728×1080; a transmissão de uma janela gera a proporção da janela.
- `apps/web/src/pages/Room.tsx`, estilo `video`: `width/height: 100%`, `objectFit: 'contain'`,
  `backgroundColor: 'var(--stage)'`. Quando a tela do aluno é mais larga que o vídeo (celular em paisagem ≈ 19,5:9,
  monitor ultrawide 21:9, professor com tela 16:10 ou janela), o navegador completa a sobra com a cor do palco nos dois
  lados (pillarbox). É a causa das bordas da issue.
- O contêiner em tela cheia já ocupa a tela toda: nativo (`requestFullscreen` no contêiner raiz) ou pseudo-fullscreen
  (`position: fixed`, `100vw` × `100dvh`). `videoSection` e `videoWrapper` não têm padding nem margem laterais; a barra
  inferior e o aviso de mão levantada são `absolute` e não ocupam espaço.
- Dois fatores secundários diminuem a área do vídeo em tela cheia:
  - no computador, o chat começa aberto (`isChatOpen` = `true` fora do celular) e o painel de 340 px continua ao lado
    do vídeo depois de entrar em tela cheia;
  - no celular, `videoSectionMobile` reserva `padding-bottom: var(--sab)` (área segura inferior) também em tela cheia.
- Preencher a tela sem distorcer exige cortar parte da imagem (`object-fit: cover`). Na tela do professor podem
  existir texto ou código perto das bordas, então o corte precisa ser reversível pelo aluno.

## 3. Escopo

### Incluído

- Modo de exibição do vídeo em tela cheia: **Preencher** (sem faixas, com corte) e **Ajustar** (imagem inteira).
- Botão no menu da transmissão em tela cheia para alternar o modo, com a escolha salva no dispositivo.
- Chat e Arquivos fechados ao entrar em tela cheia; área segura inferior sem reserva em tela cheia.

### Não incluído

- Exibição fora da tela cheia (continua "ajustar", como hoje).
- Picture-in-Picture (o navegador controla a janela flutuante).
- Captura, resolução ou proporção enviadas pelo app do professor; backend; SFU.
- Telas de "aguardando" e "aula pausada".

## 4. Atores

- **Aluno:** assiste à transmissão em tela cheia no computador (16:9, 16:10, ultrawide) ou no celular (paisagem,
  fullscreen nativo ou pseudo-fullscreen do iOS).

## 5. User Stories

### US-4901 — Tela cheia sem bordas

Como aluno, quero que a tela cheia use a tela inteira, sem faixas nas laterais.

- Dada a transmissão 16:9 numa tela 1920×1080, 2560×1080 (ultrawide) ou 844×390 (celular em paisagem), quando o aluno
  entra em tela cheia, então o vídeo cobre toda a área, sem faixas da cor do palco.
- Dado o aluno fora da tela cheia, então o vídeo aparece como hoje (imagem inteira, com faixas se a proporção diferir).

### US-4902 — Voltar a ver a tela inteira do professor

Como aluno, quero mostrar a tela do professor inteira quando o corte esconder algo, e que o MLab lembre minha escolha.

- Dado o modo Preencher em tela cheia, quando o aluno escolhe "Mostrar tela inteira" no menu da transmissão, então o
  vídeo passa a mostrar a imagem inteira (com faixas) e o botão passa a oferecer "Preencher a tela".
- Dada a escolha feita, quando o aluno sai e volta à tela cheia ou recarrega a página no mesmo dispositivo, então o
  modo escolhido continua.

## 6. Requisitos Funcionais

- RF-4901: em tela cheia (nativa ou pseudo), no modo **Preencher**, o vídeo cobre toda a área disponível sem
  distorção (`object-fit: cover`), cortando o que sobrar da imagem, centralizado.
- RF-4902: no modo **Ajustar**, e sempre fora da tela cheia, o vídeo mostra a imagem inteira (`object-fit: contain`),
  como hoje.
- RF-4903: o modo padrão é **Preencher**.
- RF-4904: o menu da transmissão em tela cheia tem um botão que alterna o modo: com Preencher ativo, mostra
  "Mostrar tela inteira" ("Ajustar sem cortar as bordas"); com Ajustar ativo, mostra "Preencher a tela" ("Sem bordas;
  pode cortar as laterais"). O botão não fecha o menu.
- RF-4905: a escolha é salva no dispositivo (`localStorage`, chave `mlab-video-fit`, valores `cover`/`contain`) e lida
  ao abrir a sala; valor ausente, inválido ou armazenamento indisponível resultam no padrão, sem erro.
- RF-4906: ao entrar em tela cheia, Chat e Arquivos fecham; continuam acessíveis pelo menu da transmissão.
- RF-4907: no celular, em tela cheia, a área do vídeo não reserva a área segura inferior (`--sab`); fora da tela cheia,
  a reserva continua.
- RF-4908: fechados, o menu da transmissão em tela cheia e a gaveta Chat/Arquivos do celular não deixam sombra na
  borda direita da tela; abertos, a sombra continua.

## 7. Requisitos Não Funcionais

- RNF-4901 — regressão: os testes existentes do `Room` e o e2e do aluno (A10, A15) continuam verdes; fora da tela
  cheia, o layout da sala não muda.
- RNF-4902 — acessibilidade: o botão do modo tem nome acessível igual ao título visível e alvo de toque igual aos
  demais botões do menu.
- RNF-4903 — dependências: nenhuma nova (ícones do `lucide-react`, já dependência de `packages/ui`).

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| fora da tela cheia | `contain`, layout atual |
| tela cheia, modo Preencher (padrão) | `cover`, sem faixas; botão "Mostrar tela inteira" |
| tela cheia, modo Ajustar | `contain`, faixas se a proporção diferir; botão "Preencher a tela" |
| `localStorage` indisponível ou com valor inválido | modo Preencher; alternar funciona na sessão sem salvar |
| aula pausada ou aguardando | telas atuais, sem vídeo e sem efeito do modo |

## 9. Edge Cases

- Mesma proporção da tela e do vídeo: os dois modos ficam iguais, sem corte.
- Chat ou Arquivos abertos pelo menu durante a tela cheia: o vídeo ocupa a área restante, no modo escolhido.
- Tela do aluno mais alta que o vídeo (celular em retrato em pseudo-fullscreen): Preencher corta em cima e embaixo
  em vez de mostrar faixas; Ajustar mostra a imagem inteira.

## 10. Dados/Contratos impactados

- Nenhum contrato. Preferência local nova no navegador do aluno: `mlab-video-fit` (RF-4905), sem dado de servidor.

## 11. Critérios de Sucesso

- `npm test` e `npm run lint` em `apps/web` verdes, com testes novos para RF-4901 a RF-4908.
- Verificação visual em tela cheia: 1920×1080, 2560×1080 e 844×390, nos dois modos, com uma transmissão 16:9.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4901 a C-4905).
