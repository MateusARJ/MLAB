import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type {
  AnnotationPoint,
  AnnotationSessionState,
  AnnotationStroke,
  AnnotationTool,
  AnnotationToolbarRect,
} from '@mlab/types';
import {
  Cursor_1,
  Pen,
  Draw,
  ArrowUpRight,
  SquareOutline,
  Erase,
  ZoomIn,
  ColorPalette,
  Undo,
  Redo,
  TrashCan,
  Minimize,
  Touch_1Filled,
} from '@mlab/ui';

const ANNOTATION_COLORS = [
  { hex: '#ef4444', name: 'Vermelho' },
  { hex: '#facc15', name: 'Amarelo (Marca-texto)' },
  { hex: '#38bdf8', name: 'Azul' },
  { hex: '#22c55e', name: 'Verde' },
  { hex: '#c084fc', name: 'Roxo' },
  { hex: '#ffffff', name: 'Branco' },
];

const STORAGE_POS_KEY = 'mlab.floatingToolbarPos';

export type ToolbarDockZone = 'top' | 'bottom' | 'left' | 'right';

export function computeToolbarDockZone(
  pos: { x: number; y: number },
  viewportW: number,
  viewportH: number
): ToolbarDockZone {
  const vw = viewportW > 0 ? viewportW : 1920;
  const vh = viewportH > 0 ? viewportH : 1080;
  const topThreshold = Math.max(96, Math.round(vh * 0.2));
  const bottomThreshold = Math.min(vh - 96, Math.round(vh * 0.78));

  if (pos.y <= topThreshold) {
    return 'top';
  }
  if (pos.y >= bottomThreshold) {
    return 'bottom';
  }
  return pos.x >= vw / 2 ? 'right' : 'left';
}

/** 026/RF-2604: margem mínima entre a barra e a borda da tela (a mesma do arraste). */
export const TOOLBAR_EDGE_MARGIN = 6;

type ToolbarPoint = { x: number; y: number };
type ToolbarSize = { w: number; h: number };

/** Tamanhos usados quando a barra ainda não pôde ser medida (ex.: jsdom). */
const COLLAPSED_FALLBACK_SIZE: ToolbarSize = { w: 52, h: 52 };

function expandedFallbackSize(zone: ToolbarDockZone): ToolbarSize {
  return zone === 'top' || zone === 'bottom' ? { w: 440, h: 54 } : { w: 54, h: 440 };
}

/** 026/RF-2604: mantém o retângulo inteiro na tela; se ele não couber, fica na margem superior/esquerda. */
export function clampToolbarPos(
  pos: ToolbarPoint,
  size: ToolbarSize,
  viewportW: number,
  viewportH: number,
  margin: number = TOOLBAR_EDGE_MARGIN
): ToolbarPoint {
  const vw = viewportW > 0 ? viewportW : 1920;
  const vh = viewportH > 0 ? viewportH : 1080;
  return {
    x: Math.max(margin, Math.min(Math.max(margin, vw - size.w - margin), Math.round(pos.x))),
    y: Math.max(margin, Math.min(Math.max(margin, vh - size.h - margin), Math.round(pos.y))),
  };
}

/**
 * 026/RF-2603: posição da barra aberta ancorada à bolinha, crescendo para dentro da tela.
 * Horizontal (topo/base): alinha à direita da bolinha se o centro dela está na metade direita; na base, alinha por baixo.
 * Vertical (esquerda/direita): na direita alinha à direita da bolinha; alinha por baixo se o centro está na metade de baixo.
 */
export function computeExpandedToolbarPos(
  bubblePos: ToolbarPoint,
  bubbleSize: ToolbarSize,
  barSize: ToolbarSize,
  zone: ToolbarDockZone,
  viewportW: number,
  viewportH: number
): ToolbarPoint {
  const vw = viewportW > 0 ? viewportW : 1920;
  const vh = viewportH > 0 ? viewportH : 1080;
  const centerX = bubblePos.x + bubbleSize.w / 2;
  const centerY = bubblePos.y + bubbleSize.h / 2;
  const alignRight = zone === 'top' || zone === 'bottom' ? centerX >= vw / 2 : zone === 'right';
  const alignBottom = zone === 'top' || zone === 'bottom' ? zone === 'bottom' : centerY >= vh / 2;
  const raw = {
    x: alignRight ? bubblePos.x + bubbleSize.w - barSize.w : bubblePos.x,
    y: alignBottom ? bubblePos.y + bubbleSize.h - barSize.h : bubblePos.y,
  };
  return clampToolbarPos(raw, barSize, vw, vh);
}

function isFinitePoint(value: unknown): value is ToolbarPoint {
  const v = value as ToolbarPoint | null;
  return (
    !!v &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    Number.isFinite(v.x) &&
    Number.isFinite(v.y)
  );
}

const STORAGE_BUBBLE_POS_KEY = 'mlab.floatingToolbarBubblePos';
const STORAGE_EXPANDED_KEY = 'mlab.floatingToolbarExpanded';
const DOCK_ZONES: ToolbarDockZone[] = ['top', 'bottom', 'left', 'right'];

type ExpandedToolbarLayout = { x: number; y: number; zone: ToolbarDockZone };

function readSessionJson(key: string): unknown {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {}
  return null;
}

function writeSessionJson(key: string, value: unknown): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (value === null) {
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, JSON.stringify(value));
      }
    }
  } catch {}
}

function loadBubblePos(fallback: ToolbarPoint): ToolbarPoint {
  const parsed = readSessionJson(STORAGE_BUBBLE_POS_KEY);
  return isFinitePoint(parsed) ? { x: parsed.x, y: parsed.y } : fallback;
}

function loadExpandedLayout(): ExpandedToolbarLayout | null {
  const parsed = readSessionJson(STORAGE_EXPANDED_KEY) as ExpandedToolbarLayout | null;
  if (isFinitePoint(parsed) && DOCK_ZONES.includes(parsed.zone)) {
    return { x: parsed.x, y: parsed.y, zone: parsed.zone };
  }
  return null;
}

function loadInitialToolbarPos(): { x: number; y: number } {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(STORAGE_POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.x === 'number' &&
          typeof parsed.y === 'number' &&
          Number.isFinite(parsed.x) &&
          Number.isFinite(parsed.y)
        ) {
          return { x: parsed.x, y: parsed.y };
        }
      }
    }
  } catch {}
  return { x: 24, y: 140 };
}

function saveToolbarPos(pos: { x: number; y: number }): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
    }
  } catch {}
}

