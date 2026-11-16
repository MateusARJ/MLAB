# MLab Design System 2.0

> Fonte única da identidade visual do MLab. Vale para o app do professor (`apps/desktop`) e para a página do aluno (`apps/web`).
> Código: `packages/ui` (`src/styles/tokens.css`, `src/styles/components.css`, `src/tokens.ts`, componentes React).
> Substitui a especificação anterior ("Carbon Aligned").

## 1. Princípios

1. **O conteúdo é a área mais clara da tela.** A interface recua. O palco do vídeo usa sempre o tom mais escuro (`--stage`), inclusive no tema claro.
2. **Legível do fundo do laboratório.** Fonte de alta legibilidade embutida, texto de interface a partir de 13 px, contraste WCAG AA.
3. **Estado sempre visível, sempre em texto.** Ao vivo, gravando, pausado, conectando: ponto ou ícone + rótulo, nunca só cor.
4. **Uma cor, um significado.** Azul é ação. Verde é "no ar". Vermelho é gravação, mudo ou ação destrutiva. Não há amarelo na interface: mão levantada, pausa e "aguardando" usam o azul de destaque. A única exceção é a barra flutuante de marcação fora do MLab, que fica amarela quando um aluno levanta a mão (017).
5. **Teclado, mouse e toque têm o mesmo poder.** Foco visível em tudo (`:focus-visible` global), alvos de 40 px, nenhum controle que só apareça no hover.
6. **Offline por definição.** Fontes e ícones vão dentro do app.
7. **Zero emojis.** Ícones são SVG do conjunto Lucide, reexportados por `@mlab/ui`.

## 2. Temas

Dois temas, claro e escuro, definidos por `data-theme` no `<html>`. `@mlab/ui` aplica o tema ao carregar (`initTheme`): o que o usuário escolheu (salvo em `localStorage`, chave `mlab-theme`) ou, na falta, o do sistema operacional. O componente `ThemeToggle` alterna.

Tudo que fica **sobre o palco do vídeo** (controles do player, avisos, barra de marcação) usa a classe `ml-on-stage`, que fixa os valores escuros dos tokens.

## 3. Tokens de cor

Nunca use hexadecimal em tela ou componente. Use `var(--token)` no CSS ou `colors.*` de `@mlab/ui` no estilo inline. Faltou um token? Crie em `tokens.css`.

| Token CSS | `colors.*` (legado) | Uso | Escuro | Claro |
|---|---|---|---|---|
| `--bg` | `bgBase` | Fundo da aplicação | `#14171C` | `#F4F5F7` |
| `--surface-1` | `surfaceCard`, `surfaceCardSolid`, `surfaceInput` | Painéis, cabeçalho, campos | `#1C2027` | `#FFFFFF` |
| `--surface-2` | `surfaceHover` | Hover, item selecionado, chips | `#252A33` | `#ECEEF2` |
| `--surface-float` | `surfaceFloat` | Popover, toast, diálogo | `#2B313B` | `#FFFFFF` |
| `--stage` | `stage` | Moldura do vídeo | `#0E1013` | `#1B1F25` |
| `--border-subtle` | `borderSubtle` | Divisórias | `#3A414D` | `#DCE0E6` |
| `--border-strong` | `borderStrong`, `borderInteractive` | Contorno de campos e botões secundários (≥ 3:1) | `#6E7785` | `#7F8896` |
| `--text-1` / `--text-2` / `--text-3` | `textPrimary` / `textSecondary` / `textMuted` | Texto principal, secundário, metadados | `#ECEFF3` / `#AEB5C0` / `#8A93A0` | `#151920` / `#464E5A` / `#5E6672` |
| `--accent` | `accent` | Link, ícone e aba ativos | `#4C8DFF` | `#1A5FD6` |
| `--accent-fill` | `primary` | Fundo do botão primário | `#2F6BDE` | `#1A5FD6` |
| `--attention` / `--attention-soft` | `warning`, `warningSoft` | Mão levantada, pausa, aguardando | `#4C8DFF` / azul 16% | `#1A5FD6` / `#ECEEF2` |
| `--live` | `success` | Ao vivo, enviado | `#3CC07E` | `#127A47` |
| `--rec`, `--danger` | `rec`, `danger`, `dangerText` | Gravando, mudo, erro, encerrar | `#F0555A` | `#C9282E` |
| `--focus` | `focusRing` | Anel de foco | `#8DB6FF` | `#1A5FD6` |

Há ainda as variantes `*-soft` (fundos translúcidos) e `--on-*` (texto sobre preenchimento).

