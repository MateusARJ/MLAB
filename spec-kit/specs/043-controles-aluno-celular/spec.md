# Spec: Controles do Aluno no Celular

Status: READY
Feature ID: `043-controles-aluno-celular`
Origem: issue #98 (teste manual no celular do aluno, sobre a `feat/design-system-2`). Corrige o layout de dois
controles do player do aluno; não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

1. Manter espaço entre a pílula "Levantar mão" e o grupo Picture-in-Picture / Tela Cheia sobre o vídeo, em qualquer
   largura de celular e nos dois estados da pílula.
2. Mostrar um único botão de fechar no menu lateral em tela cheia.

## 2. Contexto

Verificado em 2026-11-16 na `development` @ `0873ec8` (2.0.0), `apps/web/src/pages/Room.tsx`:

- `handPos`: pílula com `position: absolute`, `left: 50%` + `translateX(-50%)` e `maxWidth: calc(100% - 140px)`.
- `videoOverlayControls`: grupo PiP / Tela Cheia com `position: absolute`, `right: 16px`, cerca de 90 px de largura.
- Os dois são posicionados cada um por conta própria. Centralizada, a pílula precisa de folga dos dois lados
  (≈ 2 × (16 + 90 + 8) px), mas só 140 px são reservados. Em 360 px a pílula invade o grupo; com o texto ativo
  "Mão levantada (abaixar)" e `white-space: nowrap`, piora.
- Em tela cheia, o gatilho flutuante do menu (`fullscreenMenuBtn`, `position: fixed`, `top/right: 16px`, 44 px,
  `z-index: 100`) vira X quando o menu abre, e o cabeçalho da sidebar (`fullscreenSidebarHeader`, `z-index: 95`) tem
  outro botão de fechar (`closeDrawerBtn`, 40 px) no mesmo canto: os dois X se sobrepõem.
- O gatilho tem `aria-label` fixo "Menu da transmissão" e não informa o estado aberto/fechado.

## 3. Escopo

### Incluído

- Barra inferior do vídeo (fora da tela cheia): pílula e grupo numa mesma linha flexível.
- Rótulo curto da pílula ativa em telas estreitas.
- Remoção do X do cabeçalho da sidebar em tela cheia; estado acessível no gatilho.

### Não incluído

- Drawers de Arquivos e Chat (desktop e celular) e seus botões de fechar.
- Lógica de levantar mão, PiP, tela cheia, chat e arquivos.
- Desktop do professor, backend e `packages/`.

## 4. Atores

- **Aluno:** assiste à transmissão no celular (retrato e paisagem) ou no computador.

## 5. User Stories

### US-4301 — Controles do vídeo sem sobreposição

Como aluno no celular, quero tocar em "Levantar mão", PiP e Tela Cheia sem que um controle cubra o outro.

- Dado o vídeo ao vivo em 320, 360 ou 390 px de largura (retrato), quando a pílula está no estado normal ou ativo,
  então há pelo menos 8 px entre a pílula e o grupo PiP / Tela Cheia.
- Dado o vídeo ao vivo no computador (1280 px), então a pílula continua centralizada no vídeo, como hoje.

### US-4302 — Um único X no menu em tela cheia

Como aluno em tela cheia, quero um único botão para fechar o menu lateral.

- Dado o menu lateral aberto em tela cheia, então só o gatilho flutuante (que vira X) aparece para fechá-lo, sem outro
  botão de fechar por baixo.
- Dado o gatilho do menu, então leitores de tela sabem se o menu está aberto ou fechado.

## 6. Requisitos Funcionais

- RF-4301: a pílula "Levantar mão" e o grupo PiP / Tela Cheia ficam num mesmo contêiner de linha, com espaço mínimo de
  8 px entre eles; a pílula encolhe (com reticências no texto) antes de encostar no grupo.
- RF-4302: com espaço sobrando, a pílula fica centralizada na largura do vídeo, como hoje.
- RF-4303: em larguras de até 400 px, a pílula ativa mostra "Abaixar mão" no lugar de "Mão levantada (abaixar)" e usa
  padding lateral de 16 px; o nome acessível ("Levantar mão" / "Abaixar mão") não muda.
- RF-4304: a área vazia da barra não captura cliques; tocar no vídeo fora dos controles continua chegando ao vídeo.
- RF-4305: o cabeçalho da sidebar em tela cheia não tem botão de fechar; o menu fecha pelo gatilho flutuante, pelo
  fundo escurecido e pelos botões que já o fecham hoje.
- RF-4306: o gatilho flutuante expõe `aria-expanded` e `aria-controls` (sidebar) e tem rótulo coerente com o estado:
  "Abrir menu da transmissão" (fechado) e "Fechar menu da transmissão" (aberto).
- RF-4307: o título do cabeçalho da sidebar não fica por baixo do gatilho flutuante.

## 7. Requisitos Não Funcionais

- RNF-4301 — acessibilidade: alvos de toque mantidos (pílula 52 px de altura, gatilho 44 px, botões do grupo 40 px).
- RNF-4302 — regressão: testes existentes do `Room` e o e2e do aluno (A10, A15) continuam verdes.
- RNF-4303 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| retrato 320–390 px, pílula normal | pílula e grupo lado a lado, ≥ 8 px de espaço |
| retrato 320–390 px, pílula ativa | rótulo "Abaixar mão", ≥ 8 px de espaço |
| desktop 1280 px | pílula centralizada no vídeo, rótulos atuais |
| tela cheia, menu fechado | gatilho ☰ com `aria-expanded="false"` e rótulo "Abrir menu da transmissão" |
| tela cheia, menu aberto | só o gatilho X, `aria-expanded="true"`, rótulo "Fechar menu da transmissão" |

## 9. Edge Cases

- Largura menor que pílula + grupo: a pílula encolhe com reticências; o grupo nunca encolhe.
- Chat ou Arquivos abertos em tela cheia: o gatilho já some (comportamento atual) e os drawers mantêm seus X.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- `npm test` e `npm run lint` em `apps/web` verdes, com testes novos de estrutura da barra, do rótulo curto e do X
  único com `aria-expanded`.
- Verificação visual em 320, 360 e 390 px (retrato), paisagem em tela cheia com o menu aberto e desktop 1280 px.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4301 a C-4303).