export const FloatingAnnotationOverlay: React.FC = () => {
  const [sessionState, setSessionState] = useState<AnnotationSessionState>({
    activeTool: 'cursor',
    strokeColor: '#ef4444',
    strokeSize: 4,
    strokes: [],
    redoStrokes: [],
    activeStroke: null,
    spotlight: {
      enabled: false,
      x: 0.5,
      y: 0.5,
      radius: 0.14,
      zoom: 1,
      activeInViewer: false,
    },
    collapsed: false,
  });

  const [showPalettePopover, setShowPalettePopover] = useState<boolean>(false);
  const [targetBounds, setTargetBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>(() => loadInitialToolbarPos());
  const [mlabFocused, setMlabFocused] = useState<boolean>(false);
  const [isDraggingState, setIsDraggingState] = useState<boolean>(false);
  /** 017: quantidade de mãos levantadas enviada pela janela do MLab (RF-171, RF-176). */
  const [raisedHands, setRaisedHands] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const lastToolbarRectKeyRef = useRef<string>('');
  const isDrawingRef = useRef<boolean>(false);
  const hadCanvasContentRef = useRef<boolean>(false);
  const isHoveringToolbarRef = useRef<boolean>(false);
  const isDraggingToolbarRef = useRef<boolean>(false);
  const lastIgnoreMouseRef = useRef<boolean | null>(null);
  const toolbarPosRef = useRef<{ x: number; y: number }>(toolbarPos);
  toolbarPosRef.current = toolbarPos;

  // 026/RF-2601: a bolinha e a barra aberta guardam posições independentes (só na sessão). `toolbarPos` continua
  // sendo a posição visível atual, a que vai ao main (RNF-2601).
  const [initialLayout] = useState(() => ({
    bubble: loadBubblePos(toolbarPos),
    expanded: loadExpandedLayout(),
  }));
  const bubblePosRef = useRef<ToolbarPoint>(initialLayout.bubble);
  const expandedLayoutRef = useRef<ExpandedToolbarLayout | null>(initialLayout.expanded);
  // 026/C-2603: orientação da barra aberta fixada na expansão; só muda no arraste ou com posição nova vinda do sync.
  const [expandedZone, setExpandedZone] = useState<ToolbarDockZone | null>(() =>
    initialLayout.expanded &&
    initialLayout.expanded.x === toolbarPos.x &&
    initialLayout.expanded.y === toolbarPos.y
      ? initialLayout.expanded.zone
      : null
  );
  const expandedZoneRef = useRef<ToolbarDockZone | null>(expandedZone);
  expandedZoneRef.current = expandedZone;
  // 026/RF-2603: âncora a refazer com o tamanho real da barra aberta, medido depois de renderizar.
  const pendingAnchorRef = useRef<{ bubble: ToolbarPoint; bubbleSize: ToolbarSize; zone: ToolbarDockZone } | null>(
    null
  );

  const mlabFocusedRef = useRef<boolean>(mlabFocused);
  mlabFocusedRef.current = mlabFocused;

  const lastCtrlReleaseTimeRef = useRef<number>(0);
  const hadOtherKeyDuringCtrlRef = useRef<boolean>(false);

  const dragStartOffsetRef = useRef<{
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
    hadButtonsOnDown: boolean;
  }>({
    dx: 0,
    dy: 0,
    startX: 0,
    startY: 0,
    moved: false,
    hadButtonsOnDown: false,
  });

  const stateRef = useRef<AnnotationSessionState>(sessionState);
  stateRef.current = sessionState;

  // Referência mutable de coordenadas da Lupa desacoplada do estado React (evita 60Hz de re-renderização)
  const spotlightPosRef = useRef<{ x: number; y: number }>({
    x: sessionState.spotlight.x,
    y: sessionState.spotlight.y,
  });
  const rafOverlayDrawRef = useRef<number>(0);

  // Garante fundo 100% transparente na janela de overlay do Electron
  useEffect(() => {
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;
    const prevOverflow = document.body.style.overflow;
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.background = prevBodyBg;
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const pushStateToMain = useCallback((next: AnnotationSessionState) => {
    const withPos: AnnotationSessionState = {
      ...next,
      toolbarPos: next.toolbarPos !== undefined ? next.toolbarPos : toolbarPosRef.current,
    };
    stateRef.current = withPos;
    setSessionState(withPos);
    if (window.electronAPI && typeof window.electronAPI.syncAnnotationState === 'function') {
      window.electronAPI.syncAnnotationState(withPos).catch(() => {});
    }
  }, []);

  const setVisibleToolbarPos = useCallback((pos: ToolbarPoint) => {
    toolbarPosRef.current = pos;
    setToolbarPos(pos);
    saveToolbarPos(pos);
  }, []);

  const saveBubblePos = useCallback((pos: ToolbarPoint) => {
    bubblePosRef.current = pos;
    writeSessionJson(STORAGE_BUBBLE_POS_KEY, pos);
  }, []);

  const saveExpandedLayout = useCallback((layout: ExpandedToolbarLayout | null) => {
    expandedLayoutRef.current = layout;
    writeSessionJson(STORAGE_EXPANDED_KEY, layout);
  }, []);

  const setFixedExpandedZone = useCallback((zone: ToolbarDockZone | null) => {
    expandedZoneRef.current = zone;
    setExpandedZone(zone);
  }, []);

  const measureToolbar = useCallback((): ToolbarSize | null => {
    const el = toolbarRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { w: Math.ceil(r.width), h: Math.ceil(r.height) } : null;
  }, []);

  /**
   * 026: ponto único de troca entre bolinha e barra aberta (botão, clique na bolinha, atalho, tecla `h` e sync).
   * Minimizar guarda a barra aberta e devolve a bolinha ao ponto dela (RF-2605); expandir reabre a barra na posição
   * salva (RF-2602) ou ancorada à bolinha (RF-2603). Deve ser chamada com `stateRef.current` ainda no estado anterior.
   */
  const applyCollapsedTransition = useCallback(
    (base: AnnotationSessionState, nextCollapsed: boolean): AnnotationSessionState => {
      const wasCollapsed = stateRef.current.collapsed;
      if (wasCollapsed === nextCollapsed) {
        return { ...base, collapsed: nextCollapsed, toolbarPos: toolbarPosRef.current };
      }
      const vw = window.innerWidth > 0 ? window.innerWidth : 1920;
      const vh = window.innerHeight > 0 ? window.innerHeight : 1080;

      if (nextCollapsed) {
        const zone = expandedZoneRef.current ?? computeToolbarDockZone(toolbarPosRef.current, vw, vh);
        saveExpandedLayout({ x: toolbarPosRef.current.x, y: toolbarPosRef.current.y, zone });
        pendingAnchorRef.current = null;
        const bubble = clampToolbarPos(bubblePosRef.current, COLLAPSED_FALLBACK_SIZE, vw, vh);
        saveBubblePos(bubble);
        setVisibleToolbarPos(bubble);
        return { ...base, collapsed: true, toolbarPos: bubble };
      }

      const bubble = bubblePosRef.current;
      const bubbleSize = measureToolbar() ?? COLLAPSED_FALLBACK_SIZE;
      const saved = expandedLayoutRef.current;
      let zone: ToolbarDockZone;
      let pos: ToolbarPoint;
      if (saved) {
        zone = saved.zone;
        pos = clampToolbarPos(saved, expandedFallbackSize(zone), vw, vh);
        pendingAnchorRef.current = null;
      } else {
        zone = computeToolbarDockZone(bubble, vw, vh);
        pos = computeExpandedToolbarPos(bubble, bubbleSize, expandedFallbackSize(zone), zone, vw, vh);
        pendingAnchorRef.current = { bubble, bubbleSize, zone };
      }
      setFixedExpandedZone(zone);
      saveExpandedLayout({ x: pos.x, y: pos.y, zone });
      setVisibleToolbarPos(pos);
      return { ...base, collapsed: false, toolbarPos: pos };
    },
    [measureToolbar, saveBubblePos, saveExpandedLayout, setFixedExpandedZone, setVisibleToolbarPos]
  );

  const updateIgnoreMouse = useCallback((tool: AnnotationTool, insideMlab?: boolean) => {
    if (!window.electronAPI || typeof window.electronAPI.setAnnotationOverlayIgnoreMouse !== 'function') {
      return;
    }
    const mlabActive = typeof insideMlab === 'boolean' ? insideMlab : mlabFocusedRef.current;
    // Se o professor está dentro da janela do MLab em primeiro plano e não está arrastando a barra móvel,
    // ignora eventos de mouse no overlay para que o MLab receba todos os cliques sem duplicidade.
    if (mlabActive && !isDraggingToolbarRef.current) {
      if (lastIgnoreMouseRef.current !== true) {
        lastIgnoreMouseRef.current = true;
        window.electronAPI.setAnnotationOverlayIgnoreMouse(true).catch(() => {});
      }
      return;
    }

    const shouldCaptureMouse =
      isHoveringToolbarRef.current || isDraggingToolbarRef.current || tool !== 'cursor';
    const nextIgnore = !shouldCaptureMouse;
    if (lastIgnoreMouseRef.current === nextIgnore) {
      return;
    }
    lastIgnoreMouseRef.current = nextIgnore;
    window.electronAPI.setAnnotationOverlayIgnoreMouse(nextIgnore).catch(() => {});
  }, []);

  const handleSelectTool = useCallback(
    (tool: AnnotationTool) => {
      const cur = stateRef.current;
      setShowPalettePopover(false);
      let nextColor = cur.strokeColor;
      if (tool === 'highlighter' && cur.strokeColor === '#ef4444') {
        nextColor = '#facc15';
      } else if (tool === 'pen' && cur.strokeColor === '#facc15') {
        nextColor = '#ef4444';
      }
      const next: AnnotationSessionState = {
        ...cur,
        activeTool: tool,
        strokeColor: nextColor,
        // EXCLUSIVIDADE: Desativa a Lupa imediatamente ao selecionar qualquer ferramenta de desenho ou cursor
        spotlight: {
          ...cur.spotlight,
          enabled: false,
        },
      };
      pushStateToMain(next);
      updateIgnoreMouse(tool);
    },
    [pushStateToMain, updateIgnoreMouse]
  );

  const handleToggleSpotlight = useCallback(() => {
    const cur = stateRef.current;
    const willEnable = !cur.spotlight.enabled;
    setShowPalettePopover(false);
    const next: AnnotationSessionState = {
      ...cur,
      // EXCLUSIVIDADE: Ao ativar a Lupa, o modo de desenho volta para 'cursor' (apontador)
      // para que apenas a Lupa fique acesa e não haja conflito com o pincel
      activeTool: willEnable ? 'cursor' : cur.activeTool,
      spotlight: {
        ...cur.spotlight,
        enabled: willEnable,
      },
    };
    pushStateToMain(next);
    if (willEnable) {
      updateIgnoreMouse('cursor');
    }
  }, [pushStateToMain, updateIgnoreMouse]);

  // Recebe comandos de atalho globais (Alt+..., Alt+Shift+... e duplo clique no Ctrl via Main)
  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onAnnotationShortcutCommand !== 'function') return;
    const unsub = window.electronAPI.onAnnotationShortcutCommand((cmd: any) => {
      const action = typeof cmd === 'string' ? cmd : cmd?.action;
      if (action === 'select-tool' && cmd?.tool) {
        handleSelectTool(cmd.tool);
      } else if (action === 'tool-cursor') {
        handleSelectTool('cursor');
      } else if (action === 'tool-pen') {
        handleSelectTool('pen');
      } else if (action === 'tool-highlighter') {
        handleSelectTool('highlighter');
      } else if (action === 'tool-arrow') {
        handleSelectTool('arrow');
      } else if (action === 'tool-rect') {
        handleSelectTool('rect');
      } else if (action === 'tool-eraser') {
        handleSelectTool('eraser');
      } else if (action === 'toggle-spotlight') {
        handleToggleSpotlight();
      } else if (action === 'cycle-zoom') {
        const cur = stateRef.current;
        const nextZoom: 1 | 1.5 | 2 =
          cur.spotlight.zoom === 1 ? 1.5 : cur.spotlight.zoom === 1.5 ? 2 : 1;
        pushStateToMain({
          ...cur,
          spotlight: { ...cur.spotlight, zoom: nextZoom },
        });
      } else if (action === 'toggle-collapse') {
        setShowPalettePopover(false);
        const cur = stateRef.current;
        pushStateToMain(applyCollapsedTransition(cur, !cur.collapsed));
      } else if (action === 'undo') {
        const cur = stateRef.current;
        if (cur.strokes.length > 0) {
          const last = cur.strokes[cur.strokes.length - 1];
          pushStateToMain({
            ...cur,
            strokes: cur.strokes.slice(0, -1),
            redoStrokes: [...cur.redoStrokes, last],
          });
        }
      } else if (action === 'redo') {
        const cur = stateRef.current;
        if (cur.redoStrokes.length > 0) {
          const restored = cur.redoStrokes[cur.redoStrokes.length - 1];
          pushStateToMain({
            ...cur,
            strokes: [...cur.strokes, restored],
            redoStrokes: cur.redoStrokes.slice(0, -1),
          });
        }
      } else if (action === 'clear') {
        const cur = stateRef.current;
        pushStateToMain({
          ...cur,
          strokes: [],
          redoStrokes: [],
          activeStroke: null,
        });
      }
    });
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [handleSelectTool, handleToggleSpotlight, pushStateToMain, applyCollapsedTransition]);

  // Recebe sincronização de estado vinda da janela principal (Room.tsx)
  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onAnnotationStateSync !== 'function') return;
    const unsub = window.electronAPI.onAnnotationStateSync((incoming) => {
      const normalized: AnnotationSessionState = {
        ...incoming,
        collapsed: Boolean(incoming.collapsed),
      };
      // 026/RF-2605: a troca de `collapsed` vinda do MLab passa pela mesma transição; o `toolbarPos` recebido é o
      // anterior, repassado pelo main, e é substituído pela posição calculada aqui.
      if (normalized.collapsed !== stateRef.current.collapsed && !isDraggingToolbarRef.current) {
        setShowPalettePopover(false);
        const next = applyCollapsedTransition(normalized, normalized.collapsed);
        pushStateToMain(next);
        updateIgnoreMouse(next.activeTool);
        return;
      }
      stateRef.current = normalized;
      setSessionState(normalized);
      const pos = incoming.toolbarPos;
      // O eco do main traz a posição atual: só uma posição diferente é aplicada (C-2603).
      if (
        !isDraggingToolbarRef.current &&
        isFinitePoint(pos) &&
        (pos.x !== toolbarPosRef.current.x || pos.y !== toolbarPosRef.current.y)
      ) {
        const nextPos = { x: pos.x, y: pos.y };
        setVisibleToolbarPos(nextPos);
        if (normalized.collapsed) {
          saveBubblePos(nextPos);
        } else {
          const vw = window.innerWidth > 0 ? window.innerWidth : 1920;
          const vh = window.innerHeight > 0 ? window.innerHeight : 1080;
          const zone = computeToolbarDockZone(nextPos, vw, vh);
          setFixedExpandedZone(zone);
          saveExpandedLayout({ ...nextPos, zone });
        }
      }
      updateIgnoreMouse(normalized.activeTool);
    });
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [
    updateIgnoreMouse,
    applyCollapsedTransition,
    pushStateToMain,
    setVisibleToolbarPos,
    saveBubblePos,
    saveExpandedLayout,
    setFixedExpandedZone,
  ]);

  // 017/RF-171, RF-176: quantidade de mãos levantadas (só o número), vinda da janela do MLab pelo main.
  // Valores que não são inteiros ≥ 0 são ignorados e o indicador mantém o último válido (RNF-172).
  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onAnnotationRaisedHands !== 'function') return;
    const unsub = window.electronAPI.onAnnotationRaisedHands((count) => {
      if (Number.isInteger(count) && count >= 0) {
        setRaisedHands(count);
      }
    });
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  // Recebe estado de cursor, foco do MLab e limites da fonte transmitida
  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onCursorState !== 'function') return;
    const unsub = window.electronAPI.onCursorState((cState) => {
      if (typeof cState.mlabFocused === 'boolean' && cState.mlabFocused !== mlabFocusedRef.current) {
        mlabFocusedRef.current = cState.mlabFocused;
        setMlabFocused(cState.mlabFocused);
        updateIgnoreMouse(stateRef.current.activeTool, cState.mlabFocused);
      }

      if (cState.targetBounds && cState.targetBounds.w > 0 && cState.targetBounds.h > 0) {
        const tb = cState.targetBounds;
        setTargetBounds((prev) => {
          if (
            prev &&
            Math.abs(prev.x - tb.x) <= 1 &&
            Math.abs(prev.y - tb.y) <= 1 &&
            Math.abs(prev.w - tb.w) <= 1 &&
            Math.abs(prev.h - tb.h) <= 1
          ) {
            return prev;
          }
          return tb;
        });
      }
      if (cState.rect && stateRef.current.spotlight.enabled) {
        const nx = Math.min(1, Math.max(0, cState.rect.x + cState.rect.w * 0.35));
        const ny = Math.min(1, Math.max(0, cState.rect.y + cState.rect.h * 0.35));
        spotlightPosRef.current = { x: nx, y: ny };
        stateRef.current.spotlight.x = nx;
        stateRef.current.spotlight.y = ny;
        if (!rafOverlayDrawRef.current) {
          rafOverlayDrawRef.current = requestAnimationFrame(() => {
            rafOverlayDrawRef.current = 0;
            renderOverlayCanvas();
          });
        }
      }
    });
    return () => {
      try {
        unsub();
      } catch {}
      if (rafOverlayDrawRef.current) {
        cancelAnimationFrame(rafOverlayDrawRef.current);
        rafOverlayDrawRef.current = 0;
      }
    };
  }, [updateIgnoreMouse]);

  // Atalhos de teclado enquanto o professor está interagindo na camada de overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const cur = stateRef.current;

      // Detecção de Duplo Toque no Ctrl (Double-tap Ctrl local)
      const isCtrlKey = e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight';
      if (isCtrlKey) {
        const now = Date.now();
        const delta = now - lastCtrlReleaseTimeRef.current;
        if (
          lastCtrlReleaseTimeRef.current > 0 &&
          delta <= 600 &&
          !hadOtherKeyDuringCtrlRef.current
        ) {
          lastCtrlReleaseTimeRef.current = 0;
          hadOtherKeyDuringCtrlRef.current = false;
          handleToggleSpotlight();
          return;
        }
        if (lastCtrlReleaseTimeRef.current > 0 && delta > 600) {
          lastCtrlReleaseTimeRef.current = 0;
        }
        return;
      }

      // Se outra tecla for pressionada enquanto o Ctrl estiver ativo (ex: Ctrl+C, Ctrl+V),
      // anula o duplo toque para evitar acionar a Lupa acidentalmente.
      if (e.ctrlKey || e.metaKey) {
        hadOtherKeyDuringCtrlRef.current = true;
        lastCtrlReleaseTimeRef.current = 0;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (cur.strokes.length > 0) {
          const last = cur.strokes[cur.strokes.length - 1];
          pushStateToMain({
            ...cur,
            strokes: cur.strokes.slice(0, -1),
            redoStrokes: [...cur.redoStrokes, last],
          });
        }
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        if (cur.redoStrokes.length > 0) {
          const restored = cur.redoStrokes[cur.redoStrokes.length - 1];
          pushStateToMain({
            ...cur,
            strokes: [...cur.strokes, restored],
            redoStrokes: cur.redoStrokes.slice(0, -1),
          });
        }
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'x' || e.key === 'X')) ||
        e.key === 'Delete'
      ) {
        e.preventDefault();
        pushStateToMain({
          ...cur,
          strokes: [],
          redoStrokes: [],
          activeStroke: null,
        });
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        e.preventDefault();
        setShowPalettePopover(false);
        const next: AnnotationSessionState = {
          ...cur,
          activeTool: 'cursor',
          spotlight: { ...cur.spotlight, enabled: false },
        };
        pushStateToMain(next);
        updateIgnoreMouse('cursor');
      } else if (key === 'v' || key === '1') {
        e.preventDefault();
        handleSelectTool('cursor');
      } else if (key === 'p' || key === '2') {
        e.preventDefault();
        handleSelectTool('pen');
      } else if (key === 'm' || key === '3') {
        e.preventDefault();
        handleSelectTool('highlighter');
      } else if (key === 'a' || key === '4') {
        e.preventDefault();
        handleSelectTool('arrow');
      } else if (key === 'r' || key === '5') {
        e.preventDefault();
        handleSelectTool('rect');
      } else if (key === 'e' || key === 'b' || key === '6') {
        e.preventDefault();
        handleSelectTool('eraser');
      } else if (key === 'l' || key === 'f' || key === '7') {
        e.preventDefault();
        handleToggleSpotlight();
      } else if (key === 'z') {
        e.preventDefault();
        const nextZoom: 1 | 1.5 | 2 =
          cur.spotlight.zoom === 1 ? 1.5 : cur.spotlight.zoom === 1.5 ? 2 : 1;
        pushStateToMain({
          ...cur,
          spotlight: { ...cur.spotlight, zoom: nextZoom },
        });
      } else if (key === 'h') {
        e.preventDefault();
        setShowPalettePopover(false);
        pushStateToMain(applyCollapsedTransition(cur, !cur.collapsed));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isCtrlKey = e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight';
      if (isCtrlKey) {
        if (!hadOtherKeyDuringCtrlRef.current) {
          lastCtrlReleaseTimeRef.current = Date.now();
        } else {
          lastCtrlReleaseTimeRef.current = 0;
        }
        hadOtherKeyDuringCtrlRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleSelectTool, handleToggleSpotlight, pushStateToMain, updateIgnoreMouse, applyCollapsedTransition]);

  // Renderiza as marcações e a Lupa no canvas transparente (capturado diretamente pelo WGC em modo Tela Cheia)
  const renderOverlayCanvas = useCallback(() => {
    const cur = stateRef.current;
    const hasContent =
      cur.strokes.length > 0 ||
      cur.activeStroke !== null ||
      cur.spotlight.enabled;

    if (!hasContent && !hadCanvasContentRef.current) {
      return;
    }
    hadCanvasContentRef.current = hasContent;

    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!hasContent) return;

    const drawStroke = (s: AnnotationStroke) => {
      const pts = s.points;
      if (!pts || pts.length === 0) return;
      const scale = Math.max(1, w / 1280);

      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;

      if (s.tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = s.size * 3.2 * scale;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';
      } else {
        ctx.globalAlpha = 1;
        ctx.lineWidth = s.size * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      if (s.tool === 'pen' || s.tool === 'highlighter') {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        if (pts.length === 1) {
          ctx.lineTo(pts[0].x * w + 0.5, pts[0].y * h + 0.5);
        } else {
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * w, pts[i].y * h);
          }
        }
        ctx.stroke();
      } else if (s.tool === 'rect' && pts.length >= 2) {
        const p0 = pts[0];
        const p1 = pts[pts.length - 1];
        ctx.strokeRect(
          Math.min(p0.x, p1.x) * w,
          Math.min(p0.y, p1.y) * h,
          Math.abs(p1.x - p0.x) * w,
          Math.abs(p1.y - p0.y) * h
        );
      } else if (s.tool === 'arrow' && pts.length >= 2) {
        const p0 = pts[0];
        const p1 = pts[pts.length - 1];
        const x0 = p0.x * w;
        const y0 = p0.y * h;
        const x1 = p1.x * w;
        const y1 = p1.y * h;
        const headLen = Math.max(12, s.size * 3.5 * scale);
        const angle = Math.atan2(y1 - y0, x1 - x0);

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          x1 - headLen * Math.cos(angle - Math.PI / 6),
          y1 - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x1 - headLen * Math.cos(angle + Math.PI / 6),
          y1 - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    cur.strokes.forEach(drawStroke);
    if (cur.activeStroke) {
      drawStroke(cur.activeStroke);
    }

    if (cur.spotlight.enabled) {
      const pos = spotlightPosRef.current;
      const cx = pos.x * w;
      const cy = pos.y * h;
      const radius = Math.max(36, cur.spotlight.radius * Math.min(w, h));

      ctx.save();
      // Otimização de renderização rápida por 4 retângulos para acelerar a GPU/CPU
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      const left = Math.max(0, cx - radius);
      const right = Math.min(w, cx + radius);
      const top = Math.max(0, cy - radius);
      const bottom = Math.min(h, cy + radius);

      if (top > 0) ctx.fillRect(0, 0, w, top);
      if (bottom < h) ctx.fillRect(0, bottom, w, h - bottom);
      if (left > 0) ctx.fillRect(0, top, left, bottom - top);
      if (right < w) ctx.fillRect(right, top, w - right, bottom - top);

      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.fill('evenodd');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.92)';
      ctx.lineWidth = Math.max(2, 2.5 * (w / 1280));
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    renderOverlayCanvas();
  }, [
    sessionState.strokes,
    sessionState.activeStroke,
    sessionState.spotlight.enabled,
    sessionState.spotlight.radius,
    renderOverlayCanvas,
  ]);

  // Arraste livre (posicionamento onde o professor quiser) com captura de ponteiro e adaptação de orientação
  const handleStartDragToolbar = (e: React.MouseEvent | React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const currentPos = toolbarPosRef.current;
    const hadButtons = typeof e.buttons === 'number' && (e.buttons & 1) === 1;

    isDraggingToolbarRef.current = true;
    setIsDraggingState(true);
    dragStartOffsetRef.current = {
      dx: e.clientX - currentPos.x,
      dy: e.clientY - currentPos.y,
      startX: currentPos.x,
      startY: currentPos.y,
      moved: false,
      hadButtonsOnDown: hadButtons,
    };

    if ('pointerId' in e && typeof (e.currentTarget as HTMLElement)?.setPointerCapture === 'function') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }

    updateIgnoreMouse(stateRef.current.activeTool);

    const finishDrag = () => {
      if (!isDraggingToolbarRef.current) return;
      isDraggingToolbarRef.current = false;
      setIsDraggingState(false);
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);

      saveToolbarPos(toolbarPosRef.current);
      // 026/RF-2606: o arraste só muda a posição do modo atual. Mover a bolinha faz a próxima expansão ancorar nela.
      if (stateRef.current.collapsed) {
        saveBubblePos(toolbarPosRef.current);
        if (dragStartOffsetRef.current.moved) {
          saveExpandedLayout(null);
        }
      } else if (dragStartOffsetRef.current.moved) {
        const zone =
          expandedZoneRef.current ??
          computeToolbarDockZone(toolbarPosRef.current, window.innerWidth, window.innerHeight);
        saveExpandedLayout({ ...toolbarPosRef.current, zone });
      }
      pushStateToMain({
        ...stateRef.current,
        toolbarPos: toolbarPosRef.current,
      });

      // Mantém hover ativo após terminar o arraste para que o próximo clique na barra nunca passe direto
      isHoveringToolbarRef.current = true;
      updateIgnoreMouse(stateRef.current.activeTool);
    };

    const handleWindowMove = (moveEvent: MouseEvent | PointerEvent) => {
      if (!isDraggingToolbarRef.current) return;

      // Se o botão esquerdo foi solto fora da janela (em ambiente real onde hadButtonsOnDown era true),
      // finaliza imediatamente o arraste para que a barra nunca volte sozinha depois!
      if (
        dragStartOffsetRef.current.hadButtonsOnDown &&
        typeof moveEvent.buttons === 'number' &&
        (moveEvent.buttons & 1) === 0
      ) {
        finishDrag();
        return;
      }

      const vw = window.innerWidth > 0 ? window.innerWidth : 1920;
      const vh = window.innerHeight > 0 ? window.innerHeight : 1080;

      const rawX = moveEvent.clientX - dragStartOffsetRef.current.dx;
      const rawY = moveEvent.clientY - dragStartOffsetRef.current.dy;

      const nextZone = computeToolbarDockZone({ x: rawX, y: rawY }, vw, vh);
      const isHoriz = nextZone === 'top' || nextZone === 'bottom';
      const isCol = stateRef.current.collapsed;

      const barW = isCol ? 52 : isHoriz ? 440 : 54;
      const barH = isCol ? 52 : isHoriz ? 54 : 440;

      const nextX = Math.max(6, Math.min(Math.max(6, vw - barW - 6), Math.round(rawX)));
      const nextY = Math.max(6, Math.min(Math.max(6, vh - barH - 6), Math.round(rawY)));

      if (
        Math.abs(nextX - dragStartOffsetRef.current.startX) > 3 ||
        Math.abs(nextY - dragStartOffsetRef.current.startY) > 3
      ) {
        dragStartOffsetRef.current.moved = true;
      }

      const nextPos = { x: nextX, y: nextY };
      toolbarPosRef.current = nextPos;
      setToolbarPos(nextPos);
      if (!isCol && dragStartOffsetRef.current.moved) {
        // C-2603: arrastar a barra aberta recalcula a orientação pela posição, como antes da 026.
        setFixedExpandedZone(computeToolbarDockZone(nextPos, vw, vh));
      }
    };

    const handleWindowUp = () => {
      finishDrag();
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
  };

  const handleToolbarMouseEnter = () => {
    isHoveringToolbarRef.current = true;
    updateIgnoreMouse(stateRef.current.activeTool);
  };

  const handleToolbarMouseLeave = () => {
    if (isDraggingToolbarRef.current) return;
    isHoveringToolbarRef.current = false;
    updateIgnoreMouse(stateRef.current.activeTool);
  };

  // Chamado pelo botão Minimizar quando a barra está expandida
  const handleMinimizeToolbar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cur = stateRef.current;
    dragStartOffsetRef.current.moved = false;
    setShowPalettePopover(false);
    pushStateToMain(applyCollapsedTransition(cur, true));
  };

  // Chamado ao clicar no ícone redondo compacto quando a barra está minimizada
  const handleExpandToolbar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cur = stateRef.current;
    if (dragStartOffsetRef.current.moved) {
      dragStartOffsetRef.current.moved = false;
      return;
    }
    dragStartOffsetRef.current.moved = false;
    setShowPalettePopover(false);
    pushStateToMain(applyCollapsedTransition(cur, false));
  };

  const getNormalizedPoint = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0.5, y: 0.5 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const eraseAtPoint = (pt: AnnotationPoint) => {
    const cur = stateRef.current;
    const threshold = 0.03;
    const filtered = cur.strokes.filter(
      (stroke) =>
        !stroke.points.some((p) => {
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          return Math.sqrt(dx * dx + dy * dy) <= threshold;
        })
    );
    if (filtered.length !== cur.strokes.length) {
      pushStateToMain({
        ...cur,
        strokes: filtered,
      });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const cur = stateRef.current;
    const pt = getNormalizedPoint(e);

    if (cur.activeTool === 'cursor') return;

    isDrawingRef.current = true;
    if (cur.activeTool === 'eraser') {
      eraseAtPoint(pt);
      return;
    }

    const newStroke: AnnotationStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool: cur.activeTool,
      color: cur.strokeColor,
      size: cur.strokeSize,
      points: [pt],
    };
    pushStateToMain({
      ...cur,
      activeStroke: newStroke,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cur = stateRef.current;
    const pt = getNormalizedPoint(e);

    if (!isDrawingRef.current) return;

    if (cur.activeTool === 'eraser') {
      eraseAtPoint(pt);
      return;
    }

    if (!cur.activeStroke) return;
    const nextPoints =
      cur.activeStroke.tool === 'rect' || cur.activeStroke.tool === 'arrow'
        ? [cur.activeStroke.points[0], pt]
        : [...cur.activeStroke.points, pt];

    pushStateToMain({
      ...cur,
      activeStroke: {
        ...cur.activeStroke,
        points: nextPoints,
      },
    });
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const cur = stateRef.current;
    if (cur.activeStroke && cur.activeStroke.points.length > 0) {
      pushStateToMain({
        ...cur,
        strokes: [...cur.strokes, cur.activeStroke],
        redoStrokes: [],
        activeStroke: null,
      });
    }
  };

  const winOffsetX = typeof window !== 'undefined' ? window.screenX || 0 : 0;
  const winOffsetY = typeof window !== 'undefined' ? window.screenY || 0 : 0;
  const vw = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 1080;

  // 026/C-2603: a barra aberta usa a orientação fixada na expansão; a bolinha segue a posição, como antes.
  const dockZone =
    !sessionState.collapsed && expandedZone ? expandedZone : computeToolbarDockZone(toolbarPos, vw, vh);
  const isHorizontal = dockZone === 'top' || dockZone === 'bottom';
  const orientation = isHorizontal ? 'horizontal' : 'vertical';

  const canvasStyle: React.CSSProperties = targetBounds
    ? {
        position: 'fixed',
        left: `${targetBounds.x - winOffsetX}px`,
        top: `${targetBounds.y - winOffsetY}px`,
        width: `${targetBounds.w}px`,
        height: `${targetBounds.h}px`,
        zIndex: 10,
        pointerEvents:
          !mlabFocused && sessionState.activeTool !== 'cursor' ? 'auto' : 'none',
        cursor:
          sessionState.activeTool === 'cursor'
            ? 'default'
            : sessionState.activeTool === 'eraser'
            ? 'cell'
            : 'crosshair',
      }
    : {
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10,
        pointerEvents:
          !mlabFocused && sessionState.activeTool !== 'cursor' ? 'auto' : 'none',
        cursor:
          sessionState.activeTool === 'cursor'
            ? 'default'
            : sessionState.activeTool === 'eraser'
            ? 'cell'
            : 'crosshair',
      };

  const { activeTool, strokeColor, strokeSize, strokes, redoStrokes, activeStroke, spotlight, collapsed } =
    sessionState;

  // Quando o professor está com o mouse dentro da janela do MLab em primeiro plano (e não está arrastando a barra móvel),
  // oculta apenas os botões móveis para não duplicar com a barra interna do painel (mantendo o canvas de marcações 100% visível!)
  const showFloatingToolbar = !mlabFocused || isDraggingState;

  // 009/RF-902: informa ao main o retângulo da barra (+ popover de cores) para o hit-test do Linux. Com a barra
  // oculta (MLab em foco, sem arraste) envia null, mantendo o click-through como no Windows (C-903).
  const reportToolbarRect = useCallback(() => {
    if (!window.electronAPI || typeof window.electronAPI.setAnnotationToolbarRect !== 'function') return;
    let rect: AnnotationToolbarRect | null = null;
    const visible = !mlabFocusedRef.current || isDraggingToolbarRef.current;
    const el = toolbarRef.current;
    if (visible && el) {
      const r = el.getBoundingClientRect();
      let left = r.left;
      let top = r.top;
      let right = r.right;
      let bottom = r.bottom;
      const pop = paletteRef.current?.getBoundingClientRect();
      if (pop && pop.width > 0 && pop.height > 0) {
        left = Math.min(left, pop.left);
        top = Math.min(top, pop.top);
        right = Math.max(right, pop.right);
        bottom = Math.max(bottom, pop.bottom);
      }
      if (right - left > 0 && bottom - top > 0) {
        rect = {
          x: Math.floor(left),
          y: Math.floor(top),
          width: Math.ceil(right - left),
          height: Math.ceil(bottom - top),
        };
      }
    }
    const key = rect ? `${rect.x},${rect.y},${rect.width},${rect.height}` : 'null';
    if (key === lastToolbarRectKeyRef.current) return;
    lastToolbarRectKeyRef.current = key;
    window.electronAPI.setAnnotationToolbarRect(rect).catch(() => {});
  }, []);

  useLayoutEffect(() => {
    reportToolbarRect();
  }, [
    reportToolbarRect,
    toolbarPos,
    collapsed,
    orientation,
    showPalettePopover,
    mlabFocused,
    isDraggingState,
    raisedHands,
    vw,
    vh,
  ]);

  // 026/RF-2603, RF-2604: com o tamanho real medido, refaz a âncora da expansão ou limita a barra à tela (ex.: quando o
  // indicador de mãos aumenta a barra). Só atualiza quando a posição muda, e a orientação fixada não é recalculada.
  useLayoutEffect(() => {
    if (isDraggingToolbarRef.current) return;
    const pending = pendingAnchorRef.current;
    if (!collapsed) {
      pendingAnchorRef.current = null;
    }
    const size = measureToolbar();
    if (!size) return;
    const cur = toolbarPosRef.current;
    const next =
      !collapsed && pending
        ? computeExpandedToolbarPos(pending.bubble, pending.bubbleSize, size, pending.zone, vw, vh)
        : clampToolbarPos(cur, size, vw, vh);
    if (next.x === cur.x && next.y === cur.y) return;
    setVisibleToolbarPos(next);
    if (collapsed) {
      saveBubblePos(next);
    } else {
      saveExpandedLayout({ ...next, zone: expandedZoneRef.current ?? computeToolbarDockZone(next, vw, vh) });
    }
    pushStateToMain({ ...stateRef.current, toolbarPos: next });
  }, [
    collapsed,
    toolbarPos,
    raisedHands,
    expandedZone,
    vw,
    vh,
    measureToolbar,
    setVisibleToolbarPos,
    saveBubblePos,
    saveExpandedLayout,
    pushStateToMain,
  ]);

  useEffect(() => {
    const el = toolbarRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => reportToolbarRect());
      observer.observe(el);
    }
    window.addEventListener('resize', reportToolbarRect);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reportToolbarRect);
      lastToolbarRectKeyRef.current = '';
      window.electronAPI?.setAnnotationToolbarRect?.(null)?.catch(() => {});
    };
  }, [reportToolbarRect]);

  const dividerStyle: React.CSSProperties = isHorizontal
    ? overlayStyles.dividerHorizontalMode
    : overlayStyles.dividerVerticalMode;

  const popoverPositionStyle: React.CSSProperties =
    dockZone === 'top'
      ? {
          top: '54px',
          left: '50%',
          transform: 'translateX(-50%)',
        }
      : dockZone === 'bottom'
      ? {
          bottom: '54px',
          left: '50%',
          transform: 'translateX(-50%)',
        }
      : dockZone === 'right'
      ? {
          right: '54px',
          top: '50%',
          transform: 'translateY(-50%)',
        }
      : {
          left: '54px',
          top: '50%',
          transform: 'translateY(-50%)',
        };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        overflow: 'hidden',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
      data-testid="external-annotation-overlay"
    >
      {/* Camada de desenho e Lupa alinhada com a tela ou janela transmitida (SEMPRE visível na transmissão) */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={canvasStyle}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      />

      {/* Ícone / Barra Flutuante Ajustável (Arrastável), Retrátil e Adaptativa (Horizontal Topo/Base, Vertical Esq/Dir) */}
      <div
        ref={toolbarRef}
        onMouseEnter={handleToolbarMouseEnter}
        onMouseLeave={handleToolbarMouseLeave}
        style={{
          position: 'fixed',
          left: `${toolbarPos.x}px`,
          top: `${toolbarPos.y}px`,
          zIndex: 50,
          opacity: showFloatingToolbar ? 1 : 0,
          pointerEvents: showFloatingToolbar ? 'auto' : 'none',
          display: 'flex',
          flexDirection: collapsed ? 'column' : isHorizontal ? 'row' : 'column',
          alignItems: 'center',
          gap: '4px',
          padding: collapsed ? '6px' : isHorizontal ? '6px 8px' : '8px 6px',
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          // 017/RF-172: borda de destaque fixa (sem animação, C-171) enquanto houver mão levantada; mesma largura,
          // e o anel vai no boxShadow, para não mudar o layout nem o retângulo da barra.
          border: raisedHands > 0 ? '1px solid #facc15' : '1px solid #38bdf8',
          borderRadius: collapsed ? '999px' : '12px',
          boxShadow:
            raisedHands > 0
              ? '0 0 0 2px rgba(250, 204, 21, 0.55), 0 10px 28px rgba(0, 0, 0, 0.72)'
              : '0 10px 28px rgba(0, 0, 0, 0.72)',
          transition: 'opacity 0.12s ease',
        }}
        data-testid="external-floating-toolbar"
        data-raised-hands={raisedHands}
        data-collapsed={collapsed ? 'true' : 'false'}
        data-orientation={orientation}
        data-dock-zone={dockZone}
      >
        {collapsed ? (
          /* Modo Retrátil Compacto: Ícone Flutuante Posicionável (+ indicador de mãos abaixo, 017) */
          <>
          <button
            type="button"
            onPointerDown={handleStartDragToolbar}
            onClick={handleExpandToolbar}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor:
                activeTool !== 'cursor' || spotlight.enabled
                  ? 'rgba(56, 189, 248, 0.25)'
                  : 'transparent',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
            }}
            title="Arraste para mover ou clique para abrir as ferramentas de Marcação e Lupa (Atalho: H / Alt+Shift+H)"
            aria-label="Expandir Ferramentas de Marcação e Lupa"
            data-testid="external-collapsed-btn"
          >
            <Pen size={18} />
          </button>
          {raisedHands > 0 && <RaisedHandsIndicator count={raisedHands} />}
          </>
        ) : (
          /* Barra Completa Adaptativa (Horizontal no Topo/Base, Vertical na Esquerda/Direita) */
          <>
            {/* Cabeçalho de Arraste Livre + Botão de Minimizar */}
            <div
              onPointerDown={handleStartDragToolbar}
              style={
                isHorizontal
                  ? {
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '2px 6px 2px 2px',
                      borderRight: '1px solid #334155',
                      cursor: 'grab',
                    }
                  : {
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '2px',
                      padding: '2px 2px 4px 2px',
                      borderBottom: '1px solid #334155',
                      cursor: 'grab',
                    }
              }
              title="Segure e arraste para posicionar a barra onde quiser na tela (Topo/Base = Horizontal • Lados = Vertical)"
              data-testid="external-drag-handle"
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#94a3b8',
                  letterSpacing: '1px',
                  paddingLeft: '2px',
                  pointerEvents: 'none',
                }}
              >
                ⋮⋮
              </span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleMinimizeToolbar}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title="Minimizar para ícone flutuante compacto (Atalho: H / Alt+Shift+H)"
                aria-label="Minimizar Barra"
                data-testid="external-collapse-btn"
              >
                <Minimize size={12} />
              </button>
            </div>

            {raisedHands > 0 && <RaisedHandsIndicator count={raisedHands} />}

            <button
              type="button"
              onClick={() => handleSelectTool('cursor')}
              style={activeTool === 'cursor' ? overlayStyles.toolBtnActive : overlayStyles.toolBtn}
              title="Cursor Padrão — Clicar nas janelas abaixo (Atalho: V / Alt+Shift+V)"
              data-testid="external-tool-cursor"
            >
              <Cursor_1 size={16} />
              <span style={overlayStyles.shortcutBadge}>V</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTool('pen')}
              style={activeTool === 'pen' ? overlayStyles.toolBtnActive : overlayStyles.toolBtn}
              title="Pincel Livre (Atalho: P / Alt+Shift+P)"
              data-testid="external-tool-pen"
            >
              <Pen size={16} />
              <span style={overlayStyles.shortcutBadge}>P</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTool('highlighter')}
              style={activeTool === 'highlighter' ? overlayStyles.toolBtnActive : overlayStyles.toolBtn}
              title="Marcador / Marca-Texto PDF (Atalho: M / Alt+Shift+M)"
              data-testid="external-tool-highlighter"
            >
              <Draw size={16} />
              <span style={overlayStyles.shortcutBadge}>M</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTool('arrow')}
              style={activeTool === 'arrow' ? overlayStyles.toolBtnActive : overlayStyles.toolBtn}
              title="Seta Indicativa (Atalho: A / Alt+Shift+A)"
              data-testid="external-tool-arrow"
            >
              <ArrowUpRight size={16} />
              <span style={overlayStyles.shortcutBadge}>A</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTool('rect')}
              style={activeTool === 'rect' ? overlayStyles.toolBtnActive : overlayStyles.toolBtn}
              title="Retângulo de Destaque (Atalho: R / Alt+Shift+R)"
              data-testid="external-tool-rect"
            >
              <SquareOutline size={16} />
              <span style={overlayStyles.shortcutBadge}>R</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTool('eraser')}
              style={activeTool === 'eraser' ? overlayStyles.toolBtnActive : overlayStyles.toolBtn}
              title="Borracha (Atalho: E / Alt+Shift+E)"
              data-testid="external-tool-eraser"
            >
              <Erase size={16} />
              <span style={overlayStyles.shortcutBadge}>E</span>
            </button>

            <div style={dividerStyle} />

            <button
              type="button"
              onClick={handleToggleSpotlight}
              style={spotlight.enabled ? overlayStyles.toolBtnSpotlight : overlayStyles.toolBtn}
              title="Lupa / Foco no Mouse (Atalho: 2 cliques no Ctrl / L / Alt+L)"
              data-testid="external-tool-spotlight"
            >
              <ZoomIn size={16} />
              <span style={overlayStyles.shortcutBadge}>Ctrl</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPalettePopover((p) => !p)}
              style={showPalettePopover ? overlayStyles.toolBtnPaletteOpen : overlayStyles.toolBtn}
              title="Cor, Espessura e Zoom da Lupa (Atalho Zoom: Z / Alt+Z)"
              data-testid="external-tool-palette"
            >
              <ColorPalette size={16} />
              <span
                style={{
                  position: 'absolute',
                  bottom: '3px',
                  right: '3px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: strokeColor,
                  border: '1px solid #0f172a',
                }}
              />
            </button>

            <div style={dividerStyle} />

            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => {
                if (strokes.length === 0) return;
                const last = strokes[strokes.length - 1];
                pushStateToMain({
                  ...sessionState,
                  strokes: strokes.slice(0, -1),
                  redoStrokes: [...redoStrokes, last],
                });
              }}
              style={strokes.length === 0 ? overlayStyles.toolBtnDisabled : overlayStyles.toolBtn}
              title="Desfazer (Atalho: Ctrl+Z / Alt+Shift+U)"
              data-testid="external-tool-undo"
            >
              <Undo size={15} />
            </button>

            <button
              type="button"
              disabled={redoStrokes.length === 0}
              onClick={() => {
                if (redoStrokes.length === 0) return;
                const restored = redoStrokes[redoStrokes.length - 1];
                pushStateToMain({
                  ...sessionState,
                  strokes: [...strokes, restored],
                  redoStrokes: redoStrokes.slice(0, -1),
                });
              }}
              style={redoStrokes.length === 0 ? overlayStyles.toolBtnDisabled : overlayStyles.toolBtn}
              title="Refazer (Atalho: Ctrl+Y / Alt+Shift+Y)"
              data-testid="external-tool-redo"
            >
              <Redo size={15} />
            </button>

            <button
              type="button"
              disabled={strokes.length === 0 && !activeStroke}
              onClick={() =>
                pushStateToMain({
                  ...sessionState,
                  strokes: [],
                  redoStrokes: [],
                  activeStroke: null,
                })
              }
              style={
                strokes.length === 0 && !activeStroke
                  ? overlayStyles.toolBtnDisabled
                  : overlayStyles.toolBtnDanger
              }
              title="Limpar todas as marcações (Atalho: Delete / Alt+Shift+X)"
              data-testid="external-tool-clear"
            >
              <TrashCan size={15} />
            </button>
          </>
        )}

        {showPalettePopover && !collapsed && (
          <div
            style={{
              position: 'absolute',
              ...popoverPositionStyle,
              backgroundColor: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.75)',
              minWidth: '175px',
            }}
            ref={paletteRef}
            data-testid="external-palette-popover"
          >
            <div style={overlayStyles.popoverTitle}>Cor da Marcação</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {ANNOTATION_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => pushStateToMain({ ...sessionState, strokeColor: c.hex })}
                  title={c.name}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: c.hex,
                    border:
                      strokeColor === c.hex
                        ? '2px solid #ffffff'
                        : '1px solid rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>

            <div style={overlayStyles.popoverTitle}>Espessura do Traço</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: 'Fina', value: 3 },
                { label: 'Média', value: 5 },
                { label: 'Grossa', value: 9 },
              ].map((sz) => (
                <button
                  key={sz.value}
                  type="button"
                  onClick={() => pushStateToMain({ ...sessionState, strokeSize: sz.value })}
                  style={
                    strokeSize === sz.value ? overlayStyles.optionBtnActive : overlayStyles.optionBtn
                  }
                >
                  {sz.label}
                </button>
              ))}
            </div>

            <div style={overlayStyles.popoverTitle}>Zoom da Lupa (Alt+Shift+Z)</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([1, 1.5, 2] as const).map((zm) => (
                <button
                  key={zm}
                  type="button"
                  onClick={() =>
                    pushStateToMain({
                      ...sessionState,
                      spotlight: { ...spotlight, zoom: zm },
                    })
                  }
                  style={
                    spotlight.zoom === zm ? overlayStyles.optionBtnActive : overlayStyles.optionBtn
                  }
                >
                  {zm === 1 ? '1x (Foco)' : `${zm}x`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 017: ícone de mão com badge da quantidade de mãos levantadas (RF-171, RF-173, RF-174, RF-177).
 * Só informa: é um `span`, sem ação de clique nem de arraste. O badge fica dentro da caixa, para o indicador
 * caber inteiro no retângulo da barra enviado ao main no Linux (RNF-173).
 */
function RaisedHandsIndicator({ count }: { count: number }) {
  const label = `Mãos levantadas: ${count}`;
  return (
    <span role="img" aria-label={label} title={label} data-testid="external-raised-hands" style={raisedHandsStyles.box}>
      <Touch_1Filled size={16} />
      <span aria-hidden="true" data-testid="external-raised-hands-badge" style={raisedHandsStyles.badge}>
        {count > 9 ? '9+' : String(count)}
      </span>
    </span>
  );
}

const raisedHandsStyles: Record<'box' | 'badge', React.CSSProperties> = {
  box: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '28px',
    flexShrink: 0,
    color: '#e2e8f0',
    cursor: 'default',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: '14px',
    height: '14px',
    padding: '0 3px',
    boxSizing: 'border-box',
    borderRadius: '7px',
    backgroundColor: '#facc15',
    color: '#0f172a',
    fontSize: '10px',
    fontWeight: 700,
    lineHeight: '14px',
    textAlign: 'center',
    pointerEvents: 'none',
  },
};

const overlayStyles: Record<string, React.CSSProperties> = {
  toolBtn: {
    position: 'relative',
    width: '34px',
    height: '32px',
    borderRadius: '7px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  toolBtnActive: {
    position: 'relative',
    width: '34px',
    height: '32px',
    borderRadius: '7px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    color: '#38bdf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  toolBtnSpotlight: {
    position: 'relative',
    width: '34px',
    height: '32px',
    borderRadius: '7px',
    border: '1px solid #facc15',
    backgroundColor: 'rgba(250, 204, 21, 0.24)',
    color: '#facc15',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  toolBtnPaletteOpen: {
    position: 'relative',
    width: '34px',
    height: '32px',
    borderRadius: '7px',
    border: '1px solid rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  toolBtnDisabled: {
    position: 'relative',
    width: '34px',
    height: '30px',
    borderRadius: '7px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'not-allowed',
    opacity: 0.45,
  },
  toolBtnDanger: {
    position: 'relative',
    width: '34px',
    height: '30px',
    borderRadius: '7px',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  shortcutBadge: {
    position: 'absolute',
    bottom: '1px',
    right: '3px',
    fontSize: '8px',
    fontWeight: 700,
    color: '#94a3b8',
    lineHeight: 1,
    pointerEvents: 'none',
  },
  dividerVerticalMode: {
    width: '22px',
    height: '1px',
    backgroundColor: '#334155',
    margin: '2px 0',
  },
  dividerHorizontalMode: {
    width: '1px',
    height: '22px',
    backgroundColor: '#334155',
    margin: '0 2px',
  },
  popoverTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  optionBtn: {
    flex: 1,
    padding: '4px 6px',
    borderRadius: '5px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  optionBtnActive: {
    flex: 1,
    padding: '4px 6px',
    borderRadius: '5px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