**Atenção:** `colors.*` devolve `var(--…)`. Não serve para `<canvas>` nem para concatenar transparência. As cores de marcação sobre a tela continuam em hexadecimal fixo, porque desenham sobre o conteúdo do professor.

## 4. Tipografia

**Atkinson Hyperlegible Next** (interface) e **Atkinson Hyperlegible Mono** (links, IPs, matrículas, cronômetros), licença SIL OFL, embutidas em `packages/ui/src/styles/fonts` (cerca de 70 KB). A família foi desenhada para baixa visão: I, l e 1; O e 0; rn e m são deliberadamente diferentes.

| Token | Tamanho | Uso |
|---|---|---|
| `--fs-display` | 33 px | Título da tela de entrada |
| `--fs-title` | 23 px | Título de página, telas de estado |
| `--fs-lead` | 19 px | Título de seção e de painel |
| `--fs-body` | 16 px | Texto corrido, chat, campos |
| `--fs-small` | 14 px | Rótulos, botões, abas |
| `--fs-caption` | 13 px | Metadados. Mínimo para texto de interface |

Pesos: 400, 600 e 700 (a família não tem 500). Sem caixa alta em rótulos novos.

Exceção documentada: as letras de atalho dentro dos botões da barra de marcação usam 10 px, porque são um reforço do `title` e precisam caber no botão.

## 5. Espaço, forma e movimento

- Espaço em múltiplos de 4 px (`--sp-1` … `--sp-8`).
- Raio por hierarquia: `--r-control` 6 px (botões, campos), `--r-panel` 10 px (cartões, painéis), `--r-pill` (status, contadores, avatares).
- Sombra só no que flutua (`--shadow-float`). Painéis fixos usam borda.
- Alvos: 40 px (botões), 44 px (campos e abas).
- Movimento só em resposta a ações; `prefers-reduced-motion` zera as durações.

## 6. Componentes (`@mlab/ui`)

| Componente | Observações |
|---|---|
| `Button` | Variantes `primary`, `secondary`, `ghost`, `danger`, `danger-ghost`; `success` é mapeado para `primary`. Tamanhos `sm` 32, `md` 40, `lg` 48. Um primário por tela. |
| `IconButton` | Sempre com `aria-label` e `title`. |
| `TextInput` | Rótulo sempre visível; `helperText` e `error` ligados por `aria-describedby`; `readOnly` vira campo de valor em fonte mono. |
| `StatusBadge` | Ponto + texto. Estados `live`, `paused`, `waiting`, `error`, `info`, `neutral`. |
| `Alert` | Barra de cor à esquerda; `role="alert"`. |
| `Card` | Superfície com borda, sem sombra nem blur. |
| `BrandMark` | Símbolo do MLab (colchetes + cursor), em SVG, para uso em interface. |
| `ThemeToggle`, `useTheme` | Alterna e lê o tema. |
| Ícones | Lucide, reexportados com os nomes que as telas já usavam (`Screen`, `Microphone`, `Touch_1`…). |

Classes utilitárias de `components.css` (`ml-btn`, `ml-icon-btn`, `ml-status`, `ml-banner`, `ml-topbar`, `ml-brand`, `ml-hint`, `ml-on-stage`…) podem ser usadas direto em elementos simples.

## 7. Padrões de tela

- **Cabeçalho:** `BrandMark` + título curto à esquerda; estado; ações à direita. A ação destrutiva (Encerrar, Sair) fica sempre no fim.
- **Abas:** sublinhado azul na aba ativa. Escolhas curtas e exclusivas usam o controle segmentado.
- **Chat:** mensagens sem caixa; fundo só para mensagem privada (`--surface-2`) e fixada (`--accent-soft`).
- **Mão levantada:** azul. No tema escuro, o destaque dos alunos com mão levantada é azul translúcido (`--attention-soft`), como o botão de mão do menu de tela cheia do aluno; no tema claro, é o cinza dos campos de link (`--surface-2`). Posição na fila, contador e botão ativo usam `--accent-fill`.
- **Aula pausada (aluno):** o ícone gira devagar (4 s por volta), como na versão anterior; para quem pede menos movimento, fica parado.
- **Mudo:** microfone e som do PC desligados aparecem em vermelho suave, com o rótulo da ação que o botão executa.
- **Controles sobre o vídeo:** sempre visíveis, fundo escuro translúcido.

## 8. Vocabulário

| Use | Em vez de |
|---|---|
| Link direto | Link fixo (mDNS), link amigável |
| Link pelo IP | Link direto (IP da rede local) |
| Conectado, Conectando, Reconectando, Pausado | `connected`, `connecting`, `reconnecting`, `pausado` |
