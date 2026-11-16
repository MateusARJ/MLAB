// @vitest-environment jsdom
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FloatingAnnotationOverlay,
  computeToolbarDockZone,
  computeExpandedToolbarPos,
  clampToolbarPos,
} from './FloatingAnnotationOverlay';

describe('FloatingAnnotationOverlay Component & Adaptive Orientation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      window.sessionStorage?.clear();
    } catch {}
    window.electronAPI = {
      ...window.electronAPI,
      syncAnnotationState: vi.fn().mockResolvedValue(undefined),
      setAnnotationOverlayIgnoreMouse: vi.fn().mockResolvedValue(undefined),
      onAnnotationStateSync: vi.fn().mockReturnValue(() => {}),
      onCursorState: vi.fn().mockReturnValue(() => {}),
      onAnnotationShortcutCommand: vi.fn().mockReturnValue(() => {}),
      setAnnotationToolbarRect: vi.fn().mockResolvedValue(undefined),
    } as any;
  });

  describe('computeToolbarDockZone', () => {
    it('deve classificar como top quando pos.y estiver na zona superior', () => {
      expect(computeToolbarDockZone({ x: 300, y: 50 }, 1920, 1080)).toBe('top');
      expect(computeToolbarDockZone({ x: 1000, y: 150 }, 1920, 1080)).toBe('top');
    });

    it('deve classificar como bottom quando pos.y estiver na zona inferior', () => {
      expect(computeToolbarDockZone({ x: 400, y: 950 }, 1920, 1080)).toBe('bottom');
      expect(computeToolbarDockZone({ x: 1200, y: 1000 }, 1920, 1080)).toBe('bottom');
    });

    it('deve classificar como left quando nas laterais à esquerda e right à direita', () => {
      expect(computeToolbarDockZone({ x: 100, y: 400 }, 1920, 1080)).toBe('left');
      expect(computeToolbarDockZone({ x: 1500, y: 400 }, 1920, 1080)).toBe('right');
    });
  });

  describe('FloatingAnnotationOverlay Lifecycle & Minimization', () => {
    it('deve renderizar a barra flutuante externa adaptativa e permitir minimizar e expandir', () => {
      render(<FloatingAnnotationOverlay />);

      const toolbar = screen.getByTestId('external-floating-toolbar');
      expect(toolbar).toBeInTheDocument();

      const minimizeBtn = screen.getByTestId('external-collapse-btn');
      expect(minimizeBtn).toBeInTheDocument();

      fireEvent.click(minimizeBtn);

      // Após minimizar, o botão compacto aparece
      expect(screen.getByTestId('external-collapsed-btn')).toBeInTheDocument();
      expect(window.electronAPI.syncAnnotationState).toHaveBeenCalledWith(
        expect.objectContaining({ collapsed: true })
      );

      // Clicar no botão compacto re-expande a barra
      fireEvent.click(screen.getByTestId('external-collapsed-btn'));
      expect(screen.getByTestId('external-floating-toolbar')).toBeInTheDocument();
      expect(window.electronAPI.syncAnnotationState).toHaveBeenCalledWith(
        expect.objectContaining({ collapsed: false })
      );
    });

    it('deve adaptar orientação para horizontal quando posicionado na parte superior/inferior e vertical nas laterais', () => {
      let stateSyncCb: (state: any) => void = () => {};
      window.electronAPI.onAnnotationStateSync = vi.fn().mockImplementation((cb) => {
        stateSyncCb = cb;
        return () => {};
      });

      render(<FloatingAnnotationOverlay />);

      const toolbar = screen.getByTestId('external-floating-toolbar');

      // Simula sincronização de posição no topo da tela (y <= 20% da tela)
      act(() => {
        stateSyncCb({
          activeTool: 'pen',
          strokeColor: '#ef4444',
          strokeSize: 4,
          strokes: [],
          redoStrokes: [],
          activeStroke: null,
          spotlight: { enabled: false, x: 0.5, y: 0.5, radius: 0.14, zoom: 1, activeInViewer: false },
          collapsed: false,
          toolbarPos: { x: 400, y: 50 },
        });
      });

      expect(toolbar).toHaveAttribute('data-orientation', 'horizontal');
      expect(toolbar).toHaveAttribute('data-dock-zone', 'top');

      // Simula sincronização de posição na lateral esquerda
      act(() => {
        stateSyncCb({
          activeTool: 'pen',
          strokeColor: '#ef4444',
          strokeSize: 4,
          strokes: [],
          redoStrokes: [],
          activeStroke: null,
          spotlight: { enabled: false, x: 0.5, y: 0.5, radius: 0.14, zoom: 1, activeInViewer: false },
          collapsed: false,
          toolbarPos: { x: 30, y: 350 },
        });
      });

      expect(toolbar).toHaveAttribute('data-orientation', 'vertical');
      expect(toolbar).toHaveAttribute('data-dock-zone', 'left');
    });

    it('deve ocultar a barra móvel externa quando o MLab estiver em foco e mantê-la visível fora do MLab', () => {
      let cursorStateCb: (state: any) => void = () => {};
      window.electronAPI.onCursorState = vi.fn().mockImplementation((cb) => {
        cursorStateCb = cb;
        return () => {};
      });

      const { container } = render(<FloatingAnnotationOverlay />);

      const toolbar = screen.getByTestId('external-floating-toolbar');
      const canvas = container.querySelector('canvas')!;
      expect(canvas).toBeInTheDocument();

      // Inicialmente fora do MLab: toolbar visível
      expect(toolbar).toHaveStyle({ opacity: '1', pointerEvents: 'auto' });
      expect(canvas).toHaveStyle({ pointerEvents: 'none' });

      // Cursor entra no MLab com foco: toolbar externa oculta sem duplicidade, canvas preservado
      act(() => {
        cursorStateCb({
          visible: false,
          x: 0.5,
          y: 0.5,
          mlabFocused: true,
        });
      });

      expect(toolbar).toHaveStyle({ opacity: '0', pointerEvents: 'none' });

      // Cursor sai do MLab: toolbar externa reaparece imediatamente
      act(() => {
        cursorStateCb({
          visible: true,
          x: 0.2,
          y: 0.2,
          mlabFocused: false,
        });
      });

      expect(toolbar).toHaveStyle({ opacity: '1', pointerEvents: 'auto' });
    });

    it('deve garantir exclusividade mútua estrita entre ferramentas de desenho, Lupa e menu de paleta', () => {
      render(<FloatingAnnotationOverlay />);

      const penBtn = screen.getByTestId('external-tool-pen');
      const spotlightBtn = screen.getByTestId('external-tool-spotlight');
      const highlighterBtn = screen.getByTestId('external-tool-highlighter');
      const paletteBtn = screen.getByTestId('external-tool-palette');

      // 1. Clica no Pincel: Pincel ativo
      fireEvent.click(penBtn);
      expect(penBtn).toHaveStyle({ borderColor: '#38bdf8' });
      expect(spotlightBtn).toHaveStyle({ borderColor: 'transparent' });

      // 2. Clica na Lupa: Lupa fica ativa, Pincel desativa com exclusividade mútua
      fireEvent.click(spotlightBtn);
      expect(spotlightBtn).toHaveStyle({ borderColor: '#facc15' });
      expect(penBtn).toHaveStyle({ borderColor: 'transparent' });

      // 3. Clica no Marca-texto: Marca-texto fica ativo, Lupa desativa
      fireEvent.click(highlighterBtn);
      expect(highlighterBtn).toHaveStyle({ borderColor: '#38bdf8' });
      expect(spotlightBtn).toHaveStyle({ borderColor: 'transparent' });

      // 4. Clica na Paleta: abre o popover sem aplicar estilo de ferramenta ativa
      fireEvent.click(paletteBtn);
      expect(screen.getByTestId('external-palette-popover')).toBeInTheDocument();
      // O botão de paleta não deve ter a cor ciano da ferramenta de desenho
      expect(paletteBtn).not.toHaveStyle({ borderColor: '#38bdf8' });
      // Clicar no Pincel fecha a paleta automaticamente
      fireEvent.click(penBtn);
      expect(screen.queryByTestId('external-palette-popover')).not.toBeInTheDocument();
    });

    it('deve alternar a Lupa ao receber 2 cliques rápidos na tecla Ctrl (Double-tap Ctrl)', () => {
      render(<FloatingAnnotationOverlay />);

      const spotlightBtn = screen.getByTestId('external-tool-spotlight');
      expect(spotlightBtn).toHaveStyle({ borderColor: 'transparent' });

      // Duplo clique na tecla Control
      fireEvent.keyDown(window, { key: 'Control' });
      fireEvent.keyUp(window, { key: 'Control' });
      fireEvent.keyDown(window, { key: 'Control' });

      // Lupa deve estar ligada
      expect(spotlightBtn).toHaveStyle({ borderColor: '#facc15' });
      expect(window.electronAPI.syncAnnotationState).toHaveBeenCalledWith(
        expect.objectContaining({
          spotlight: expect.objectContaining({ enabled: true }),
        })
      );
    });

    it('deve responder aos comandos de atalho recebidos via onAnnotationShortcutCommand', () => {
      let shortcutCb: (cmd: any) => void = () => {};
      window.electronAPI.onAnnotationShortcutCommand = vi.fn().mockImplementation((cb) => {
        shortcutCb = cb;
        return () => {};
      });

      render(<FloatingAnnotationOverlay />);

      const penBtn = screen.getByTestId('external-tool-pen');
      const spotlightBtn = screen.getByTestId('external-tool-spotlight');

      // Comando tool-pen via atalho IPC
      act(() => {
        shortcutCb('tool-pen');
      });
      expect(penBtn).toHaveStyle({ borderColor: '#38bdf8' });
      expect(spotlightBtn).toHaveStyle({ borderColor: 'transparent' });

      // Comando toggle-spotlight via atalho IPC
      act(() => {
        shortcutCb('toggle-spotlight');
      });
      expect(spotlightBtn).toHaveStyle({ borderColor: '#facc15' });
      expect(penBtn).toHaveStyle({ borderColor: 'transparent' });
    });
  });

  describe('Retângulo da barra para o hit-test do Linux (009/RF-902, C-903)', () => {
    // jsdom não tem layout: simula o tamanho da barra (expandida/recolhida) e do popover de cores.
    function mockLayout() {
      return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const testId = this.getAttribute('data-testid');
        const box = (left: number, top: number, width: number, height: number) =>
          ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
        if (testId === 'external-floating-toolbar') {
          const collapsed = this.getAttribute('data-collapsed') === 'true';
          return collapsed ? box(100, 20, 52, 52) : box(100, 20, 440, 54);
        }
        if (testId === 'external-palette-popover') return box(300, 80, 175, 200);
        return box(0, 0, 0, 0);
      });
    }

    const lastRect = () => {
      const calls = (window.electronAPI.setAnnotationToolbarRect as any).mock.calls;
      return calls[calls.length - 1]?.[0];
    };

    it('envia o retângulo inicial e atualiza ao recolher e expandir', () => {
      mockLayout();
      render(<FloatingAnnotationOverlay />);
      expect(lastRect()).toEqual({ x: 100, y: 20, width: 440, height: 54 });

      fireEvent.click(screen.getByTestId('external-collapse-btn'));
      expect(lastRect()).toEqual({ x: 100, y: 20, width: 52, height: 52 });

      fireEvent.click(screen.getByTestId('external-collapsed-btn'));
      expect(lastRect()).toEqual({ x: 100, y: 20, width: 440, height: 54 });
    });

    it('inclui o popover de cores aberto no retângulo', () => {
      mockLayout();
      render(<FloatingAnnotationOverlay />);
      fireEvent.click(screen.getByTestId('external-tool-palette'));
      expect(lastRect()).toEqual({ x: 100, y: 20, width: 440, height: 260 });

      fireEvent.click(screen.getByTestId('external-tool-pen'));
      expect(lastRect()).toEqual({ x: 100, y: 20, width: 440, height: 54 });
    });

    it('não reenvia o mesmo retângulo', () => {
      mockLayout();
      render(<FloatingAnnotationOverlay />);
      const before = (window.electronAPI.setAnnotationToolbarRect as any).mock.calls.length;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      fireEvent.click(screen.getByTestId('external-tool-pen'));
      expect((window.electronAPI.setAnnotationToolbarRect as any).mock.calls.length).toBe(before);
    });

    it('envia null com o MLab em foco e o retângulo de volta ao sair', () => {
      let cursorStateCb: (state: any) => void = () => {};
      window.electronAPI.onCursorState = vi.fn().mockImplementation((cb) => {
        cursorStateCb = cb;
        return () => {};
      });
      mockLayout();
      render(<FloatingAnnotationOverlay />);

      act(() => cursorStateCb({ visible: false, x: 0.5, y: 0.5, mlabFocused: true }));
      expect(lastRect()).toBeNull();

      act(() => cursorStateCb({ visible: true, x: 0.2, y: 0.2, mlabFocused: false }));
      expect(lastRect()).toEqual({ x: 100, y: 20, width: 440, height: 54 });
    });

    it('envia null ao desmontar', () => {
      mockLayout();
      const { unmount } = render(<FloatingAnnotationOverlay />);
      unmount();
      expect(lastRect()).toBeNull();
    });
  });

  describe('Mãos levantadas na barra (017/RF-171 a RF-178, RNF-172, RNF-173)', () => {
    let raisedHandsCb: (count: any) => void = () => {};
    const sendRaisedHands = (count: any) => act(() => raisedHandsCb(count));
    const toolbar = () => screen.getByTestId('external-floating-toolbar');
    const indicator = () => screen.queryByTestId('external-raised-hands');
    const badgeText = () => screen.getByTestId('external-raised-hands-badge').textContent;

    beforeEach(() => {
      raisedHandsCb = () => {};
      window.electronAPI.onAnnotationRaisedHands = vi.fn().mockImplementation((cb) => {
        raisedHandsCb = cb;
        return () => {};
      });
    });

    it('sem mãos levantadas, a barra fica igual à atual: sem indicador e com a borda normal (RF-175)', () => {
      render(<FloatingAnnotationOverlay />);
      expect(indicator()).toBeNull();
      expect(toolbar()).toHaveAttribute('data-raised-hands', '0');
      expect(toolbar()).toHaveStyle({ border: '1px solid #38bdf8', boxShadow: '0 10px 28px rgba(0, 0, 0, 0.72)' });

      sendRaisedHands(2);
      sendRaisedHands(0);
      expect(indicator()).toBeNull();
      expect(toolbar()).toHaveStyle({ border: '1px solid #38bdf8' });
    });

    it('mostra o número até 9 e 9+ a partir de 10, com a descrição usando o número real (RF-171, RF-173, RF-174)', () => {
      render(<FloatingAnnotationOverlay />);

      sendRaisedHands(1);
      expect(badgeText()).toBe('1');
      expect(screen.getByRole('img', { name: 'Mãos levantadas: 1' })).toHaveAttribute('title', 'Mãos levantadas: 1');

      sendRaisedHands(9);
      expect(badgeText()).toBe('9');

      sendRaisedHands(10);
      expect(badgeText()).toBe('9+');
      expect(screen.getByRole('img', { name: 'Mãos levantadas: 10' })).toBeInTheDocument();

      sendRaisedHands(23);
      expect(badgeText()).toBe('9+');
      expect(indicator()).toHaveAttribute('title', 'Mãos levantadas: 23');
      expect(toolbar()).toHaveAttribute('data-raised-hands', '23');

      // Nenhum texto visível sobre mãos levantadas: só o ícone e o número.
      expect(screen.queryByText(/m[ãa]os/i)).toBeNull();
    });

    it.each([
      ['horizontal (topo)', { x: 600, y: 20 }, 'horizontal'],
      ['vertical (esquerda)', { x: 20, y: 400 }, 'vertical'],
    ])('barra expandida %s: indicador dentro da barra e borda de destaque fixa (RF-171, RF-172)', (_n, pos, orientation) => {
      window.sessionStorage.setItem('mlab.floatingToolbarPos', JSON.stringify(pos));
      render(<FloatingAnnotationOverlay />);
      expect(toolbar()).toHaveAttribute('data-orientation', orientation);

      sendRaisedHands(3);
      expect(toolbar()).toContainElement(indicator());
      expect(toolbar()).toHaveStyle({
        border: '1px solid #facc15',
        boxShadow: '0 0 0 2px rgba(250, 204, 21, 0.55), 0 10px 28px rgba(0, 0, 0, 0.72)',
      });
      expect(toolbar().style.animation).toBe('');
      expect(indicator()!.style.animation).toBe('');
    });

    it('barra recolhida: indicador abaixo do botão e borda de destaque (RF-171, RF-172)', () => {
      render(<FloatingAnnotationOverlay />);
      fireEvent.click(screen.getByTestId('external-collapse-btn'));
      sendRaisedHands(4);

      expect(toolbar()).toHaveAttribute('data-collapsed', 'true');
      expect(toolbar()).toContainElement(indicator());
      expect(screen.getByTestId('external-collapsed-btn').nextElementSibling).toBe(indicator());
      expect(badgeText()).toBe('4');
      expect(toolbar()).toHaveStyle({ border: '1px solid #facc15' });
    });

    it('segue a visibilidade da barra e mostra a quantidade atual ao reaparecer (RF-178)', () => {
      let cursorStateCb: (state: any) => void = () => {};
      window.electronAPI.onCursorState = vi.fn().mockImplementation((cb) => {
        cursorStateCb = cb;
        return () => {};
      });
      render(<FloatingAnnotationOverlay />);
      sendRaisedHands(2);

      act(() => cursorStateCb({ visible: false, x: 0.5, y: 0.5, mlabFocused: true }));
      expect(toolbar()).toHaveStyle({ opacity: '0' });
      sendRaisedHands(5);

      act(() => cursorStateCb({ visible: true, x: 0.2, y: 0.2, mlabFocused: false }));
      expect(toolbar()).toHaveStyle({ opacity: '1' });
      expect(badgeText()).toBe('5');
    });

    it('clicar no indicador não troca ferramenta, não recolhe e não sincroniza estado (RF-177)', () => {
      render(<FloatingAnnotationOverlay />);
      sendRaisedHands(2);
      (window.electronAPI.syncAnnotationState as any).mockClear();

      fireEvent.pointerDown(indicator()!);
      fireEvent.mouseDown(indicator()!);
      fireEvent.click(indicator()!);

      // Trocar ferramenta ou recolher sempre sincroniza o estado; nada foi sincronizado.
      expect(window.electronAPI.syncAnnotationState).not.toHaveBeenCalled();
      expect(toolbar()).toHaveAttribute('data-collapsed', 'false');
    });

    it('ignora valores inválidos e mantém o último válido (RNF-172)', () => {
      render(<FloatingAnnotationOverlay />);
      sendRaisedHands(3);
      for (const invalid of [-1, 1.5, '4', Number.NaN, null]) {
        sendRaisedHands(invalid);
      }
      expect(badgeText()).toBe('3');
    });

    it('reenvia o retângulo da barra quando o indicador aparece e some (RNF-173)', () => {
      // jsdom não tem layout: a barra fica 30 px maior quando contém o indicador.
      const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const box = (width: number) =>
          ({ left: 100, top: 20, width, height: 54, right: 100 + width, bottom: 74, x: 100, y: 20, toJSON: () => ({}) }) as DOMRect;
        if (this.getAttribute('data-testid') === 'external-floating-toolbar') {
          return box(this.querySelector('[data-testid="external-raised-hands"]') ? 470 : 440);
        }
        return box(0);
      });
      try {
        render(<FloatingAnnotationOverlay />);
        const lastRect = () => {
          const calls = (window.electronAPI.setAnnotationToolbarRect as any).mock.calls;
          return calls[calls.length - 1]?.[0];
        };
        expect(lastRect()).toEqual({ x: 100, y: 20, width: 440, height: 54 });

        sendRaisedHands(1);
        expect(lastRect()).toEqual({ x: 100, y: 20, width: 470, height: 54 });

        sendRaisedHands(0);
        expect(lastRect()).toEqual({ x: 100, y: 20, width: 440, height: 54 });
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('Barra nos cantos da tela (026/RF-2601 a RF-2606)', () => {
    const MARGIN = 6;
    const H_SIZE = { w: 440, h: 54 };
    const V_SIZE = { w: 54, h: 440 };
    const BUBBLE = { w: 52, h: 52 };

    const setViewport = (w: number, h: number) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
      Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });
    };

    afterEach(() => {
      setViewport(1024, 768);
      vi.restoreAllMocks();
    });

    describe('computeExpandedToolbarPos e clampToolbarPos', () => {
      const viewports: Array<[number, number]> = [
        [1920, 1080],
        [1366, 768],
      ];

      it.each(viewports)('bolinha nos cantos e bordas de %ix%i: barra inteira na tela (RF-2603, RF-2604)', (vw, vh) => {
        const maxX = vw - BUBBLE.w - MARGIN;
        const maxY = vh - BUBBLE.h - MARGIN;
        const midX = Math.round(vw / 2);
        const midY = Math.round(vh / 2);
        const bubbles = [
          { x: MARGIN, y: MARGIN },
          { x: maxX, y: MARGIN },
          { x: MARGIN, y: maxY },
          { x: maxX, y: maxY },
          { x: midX, y: MARGIN },
          { x: midX, y: maxY },
          { x: MARGIN, y: midY },
          { x: maxX, y: midY },
        ];
        for (const bubble of bubbles) {
          const zone = computeToolbarDockZone(bubble, vw, vh);
          const size = zone === 'top' || zone === 'bottom' ? H_SIZE : V_SIZE;
          const pos = computeExpandedToolbarPos(bubble, BUBBLE, size, zone, vw, vh);
          expect(pos.x).toBeGreaterThanOrEqual(MARGIN);
          expect(pos.y).toBeGreaterThanOrEqual(MARGIN);
          expect(pos.x + size.w).toBeLessThanOrEqual(vw - MARGIN);
          expect(pos.y + size.h).toBeLessThanOrEqual(vh - MARGIN);
        }
      });

      it('canto inferior direito: a barra termina rente à bolinha (US-2601)', () => {
        const bubble = { x: 1862, y: 1022 };
        expect(computeToolbarDockZone(bubble, 1920, 1080)).toBe('bottom');
        expect(computeExpandedToolbarPos(bubble, BUBBLE, H_SIZE, 'bottom', 1920, 1080)).toEqual({ x: 1474, y: 1020 });
      });

      it('ancora pelo lado da bolinha: topo à esquerda, direita por baixo, esquerda por cima (RF-2603)', () => {
        expect(computeExpandedToolbarPos({ x: 300, y: 20 }, BUBBLE, H_SIZE, 'top', 1920, 1080)).toEqual({ x: 300, y: 20 });
        expect(computeExpandedToolbarPos({ x: 1500, y: 20 }, BUBBLE, H_SIZE, 'top', 1920, 1080)).toEqual({
          x: 1500 + 52 - 440,
          y: 20,
        });
        expect(computeExpandedToolbarPos({ x: 1862, y: 700 }, BUBBLE, V_SIZE, 'right', 1920, 1080)).toEqual({
          x: 1862 + 52 - 54,
          y: 700 + 52 - 440,
        });
        expect(computeExpandedToolbarPos({ x: 20, y: 300 }, BUBBLE, V_SIZE, 'left', 1920, 1080)).toEqual({ x: 20, y: 300 });
      });

      it('clampToolbarPos limita à margem e fica na margem quando a barra não cabe', () => {
        expect(clampToolbarPos({ x: 1900, y: 1070 }, H_SIZE, 1920, 1080)).toEqual({ x: 1474, y: 1020 });
        expect(clampToolbarPos({ x: -50, y: -50 }, H_SIZE, 1920, 1080)).toEqual({ x: 6, y: 6 });
        expect(clampToolbarPos({ x: 100, y: 100 }, V_SIZE, 1920, 400)).toEqual({ x: 100, y: 6 });
      });
    });

    describe('componente', () => {
      let stateSyncCb: (state: any) => void = () => {};
      let shortcutCb: (cmd: any) => void = () => {};
      let raisedHandsCb: (count: number) => void = () => {};

      // jsdom não tem layout: a barra mede 52×52 recolhida e 460×54 / 54×480 aberta (diferente do tamanho de
      // referência, para provar que a âncora usa o tamanho medido); o indicador de mãos soma 30px na horizontal.
      const mockToolbarLayout = () =>
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
          const box = (left: number, top: number, width: number, height: number) =>
            ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
          const el = this as HTMLElement;
          if (el.getAttribute('data-testid') !== 'external-floating-toolbar') return box(0, 0, 0, 0);
          const left = parseFloat(el.style.left) || 0;
          const top = parseFloat(el.style.top) || 0;
          if (el.getAttribute('data-collapsed') === 'true') return box(left, top, 52, 52);
          const extra = el.querySelector('[data-testid="external-raised-hands"]') ? 30 : 0;
          return el.getAttribute('data-orientation') === 'horizontal'
            ? box(left, top, 460 + extra, 54)
            : box(left, top, 54, 480);
        });

      const toolbar = () => screen.getByTestId('external-floating-toolbar');
      const posOf = () => ({ x: parseFloat(toolbar().style.left), y: parseFloat(toolbar().style.top) });
      const lastSynced = () => {
        const calls = (window.electronAPI.syncAnnotationState as any).mock.calls;
        return calls[calls.length - 1]?.[0];
      };

      // Arraste como no app: pointerdown no elemento, mousemove/mouseup na janela.
      const drag = (el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
        act(() => {
          el.dispatchEvent(
            new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 0, clientX: from.x, clientY: from.y })
          );
        });
        act(() => {
          window.dispatchEvent(new MouseEvent('mousemove', { clientX: to.x, clientY: to.y, buttons: 0 }));
        });
        act(() => {
          window.dispatchEvent(new MouseEvent('mouseup'));
        });
      };

      /** Arrasta a bolinha até `target` (canto superior esquerdo) e descarta o clique que sucede o arraste. */
      const dragBubbleTo = (target: { x: number; y: number }) => {
        const start = posOf();
        drag(screen.getByTestId('external-collapsed-btn'), { x: start.x + 10, y: start.y + 10 }, { x: target.x + 10, y: target.y + 10 });
        fireEvent.click(screen.getByTestId('external-collapsed-btn'));
      };

      const minimize = () => fireEvent.click(screen.getByTestId('external-collapse-btn'));
      const expand = () => fireEvent.click(screen.getByTestId('external-collapsed-btn'));

      const expectInsideViewport = (vw: number, vh: number) => {
        const r = toolbar().getBoundingClientRect();
        expect(r.left).toBeGreaterThanOrEqual(MARGIN);
        expect(r.top).toBeGreaterThanOrEqual(MARGIN);
        expect(r.right).toBeLessThanOrEqual(vw - MARGIN);
        expect(r.bottom).toBeLessThanOrEqual(vh - MARGIN);
      };

      beforeEach(() => {
        window.electronAPI.onAnnotationStateSync = vi.fn().mockImplementation((cb) => {
          stateSyncCb = cb;
          return () => {};
        });
        window.electronAPI.onAnnotationShortcutCommand = vi.fn().mockImplementation((cb) => {
          shortcutCb = cb;
          return () => {};
        });
        window.electronAPI.onAnnotationRaisedHands = vi.fn().mockImplementation((cb) => {
          raisedHandsCb = cb;
          return () => {};
        });
      });

      it('bolinha no canto inferior direito expande inteira na tela, rente ao canto (US-2601, RNF-2601, RNF-2602)', () => {
        setViewport(1920, 1080);
        mockToolbarLayout();
        render(<FloatingAnnotationOverlay />);
        minimize();
        dragBubbleTo({ x: 1900, y: 1070 });
        expect(posOf()).toEqual({ x: 1862, y: 1022 });

        expand();
        expect(toolbar()).toHaveAttribute('data-collapsed', 'false');
        expect(toolbar()).toHaveAttribute('data-dock-zone', 'bottom');
        expect(toolbar()).toHaveAttribute('data-orientation', 'horizontal');
        // Âncora pelo tamanho medido (460): borda direita e inferior rentes às da bolinha.
        expect(posOf()).toEqual({ x: 1862 + 52 - 460, y: 1022 + 52 - 54 });
        expectInsideViewport(1920, 1080);
        // O main recebe a posição visível e o hit-test do Linux o retângulo novo.
        expect(lastSynced()).toEqual(expect.objectContaining({ collapsed: false, toolbarPos: { x: 1454, y: 1020 } }));
        const rectCalls = (window.electronAPI.setAnnotationToolbarRect as any).mock.calls;
        expect(rectCalls[rectCalls.length - 1][0]).toEqual({ x: 1454, y: 1020, width: 460, height: 54 });

        // Popover de cores abre para dentro da tela (para cima, na base).
        fireEvent.click(screen.getByTestId('external-tool-palette'));
        expect(screen.getByTestId('external-palette-popover')).toHaveStyle({ bottom: '54px' });
      });

      it('mão levantada aumenta a barra e ela é limitada de novo à tela (RF-2604)', () => {
        setViewport(1920, 1080);
        mockToolbarLayout();
        render(<FloatingAnnotationOverlay />);
        minimize();
        dragBubbleTo({ x: 1900, y: 1070 });
        expand();
        act(() => raisedHandsCb(2));
        expect(posOf()).toEqual({ x: 1920 - 490 - MARGIN, y: 1020 });
        expect(toolbar()).toHaveAttribute('data-orientation', 'horizontal');
        expectInsideViewport(1920, 1080);
      });

      it('minimizar devolve a bolinha ao ponto, reexpandir volta à barra aberta e mover a bolinha ancora nela (US-2602)', () => {
        setViewport(1920, 1080);
        mockToolbarLayout();
        render(<FloatingAnnotationOverlay />);
        minimize();
        dragBubbleTo({ x: 1900, y: 1070 });
        expand();
        expect(posOf()).toEqual({ x: 1454, y: 1020 });

        // Arrasta a barra aberta para B (lateral esquerda: vira vertical).
        drag(screen.getByTestId('external-drag-handle'), { x: 1460, y: 1030 }, { x: 806, y: 510 });
        expect(posOf()).toEqual({ x: 800, y: 500 });
        expect(toolbar()).toHaveAttribute('data-orientation', 'vertical');

        // RF-2605/RF-2606: a bolinha volta para A, não para B.
        minimize();
        expect(posOf()).toEqual({ x: 1862, y: 1022 });
        expect(lastSynced()).toEqual(expect.objectContaining({ collapsed: true, toolbarPos: { x: 1862, y: 1022 } }));

        // RF-2602: sem mover a bolinha, a barra reabre em B com a orientação que tinha.
        expand();
        expect(posOf()).toEqual({ x: 800, y: 500 });
        expect(toolbar()).toHaveAttribute('data-orientation', 'vertical');

        // RF-2606: movida a bolinha, a próxima expansão ancora nela.
        minimize();
        dragBubbleTo({ x: 300, y: 20 });
        expand();
        expect(toolbar()).toHaveAttribute('data-dock-zone', 'top');
        expect(posOf()).toEqual({ x: 300, y: 20 });
      });

      it('minimizar e expandir pela sincronização do MLab e pelo atalho usam as posições certas (RF-2605)', () => {
        setViewport(1920, 1080);
        mockToolbarLayout();
        render(<FloatingAnnotationOverlay />);
        minimize();
        dragBubbleTo({ x: 1900, y: 1070 });
        expand();
        const expanded = posOf();
        expect(expanded).toEqual({ x: 1454, y: 1020 });

        // O main repassa o toolbarPos anterior (o da barra aberta); a bolinha volta ao ponto dela mesmo assim.
        act(() => stateSyncCb({ ...lastSynced(), collapsed: true, toolbarPos: expanded }));
        expect(toolbar()).toHaveAttribute('data-collapsed', 'true');
        expect(posOf()).toEqual({ x: 1862, y: 1022 });
        expect(lastSynced()).toEqual(expect.objectContaining({ collapsed: true, toolbarPos: { x: 1862, y: 1022 } }));

        // O eco do main com a mesma posição não muda nada.
        act(() => stateSyncCb({ ...lastSynced() }));
        expect(posOf()).toEqual({ x: 1862, y: 1022 });

        act(() => shortcutCb('toggle-collapse'));
        expect(toolbar()).toHaveAttribute('data-collapsed', 'false');
        expect(posOf()).toEqual(expanded);

        act(() => shortcutCb('toggle-collapse'));
        expect(toolbar()).toHaveAttribute('data-collapsed', 'true');
        expect(posOf()).toEqual({ x: 1862, y: 1022 });
      });

      it('barra vertical na direita ancorada por baixo continua vertical em 1366×768 (RF-2604, C-2603)', () => {
        setViewport(1366, 768);
        mockToolbarLayout();
        render(<FloatingAnnotationOverlay />);
        minimize();
        dragBubbleTo({ x: 1308, y: 540 });
        expect(posOf()).toEqual({ x: 1308, y: 540 });

        expand();
        expect(toolbar()).toHaveAttribute('data-dock-zone', 'right');
        expect(toolbar()).toHaveAttribute('data-orientation', 'vertical');
        // O canto superior (y = 112) está na faixa do topo, mas a orientação fixada na expansão se mantém.
        expect(posOf()).toEqual({ x: 1308 + 52 - 54, y: 540 + 52 - 480 });
        expect(computeToolbarDockZone(posOf(), 1366, 768)).toBe('top');
        expectInsideViewport(1366, 768);

        // Popover de cores abre para a esquerda, para dentro da tela.
        fireEvent.click(screen.getByTestId('external-tool-palette'));
        expect(screen.getByTestId('external-palette-popover')).toHaveStyle({ right: '54px' });
      });
    });
  });
});
