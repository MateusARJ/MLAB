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
  });
});
