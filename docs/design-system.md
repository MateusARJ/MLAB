# MLab Design System — Especificação Oficial (Carbon Aligned)

> **Diretriz Mandatória para Desenvolvedores e IAs:**
> Este documento define a identidade visual, padrões de componentes, tokens e regras de usabilidade do **MLab**. Qualquer nova tela, refatoração ou funcionalidade deve obrigatoriamente seguir as especificações e componentes aqui descritos para manter 100% de consistência estética e funcional.

---

## 1. Princípios de Design

1. **Foco no Conteúdo (Content-First):** O vídeo da transmissão ao vivo é o elemento central. Todos os controles, barras e chats devem ser minimalistas, discretos e recolhíveis (*retractable/auto-hide*).
2. **Zero Emojis:** É estritamente proibido o uso de emojis na interface visual. Toda representação gráfica deve utilizar exclusivamente os componentes de ícones SVG oficiais do **Carbon Design System** (`@carbon/icons-react`).
3. **Previsibilidade e Hierarquia:** Cada tela possui no máximo uma ação primária clara. Ações destrutivas ou de saída utilizam sempre a variante de perigo (*danger*).
4. **Fluidez e Responsividade:** Transições suaves entre estados (expandir/recolher sidebar, mutar/desmutar microfone, alternar tela cheia).
5. **Acessibilidade e Alto Contraste:** Textos nítidos sobre fundo escuro com contraste mínimo de 4.5:1 (WCAG AA).

---

## 2. Paleta de Cores e Tokens CSS

As cores do MLab combinam a seriedade corporativa do Carbon Design System com o tom moderno da marca.

```css
:root {
  /* Marca e Ações Primárias (MLab Blue) */
  --mlab-primary: #0284c7;             /* Botões primários, links ativos */
  --mlab-primary-hover: #0369a1;       /* Hover de botão primário */
  --mlab-primary-active: #075985;      /* Clique / ativo */
  --mlab-accent: #38bdf8;              /* Títulos, realces, ícones de destaque */
  --mlab-primary-soft: rgba(2, 132, 199, 0.15); /* Fundos selecionados, alertas info */

  /* Ações Negativas e Alertas Críticos (Danger Red) */
  --mlab-danger: #ef4444;              /* Encerrar aula, cancelar, sair */
  --mlab-danger-hover: #dc2626;        /* Hover destrutivo */
  --mlab-danger-soft: rgba(239, 68, 68, 0.15); /* Banners de erro */
  --mlab-danger-text: #fca5a5;         /* Texto sobre fundo soft */

  /* Estados Semânticos */
  --mlab-success: #16a34a;             /* Transmissão Ao Vivo, sucesso */
  --mlab-success-soft: rgba(22, 163, 74, 0.15);
  --mlab-warning: #eab308;             /* Aula pausada, aguardando início */
  --mlab-warning-soft: rgba(234, 179, 8, 0.15);
  --mlab-warning-text: #fde047;

  /* Superfícies e Fundos (Dark Theme) */
  --mlab-bg-base: #0f172a;             /* Fundo geral da aplicação (Slate 900) */
  --mlab-surface-card: #1e293b;        /* Cards, cabeçalhos, sidebars (Slate 800) */
  --mlab-surface-input: #0f172a;       /* Fundo de campos de digitação */
  --mlab-surface-hover: #334155;       /* Hover em itens de lista / botões ghost */

  /* Bordas e Divisores */
  --mlab-border-subtle: rgba(255, 255, 255, 0.1); /* Bordas de cards e modais */
  --mlab-border-strong: #334155;       /* Bordas de inputs e caixas */
  --mlab-border-interactive: #475569;  /* Bordas de botões secundários */
  --mlab-focus-ring: #38bdf8;          /* Anel de foco para acessibilidade */

  /* Tipografia e Textos */
  --mlab-text-primary: #f8fafc;        /* Títulos e valores principais */
  --mlab-text-secondary: #cbd5e1;      /* Rótulos e textos explicativos */
  --mlab-text-muted: #94a3b8;          /* Metadados, timestamps, placeholders */

  /* Raios de Borda (Modern Rounded) */
  --mlab-radius-sm: 4px;               /* Badges, tags pequenas */
  --mlab-radius-md: 8px;               /* Botões, inputs, abas */
  --mlab-radius-lg: 16px;              /* Cards, painéis, modais */
  --mlab-radius-full: 9999px;          /* Pílulas de status */
}
```

---

## 3. Tipografia

- **Família Tipográfica:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- **Títulos:**
  - `Display / Logo`: 24px, peso 700, cor `--mlab-accent`.
  - `Card Title`: 20px, peso 700, cor `--mlab-text-primary`.
  - `Section / Tool Header`: 16px, peso 600, cor `--mlab-text-primary`.
- **Corpo:**
  - `Body Standard`: 14px, peso 400 ou 500, line-height 1.5, cor `--mlab-text-primary`.
  - `Label / Form`: 13px, peso 500, cor `--mlab-text-secondary`.
  - `Caption / Timestamp`: 12px, peso 400, cor `--mlab-text-muted`.

---

