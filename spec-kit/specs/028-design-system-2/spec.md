# Spec: Design System 2.0 com Tema Claro e Escuro

Status: READY
Feature ID: `028-design-system-2`
Origem: issue #92. Inclui a correção da issue #89. Emenda os rótulos da US-09 da `001-screen-share-core` e os
RF-2501, RF-2503 e RF-2504 da `025-favicon-web`.

## 1. Objetivo

Trocar a aparência do MLab (app do professor, web dos alunos e `packages/ui`) por um design system próprio,
minimalista e legível, com tema claro e escuro, sem mudar o que o MLab faz.

## 2. Contexto

Verificado em 2026-11-14 na `development` @ `7bb2499` (1.15.0):

- `packages/ui/src/tokens.ts` tem cores fixas de um único tema escuro; os componentes tratam hover e foco em
  JavaScript, com `style` inline.
- As páginas (`apps/desktop/src/renderer/pages/*.tsx`, `apps/web/src/pages/*.tsx`) repetem cores e tamanhos fixos.
- Os ícones vêm de `@carbon/icons-react`; a fonte é a do sistema.
- O amarelo é usado para aviso, mão levantada e destaques diferentes.
- O favicon da web (feature 025) é um desenho próprio, diferente da marca do cabeçalho.
- A barra de marcação dentro da sala (`Room.tsx`) é cortada quando a prévia é mais baixa que ela (issue #89).

O responsável aprovou um protótipo em HTML (2026-11-13) e pediu que as telas fiquem iguais a ele, mantendo só as
funcionalidades e decisões das specs.

## 3. Escopo

### Incluído

- Tokens, temas, tipografia, ícones e componentes base em `packages/ui`.
- Telas do professor: identificação, preparo da aula (duas etapas) e sala ao vivo.
- Telas do aluno: entrada e sala.
- Favicon da web com a logo do cabeçalho.
- Barra de marcação interna sempre dentro da prévia (#89).
- `docs/design-system.md` e `README.md`.

### Não incluído

- Backend, processo principal do Electron, preload, hooks, serviços, `packages/types` e contratos.
- Barra flutuante de marcação fora do MLab (`FloatingAnnotationOverlay.tsx`).
- Funcionalidades do protótipo que não estão nas specs (QR code, zoom do aluno, fixar janela e outras).
- Issues #90 (aviso de mão levantada) e #91 (fixar janela).

## 4. Atores

- **Professor:** usa o app desktop para preparar e transmitir a aula.
- **Aluno:** entra pelo navegador, no computador ou no celular.

## 5. User Stories

### US-2801 — Interface legível em tema claro ou escuro

Como professor ou aluno, quero escolher entre tema claro e escuro e ler a interface com conforto, para usar o MLab em
sala clara, com projetor ou à noite.

- Dado que abro o MLab pela primeira vez, então o tema segue o do sistema operacional.
- Dado que clico no botão de sol/lua, então o tema troca na hora e a escolha vale nas próximas aberturas neste
  computador.
- Dado que navego só com o teclado, então o elemento em foco tem contorno visível.

### US-2802 — Preparar a aula em duas etapas

Como professor, quero preparar a aula em passos curtos, para não me perder entre nome, links, tela, qualidade e
gravação.

- Dado que informei meu nome, então vejo "Preparar aula" com o nome da aula e como os alunos entram.
- Dado que criei a sala, então escolho o que transmitir, a qualidade e a gravação, e começo a transmissão.
- Dado que não mexi em nada, então a transmissão começa em 1080p 60 fps, sem gravação, com microfone e som do PC
  mudos.

### US-2803 — Controlar a aula ao vivo num só lugar

Como professor, quero os controles da transmissão juntos e o estado da aula sempre visível, para agir sem procurar.

- Dado que estou ao vivo, então vejo no cabeçalho o estado (No ar, Gravando, alunos, resolução) e os links.
- Dado que quero silenciar, pausar, trocar de tela, capturar ou gravar, então uso a barra de controles sob a prévia.
- Dado que abro a marcação numa janela baixa, então a barra de marcação aparece inteira dentro da prévia.

### US-2804 — Entrar e assistir à aula

Como aluno, quero entrar com nome e matrícula e assistir com os controles à vista.

- Dado que abri o link, então vejo "Nome completo", "Matrícula" e "Entrar na aula".
- Dado que estou na sala, então vejo o estado da conexão, o botão de levantar a mão e os botões de janela flutuante e
  tela cheia.
- Dado que o professor pausou, então vejo o aviso de pausa com o ícone girando.
- Dado que olho a aba do navegador, então o ícone é a logo do MLab usada no cabeçalho.

## 6. Requisitos Funcionais

- RF-2801: `packages/ui` define tokens semânticos de cor, tipografia, espaço e raio em CSS
  (`styles/tokens.css`), com valores para tema escuro e claro, selecionados por `data-theme` no `<html>`. `tokens.ts`
  mantém os nomes exportados (`colors`, `radii`, `typography`), apontando para os tokens.
- RF-2802: o tema inicial é o salvo neste dispositivo (`localStorage`, chave `mlab-theme`) ou, sem escolha salva, o do
  sistema. Um botão de sol/lua (`ThemeToggle`) alterna o tema e salva a escolha. Presente nas telas do professor e do
  aluno.
- RF-2803: a fonte da interface é a Atkinson Hyperlegible Next (texto) e Mono (códigos e links), embutida em
  `packages/ui` como `woff2`, sem requisição à internet.
- RF-2804: os ícones vêm de `lucide-react`, reexportados por `@mlab/ui` com os mesmos nomes usados hoje pelos apps.
  `@carbon/icons-react` sai do projeto.
- RF-2805: os componentes base (`Button`, `IconButton`, `TextInput`, `StatusBadge`, `Alert`, `Card`) mantêm as props
  atuais e passam a ter hover, foco visível, pressionado e desabilitado em CSS (`styles/components.css`).
- RF-2806: o cabeçalho do professor e do aluno mostra a logo do MLab sem o nome (`BrandMark`).
- RF-2807: a interface não usa amarelo. O estado de atenção (mão levantada, avisos) usa azul no tema escuro e cinza
  no tema claro. Exceção: a barra flutuante de marcação fora do MLab, que não muda nesta feature.
- RF-2808: a identificação do professor pergunta "Como a turma vai ver seu nome?", com o campo "Seu nome" e o botão
  "Continuar".
- RF-2809: a etapa 1 de "Preparar aula" tem o campo "Nome da aula" e o painel "Como os alunos entram", com
  "Link direto" (endereço `mlab.local:8080`) e "Link pelo IP". A ação principal é "Criar sala e gerar link" e, com a
  sala criada, "Continuar".
- RF-2810: a etapa 2 tem "O que transmitir" ("Tela inteira" ou "Janelas escolhidas"), "Qualidade" (1080p 30 fps e
  1080p 60 fps) e "Gravação" (liga/desliga, formato `.webm`). A ação principal é "Começar transmissão". Padrões:
  1080p 60 fps, gravação desligada, microfone e som do PC mudos.
- RF-2811: a sala ao vivo tem: cabeçalho com estado da aula, links e "Encerrar transmissão"; prévia com o rótulo do
  que a turma vê; barra de controles (Microfone, Som do PC, Trocar tela, Monitor, Pausar, Print, gravação, Painel);
  painel lateral com as abas Turma, Chat, Dúvidas e Arquivos.
- RF-2812: a entrada do aluno tem os campos "Nome completo" e "Matrícula" e o botão "Entrar na aula"; as mensagens
  de erro atuais (inclusive a da matrícula já conectada, RF-2706) continuam.
- RF-2813: a sala do aluno mostra o estado da conexão por texto e ícone, o botão de levantar a mão, os botões de
  janela flutuante e tela cheia sempre visíveis, e as abas do painel. Com a aula pausada, o ícone do aviso gira.
- RF-2814: o favicon da web dos alunos é a logo do cabeçalho sobre um quadrado escuro arredondado, em
  `favicon-32.png` (32×32) e `apple-touch-icon.png` (180×180, opaco). O `favicon.svg` da 025 é excluído e
  `index.html` deixa de citá-lo.
- RF-2815: a barra de marcação dentro da sala fica inteira dentro da prévia ao abrir, ao arrastar e ao redimensionar
  a janela. Se a prévia for mais baixa que a barra, a barra ganha rolagem interna e nenhum botão fica inacessível
  (issue #89).
- RF-2816: `docs/design-system.md` descreve o design system 2.0 e o `README.md` deixa de citar Carbon.

## 7. Requisitos Não Funcionais

- RNF-2801 — comportamento: nenhuma funcionalidade é removida ou acrescentada. Hooks, serviços, IPC, contratos e
  backend não mudam. A única lógica alterada é a posição da barra de marcação (RF-2815).
- RNF-2802 — legibilidade: texto de interface a partir de 13 px; pares texto/fundo dos tokens com contraste WCAG AA.
- RNF-2803 — offline: fontes e ícones vão no pacote; nenhuma requisição externa (ADR 0005).
- RNF-2804 — dependências: entra `lucide-react`; sai `@carbon/icons-react`. Nenhuma outra.
- RNF-2805 — testes: as suítes do desktop e da web continuam verdes; os testes mudam só onde citam rótulos, papéis
  ou o favicon.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| sem tema salvo | segue `prefers-color-scheme`; sem suporte, tema escuro |
| `localStorage` indisponível | o tema vale só para a sessão |
| aluno com a mão levantada | destaque azul (escuro) ou cinza (claro), com ícone |
| aula pausada (aluno) | aviso com ícone girando |
| prévia mais baixa que a barra de marcação | barra com rolagem interna, dentro da prévia |

## 9. Edge Cases

- `prefers-reduced-motion`: as animações decorativas param; o estado continua indicado por texto.
- Cache do favicon: pode exigir recarregar sem cache para ver o ícone novo.
- Barra de marcação arrastada e depois a janela diminui: a barra volta para dentro da prévia.
- Barra flutuante fora do MLab: mantém as cores atuais (os testes dela fixam cor e geometria).

## 10. Dados/Contratos impactados

- Nenhum contrato. `001-screen-share-core/spec.md` (US-09) e `025-favicon-web/spec.md` recebem nota de emenda.

## 11. Critérios de Sucesso

- `npm run test -w apps/desktop` e `npm run test -w apps/web` verdes.
- `npm run lint` e `npm run build` verdes.
- Busca por `@carbon` em `apps/` e `packages/` sem resultado.
- Teste do favicon: PNGs 32×32 e 180×180, sem `favicon.svg`.
- Teste da barra de marcação: posição limitada à prévia.
- Validação manual do responsável no Windows, em tema claro e escuro.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-2801 a C-2809).
