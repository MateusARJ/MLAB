// @vitest-environment jsdom
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FloatingAnnotationOverlay,
  computeToolbarDockZone,
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
});