## 4. Mapeamento Mandatório de Ícones (Carbon Icons)

**NUNCA** utilize emojis na interface. Use os seguintes ícones do `@carbon/icons-react`:

| Contexto / Função | Ícone Carbon | Tamanho Padrão |
|---|---|---|
| Transmissão de Tela / Modo Tela Cheia | `<Screen size={20} />` | 16px ou 20px |
| Captura de Janela / Aba | `<Application size={20} />` | 16px ou 20px |
| Microfone Ativado (Falando) | `<Microphone size={18} />` | 16px ou 18px |
| Microfone Mudo (Desativado) | `<MicrophoneOff size={18} />` | 16px ou 18px |
| Gravação de Aula | `<Recording size={18} />` | 16px ou 18px |
| Chat Geral / Envio de Mensagem | `<Chat size={18} />` | 16px ou 18px |
| Dúvidas / Chat Privado | `<Locked size={16} />` | 16px |
| Lista de Alunos | `<UserMultiple size={18} />` | 18px |
| Pasta de Arquivos / Materiais | `<Folder size={18} />` | 18px |
| Anexar Arquivo / Upload | `<Attachment size={16} />` | 16px |
| Copiar Link | `<Copy size={16} />` | 16px |
| Sucesso / Confirmado | `<Checkmark size={16} />` | 16px |
| Configurações / Trocar Fonte | `<Settings size={18} />` | 18px |
| Atualizar / Recarregar Janelas | `<Renew size={16} />` | 16px |
| Iniciar / Transmitir | `<Play size={18} />` | 18px |
| Encerrar Transmissão / Sair | `<Exit size={18} />` | 18px |
| Fechar Painel / Cancelar | `<Close size={18} />` | 16px ou 18px |
| Tela Cheia (Player do Aluno) | `<Maximize size={18} />` | 18px |
| Janela Flutuante (PiP) | `<Popup size={18} />` | 18px |
| Alertas e Avisos | `<WarningAlt size={18} />` | 18px |

---

## 5. Padrões de Componentes

### 5.1 Botões (`Button` & `IconButton`)

1. **`primary`:** Ação principal da tela (ex: "Iniciar Transmissão", "Assistir Aula", "Criar Sala").
   - Fundo: `--mlab-primary`, Texto: Branco, Padding: `12px 20px`, Radius: `8px`.
2. **`secondary`:** Ações complementares (ex: "Apenas Transmitir", "Atualizar Janelas").
   - Borda: `1px solid --mlab-border-interactive`, Fundo: transparente, Hover: `--mlab-surface-card`.
3. **`danger`:** Ações irreversíveis ou destrutivas (ex: "Encerrar Transmissão", "Sair da Sala").
   - Fundo: `--mlab-danger`, Hover: `--mlab-danger-hover`, Texto: Branco.
4. **`danger-ghost`:** Ação destrutiva discreta (ex: Sair no topo).
   - Sem fundo, cor `--mlab-danger`, hover `--mlab-danger-soft`.
5. **`ghost`:** Ícones de utilidade sem fundo (ex: botão de fechar sidebar, maximizar).
   - Borda: nenhuma, hover: `--mlab-surface-hover`.

### 5.2 Entradas de Texto (`TextInput`)
- Fundo: `--mlab-surface-input` (`#0f172a`).
- Borda: `1px solid --mlab-border-strong` (`#334155`).
- Foco: `1px solid --mlab-focus-ring` com `box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2)`.
- Rótulo superior sempre visível e legível em `--mlab-text-secondary`.

### 5.3 Badges e Indicadores de Status
- Formato pílula (*rounded pill*), fonte 12px, peso 600.
- **Ao Vivo:** dot verde pulsante (`#16a34a`) com texto "AO VIVO".
- **Pausado:** dot amarelo (`#eab308`) com texto "PAUSADO".
- **Resolução:** fundo sutil neutro, texto "1080p @ 30fps" ou "1080p @ 60fps".

### 5.4 Sidebar Retrátil
- Painel lateral fixo à direita com largura de 340px a 380px (ou 100% no mobile).
- Backdrop blur sutil (`backdrop-filter: blur(16px)`).
- Abas superiores no estilo Carbon Tabs (Chat Público, Dúvidas Privadas, Arquivos).
- Auto-hide quando o usuário clica na área de vídeo ou aciona a tecla Esc.

---

## 6. Regras de Consistência para Novas Telas e Features

1. **Importação:** Sempre que for renderizar um botão, input, badge ou card, verifique ou reutilize os componentes centralizados em `@mlab/ui` ou siga estritamente os tokens acima.
2. **Identidade da Logo:**
   - Tela de Entrada do Aluno (`Join.tsx`): Logo com 76px de altura/largura.
   - Tela de Identificação do Professor (`ProfessorEntry.tsx`): Logo com 96px de altura/largura.
   - Topbar da Transmissão e Dashboard: Logo com 46px de altura/largura alinhada à esquerda do título.
3. **Não alteração de regras de negócio:** A modernização da UI/UX não altera nenhum contrato WebRTC, endpoints do backend Go, autenticação JWT ou política de sincronização de turmas.
