import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  AnnotationPoint,
  AnnotationStroke,
  AnnotationTool,
  CaptureSource,
  SpotlightState,
} from '@mlab/types';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useLocalRecorder } from '../hooks/useLocalRecorder';
import { useWebRTCPublisher } from '../hooks/useWebRTCPublisher';
import { setAnnotationOverlayState } from '../media/createCursorMaskedTrack';
import { getStoredToken } from '../services/auth';
import { closeRoom } from '../services/room';
import { useRoomLinks } from '../hooks/useRoomLinks';
import { useRoomFileUploads, type UploadItem } from '../hooks/useRoomFileUploads';
import { FileDropZone } from '../components/FileDropZone';
import { clampAnnotationToolbarPosition } from './annotationToolbarPosition';
import {
  colors,
  radii,
  IconButton,
  Screen,
  Application,
  Camera,
  Microphone,
  MicrophoneOff,
  Recording,
  Exit,
  Locked,
  UserMultiple,
  Download,
  Attachment,
  Copy,
  Checkmark,
  Settings,
  Renew,
  Play,
  Close,
  Education,
  Idea,
  Touch_1,
  Touch_1Filled,
  VolumeUp,
  VolumeMute,
  Pin,
  PinFilled,
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
  Draggable,
  ChevronLeft,
  decodeChatEntities,
  Alert,
  BrandMark,
  ThemeToggle,
  Pause,
  PanelRightClose,
  PanelRightOpen,
} from '@mlab/ui';


interface RoomProps {
  room: {
    id: string;
    slug: string;
    link: string;
    ipLink?: string;
    mdnsLink?: string;
    shortIpLink?: string;
    shortMdnsLink?: string;
  };
  onCloseRoom: () => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const Room: React.FC<RoomProps> = ({ room, onCloseRoom }) => {
  // Configuração pré-transmissão
  const [wantRecord, setWantRecord] = useState<boolean>(false);
  const [qualityProfile, setQualityProfile] = useState<'1080p_30' | '1080p_60'>('1080p_60');
  const [tentativeSource, setTentativeSource] = useState<CaptureSource | null>(null);
  const [selectedWindowSources, setSelectedWindowSources] = useState<CaptureSource[]>([]);
  const [activeWindowSource, setActiveWindowSource] = useState<CaptureSource | null>(null);
  const currentActiveWindowSourceRef = useRef<CaptureSource | null>(null);
  const [isLiveSession, setIsLiveSession] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedMdns, setCopiedMdns] = useState<boolean>(false);
  const [copiedIp, setCopiedIp] = useState<boolean>(false);
  const [screenshotMsg, setScreenshotMsg] = useState<string | null>(null);
  // Links com o nome mDNS realmente anunciado, relidos a cada 10 s; aviso quando o link fixo muda (012, RF-128)
  const { links, notice: linkNotice, dismissNotice } = useRoomLinks(room);

  const handleTakeScreenshot = useCallback(async () => {
    if (window.electronAPI && typeof window.electronAPI.captureWindowToClipboard === 'function') {
      try {
        const success = await window.electronAPI.captureWindowToClipboard();
        if (success) {
          setScreenshotMsg('Print da janela do MLab copiado para a área de transferência!');
        } else {
          setScreenshotMsg('Não foi possível capturar a janela do MLab.');
        }
      } catch {
        setScreenshotMsg('Erro ao capturar a janela do MLab.');
      }
    }
  }, []);

  useEffect(() => {
    if (screenshotMsg) {
      const timer = setTimeout(() => setScreenshotMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [screenshotMsg]);

  // Imagem estática atual para o modo Tela Cheia
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null);

  // Estados da Sidebar retrátil, Chat, Alunos e Arquivos
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'students' | 'files'>('chat');
  const [publicChatInput, setPublicChatInput] = useState<string>('');
  const [privateChatInput, setPrivateChatInput] = useState<string>('');
  const [targetStudent, setTargetStudent] = useState<{ id: string; name: string; student_id?: string } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sub-aba de Chat: público vs privado
  const [chatSubTab, setChatSubTab] = useState<'public' | 'private'>('public');

  // ── Ferramentas de Marcação (Estilo PDF) e Lupa / Foco ─────────────────────
  const [activeTool, setActiveTool] = useState<AnnotationTool>('cursor');
  const [strokeColor, setStrokeColor] = useState<string>('#ef4444');
  const [strokeSize, setStrokeSize] = useState<number>(4);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<AnnotationStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<AnnotationStroke | null>(null);
  const [showPalettePopover, setShowPalettePopover] = useState<boolean>(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState<boolean>(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightState>({
    enabled: false,
    x: 0.5,
    y: 0.5,
    radius: 0.14,
    zoom: 1,
    activeInViewer: false,
  });
  const spotlightCoordsRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const rafRoomCanvasDrawRef = useRef<number>(0);
  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const annotationToolbarRef = useRef<HTMLDivElement | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const hadCanvasDrawRef = useRef<boolean>(false);
  const isDraggingToolbarRef = useRef<boolean>(false);
  const dragToolbarMovedRef = useRef<boolean>(false);
  const syncingFromExternalRef = useRef<boolean>(false);
  const roomCtrlReleaseTimeRef = useRef<number>(0);
  const roomOtherKeyDuringCtrlRef = useRef<boolean>(false);

  const ANNOTATION_COLORS = [
    { hex: '#ef4444', name: 'Vermelho' },
    { hex: '#facc15', name: 'Amarelo (Marca-texto)' },
    { hex: '#38bdf8', name: 'Azul' },
    { hex: '#22c55e', name: 'Verde' },
    { hex: '#c084fc', name: 'Roxo' },
    { hex: '#ffffff', name: 'Branco' },
  ];

  const handleToggleToolbarCollapse = useCallback(() => {
    if (isToolbarCollapsed && dragToolbarMovedRef.current) {
      dragToolbarMovedRef.current = false;
      return;
    }
    dragToolbarMovedRef.current = false;
    setShowPalettePopover(false);
    setIsToolbarCollapsed((prev) => !prev);
  }, [isToolbarCollapsed]);

  const handleStartDragToolbar = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const container = previewAreaRef.current;
      const containerRect = container
        ? container.getBoundingClientRect()
        : { left: 0, top: 0, width: 1280, height: 720 };
      const effectiveW = containerRect.width > 0 ? containerRect.width : 1280;
      const effectiveH = containerRect.height > 0 ? containerRect.height : 720;

      // Tamanho e posição reais da barra (028, RF-2815): o limite do arraste usa a altura da barra aberta.
      const toolbarRect = annotationToolbarRef.current?.getBoundingClientRect();
      const toolbarSize = {
        width: toolbarRect && toolbarRect.width > 0 ? toolbarRect.width : 48,
        height: toolbarRect && toolbarRect.height > 0 ? toolbarRect.height : 48,
      };
      const currentX = toolbarPos ? toolbarPos.x : toolbarRect ? Math.round(toolbarRect.left - containerRect.left) : 12;
      const currentY = toolbarPos
        ? toolbarPos.y
        : toolbarRect && toolbarRect.height > 0
          ? Math.round(toolbarRect.top - containerRect.top)
          : Math.max(12, Math.round(effectiveH * 0.15));
      const offsetX = e.clientX - containerRect.left - currentX;
      const offsetY = e.clientY - containerRect.top - currentY;

      isDraggingToolbarRef.current = true;
      dragToolbarMovedRef.current = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingToolbarRef.current) return;
        const rawX = moveEvent.clientX - containerRect.left - offsetX;
        const rawY = moveEvent.clientY - containerRect.top - offsetY;
        const { x: nextX, y: nextY } = clampAnnotationToolbarPosition(
          { x: rawX, y: rawY },
          { width: effectiveW, height: effectiveH },
          toolbarSize,
        );
        if (Math.abs(nextX - currentX) > 3 || Math.abs(nextY - currentY) > 3) {
          dragToolbarMovedRef.current = true;
        }
        setToolbarPos({ x: nextX, y: nextY });
      };

      const onMouseUp = () => {
        isDraggingToolbarRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('pointermove', onMouseMove);
        window.removeEventListener('pointerup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('pointermove', onMouseMove);
      window.addEventListener('pointerup', onMouseUp);
    },
    [toolbarPos]
  );

  // Mantém a barra de marcação dentro da prévia quando a janela ou a própria barra muda de tamanho
  // (028, RF-2815, issue #89): redimensionar a janela, recolher/expandir a barra.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const container = previewAreaRef.current;
    const toolbar = annotationToolbarRef.current;
    if (!container || !toolbar) return;
    const reclamp = () => {
      const c = container.getBoundingClientRect();
      const t = toolbar.getBoundingClientRect();
      if (c.width <= 0 || c.height <= 0) return;
      setToolbarPos((prev) => {
        if (!prev) return prev;
        const next = clampAnnotationToolbarPosition(
          prev,
          { width: c.width, height: c.height },
          { width: t.width, height: t.height },
        );
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
    };
    const observer = new ResizeObserver(reclamp);
    observer.observe(container);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [isLiveSession]);

  const handleSelectTool = useCallback((tool: AnnotationTool) => {
    setActiveTool(tool);
    setShowPalettePopover(false);
    // EXCLUSIVIDADE: Desativa a Lupa ao selecionar qualquer ferramenta de desenho ou cursor
    setSpotlight((prev) => ({
      ...prev,
      enabled: false,
    }));
    if (tool === 'highlighter' && strokeColor === '#ef4444') {
      setStrokeColor('#facc15');
    } else if (tool === 'pen' && strokeColor === '#facc15') {
      setStrokeColor('#ef4444');
    }
  }, [strokeColor]);

  const handleToggleSpotlight = useCallback(() => {
    setShowPalettePopover(false);
    setSpotlight((prev) => {
      const willEnable = !prev.enabled;
      if (willEnable) {
        // EXCLUSIVIDADE: Ao ativar a Lupa, passa a ferramenta ativa para 'cursor'
        // garantindo que apenas a Lupa fique destacada na barra
        setActiveTool('cursor');
      }
      return {
        ...prev,
        enabled: willEnable,
      };
    });
  }, []);

  const handleCycleSpotlightZoom = useCallback(() => {
    setSpotlight((prev) => {
      const nextZoom: 1 | 1.5 | 2 = prev.zoom === 1 ? 1.5 : prev.zoom === 1.5 ? 2 : 1;
      return {
        ...prev,
        zoom: nextZoom,
      };
    });
  }, []);

  const handleUndoAnnotation = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStrokes((rPrev) => [...rPrev, last]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedoAnnotation = useCallback(() => {
    setRedoStrokes((rPrev) => {
      if (rPrev.length === 0) return rPrev;
      const restored = rPrev[rPrev.length - 1];
      setStrokes((prev) => [...prev, restored]);
      return rPrev.slice(0, -1);
    });
  }, []);

  const handleClearAnnotations = useCallback(() => {
    setStrokes([]);
    setRedoStrokes([]);
    setActiveStroke(null);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return;
    try {
      if (window.electronAPI && typeof window.electronAPI.copyToClipboard === 'function') {
        await window.electronAPI.copyToClipboard(text);
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  }, []);

  const handleCopyMdns = useCallback(async () => {
    const link = links.mdnsLink;
    if (!link) return;
    await copyToClipboard(link);
    setCopiedMdns(true);
    setTimeout(() => setCopiedMdns(false), 2000);
  }, [copyToClipboard, links.mdnsLink]);

  const handleCopyIp = useCallback(async () => {
    const link = links.ipLink || links.link;
    if (!link) return;
    await copyToClipboard(link);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  }, [copyToClipboard, links.ipLink, links.link]);

  const {
    captureMode,
    setCaptureMode,
    sources,
    selectedSource,
    stream,
    micMuted,
    systemAudioMuted,
    videoPaused,
    hasPermissions,
    loadSources,
    refreshSources,
    selectSource,
    toggleMicMute,
    toggleSystemAudio,
    toggleVideoPause,
    stopCapture,
    setTargetFps,
  } = useScreenCapture('screen');

  // Fonte ativa no setup derivada sincronamente para evitar condição de corrida em testes/CI
  const currentSource = useMemo(() => {
    if (captureMode === 'screen') {
      return (
        tentativeSource ||
        sources.find((s) => s.type === 'screen' || s.id.startsWith('screen')) ||
        (sources.length > 0 ? sources[0] : null)
      );
    }
    // No modo window:
    const windowSources = sources.filter((s) => s.type === 'window' || s.id.startsWith('window'));
    if (selectedWindowSources.length > 0) {
      if (tentativeSource && selectedWindowSources.some((s) => s.id === tentativeSource.id)) {
        return tentativeSource;
      }
      return selectedWindowSources[0];
    }
    if (
      tentativeSource &&
      (tentativeSource.type === 'window' || tentativeSource.id.startsWith('window'))
    ) {
      return tentativeSource;
    }
    return windowSources.length > 0 ? windowSources[0] : (sources.length > 0 ? sources[0] : null);
  }, [captureMode, tentativeSource, sources, selectedWindowSources]);

  const handleSelectQuality = useCallback((profile: '1080p_30' | '1080p_60') => {
    setQualityProfile(profile);
    const fps = profile === '1080p_60' ? 60 : 30;
    setTargetFps(fps);
  }, [setTargetFps]);

  // Atualiza periodicamente as janelas durante o setup pré-transmissão quando no modo janela
  useEffect(() => {
    if (isLiveSession || captureMode !== 'window') return;
    const interval = setInterval(() => {
      refreshSources();
    }, 3000);
    return () => clearInterval(interval);
  }, [isLiveSession, captureMode, refreshSources]);

  const {
    status: recordingStatus,
    formattedDuration,
    savedFilePath,
    isSaving,
    error: recordError,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useLocalRecorder({ stream });

  const token = getStoredToken();

  // Fila de envio de arquivos: botão e zona de soltar da aba Arquivos (018, RF-183 a RF-189)
  const handleFileUploaded = useCallback((file: any) => {
    setUploadedFiles((prev) => [...prev, file]);
  }, []);
  const {
    items: uploadItems,
    enqueue: enqueueUploads,
    dismiss: dismissUpload,
    isUploading,
  } = useRoomFileUploads({ roomId: room?.id, token: token ?? '', onUploaded: handleFileUploaded });

  const {
    isPublishing,
    connectionState,
    error: publisherError,
    messages = [],
    participants = [],
    lastHandRaised,
    dismissHandToast,
    lowerStudentHand,
    sendChatMessage,
    pinChatMessage = () => {},
    sendStreamPause,
    startPublishing,
    changeStream,
    endSession,
  } = useWebRTCPublisher({
    roomId: room.id,
    stream,
    token,
    targetFps: qualityProfile === '1080p_60' ? 60 : 30,
  });

  const prevMessagesLength = useRef(messages.length);
  const publicChatEndRef = useRef<HTMLDivElement>(null);
  const privateChatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para descer o chat quando novas mensagens forem adicionadas
  useEffect(() => {
    if (sidebarTab === 'chat') {
      if (chatSubTab === 'public') {
        publicChatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
      } else {
        privateChatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
      }
    }
  }, [messages.length, sidebarTab, chatSubTab, isSidebarOpen]);

  // Auto-scroll da lista "Arquivos Compartilhados Nesta Aula", no mesmo padrão do chat (018/RF-191)
  const uploadedFilesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sidebarTab === 'files') {
      uploadedFilesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [uploadedFiles.length, sidebarTab, isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen && messages.length > prevMessagesLength.current) {
      setUnreadCount((prev) => prev + (messages.length - prevMessagesLength.current));
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isSidebarOpen]);

  // Ativa setContentProtection(true) na montagem da sala para evitar que o MLab apareça
  // nas miniaturas ou na transmissão em Tela Cheia, restaurando false apenas ao sair da sala.
  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.setContentProtection === 'function') {
      window.electronAPI.setContentProtection(true).catch(() => {});
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditable && e.key !== 'PrintScreen' && e.key !== 'F10') {
        return;
      }
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F10' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's'))
      ) {
        e.preventDefault();
        handleTakeScreenshot();
      }
    };

    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keyup', handleKeyUp);
      if (window.electronAPI && typeof window.electronAPI.setContentProtection === 'function') {
        window.electronAPI.setContentProtection(false).catch(() => {});
      }
      setAnnotationOverlayState({
        strokes: [],
        activeStroke: null,
        spotlight: {
          enabled: false,
          x: 0.5,
          y: 0.5,
          radius: 0.14,
          zoom: 1,
          activeInViewer: false,
        },
      });
    };
  }, [handleTakeScreenshot]);

  // Atalhos de teclado para as ferramentas de Marcação (estilo PDF) e Lupa na sessão ao vivo
  useEffect(() => {
    if (!isLiveSession) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditable) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndoAnnotation();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        handleRedoAnnotation();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'x' || e.key === 'X')) ||
        e.key === 'Delete'
      ) {
        e.preventDefault();
        handleClearAnnotations();
        return;
      }

      // Detecção de Duplo Toque no Ctrl (Double-tap Ctrl local)
      const isCtrlKey = e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight';
      if (isCtrlKey) {
        const now = Date.now();
        const delta = now - roomCtrlReleaseTimeRef.current;
        if (
          roomCtrlReleaseTimeRef.current > 0 &&
          delta <= 600 &&
          !roomOtherKeyDuringCtrlRef.current
        ) {
          roomCtrlReleaseTimeRef.current = 0;
          roomOtherKeyDuringCtrlRef.current = false;
          handleToggleSpotlight();
          return;
        }
        if (delta > 600) {
          roomCtrlReleaseTimeRef.current = 0;
        }
        return;
      }

      // Se outra tecla for pressionada enquanto o Ctrl estiver ativo (ex: Ctrl+C, Ctrl+Z),
      // anula o duplo toque para não disparar a Lupa acidentalmente.
      if (e.ctrlKey || e.metaKey) {
        roomOtherKeyDuringCtrlRef.current = true;
        roomCtrlReleaseTimeRef.current = 0;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();
      if (key === 'escape') {
        e.preventDefault();
        setActiveTool('cursor');
        setShowPalettePopover(false);
        setSpotlight((prev) => ({ ...prev, enabled: false }));
      } else if (key === 'v' || key === '1') {
        e.preventDefault();
        handleSelectTool('cursor');
      } else if (key === 'p' || key === '2') {
        e.preventDefault();
        handleSelectTool('pen');
      } else if (key === 'm' || key === '3') {
        e.preventDefault();
        handleSelectTool('highlighter');
      } else if (key === 'h') {
        e.preventDefault();
        setShowPalettePopover(false);
        handleToggleToolbarCollapse();
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
        handleCycleSpotlightZoom();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isCtrlKey = e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight';
      if (isCtrlKey) {
        if (!roomOtherKeyDuringCtrlRef.current) {
          roomCtrlReleaseTimeRef.current = Date.now();
        } else {
          roomCtrlReleaseTimeRef.current = 0;
        }
        roomOtherKeyDuringCtrlRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isLiveSession,
    handleSelectTool,
    handleToggleToolbarCollapse,
    handleToggleSpotlight,
    handleCycleSpotlightZoom,
    handleUndoAnnotation,
    handleRedoAnnotation,
    handleClearAnnotations,
  ]);

  // Inicia/para a janela de overlay externo de Marcação e Lupa durante a sessão ao vivo
  useEffect(() => {
    if (!isLiveSession) {
      window.electronAPI?.stopAnnotationOverlay?.().catch(() => {});
      return;
    }
    window.electronAPI?.startAnnotationOverlay?.().catch(() => {});
    return () => {
      window.electronAPI?.stopAnnotationOverlay?.().catch(() => {});
    };
  }, [isLiveSession]);

  // Recebe atualizações de estado vindas da barra flutuante externa (fora do MLab)
  useEffect(() => {
    if (!isLiveSession || !window.electronAPI?.onAnnotationStateSync) return;
    const unsubscribe = window.electronAPI.onAnnotationStateSync((nextState) => {
      syncingFromExternalRef.current = true;
      setActiveTool(nextState.activeTool);
      setStrokeColor(nextState.strokeColor);
      setStrokeSize(nextState.strokeSize);
      setStrokes(nextState.strokes);
      setRedoStrokes(nextState.redoStrokes);
      setActiveStroke(nextState.activeStroke);
      setSpotlight(nextState.spotlight);
      const nextCollapsed =
        typeof nextState.collapsed === 'boolean'
          ? nextState.collapsed
          : typeof (nextState as any).isToolbarCollapsed === 'boolean'
          ? (nextState as any).isToolbarCollapsed
          : undefined;
      if (typeof nextCollapsed === 'boolean') {
        setIsToolbarCollapsed(nextCollapsed);
      }
      setTimeout(() => {
        syncingFromExternalRef.current = false;
      }, 0);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isLiveSession]);

  // Recebe comandos de atalho global (Alt+Shift+...) acionados mesmo quando o professor está fora do MLab
  useEffect(() => {
    if (!isLiveSession || !window.electronAPI?.onAnnotationShortcutCommand) return;
    const unsubscribe = window.electronAPI.onAnnotationShortcutCommand((cmd: any) => {
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
        handleCycleSpotlightZoom();
      } else if (action === 'undo') {
        handleUndoAnnotation();
      } else if (action === 'redo') {
        handleRedoAnnotation();
      } else if (action === 'clear') {
        handleClearAnnotations();
      } else if (action === 'toggle-collapse') {
        handleToggleToolbarCollapse();
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [
    isLiveSession,
    handleSelectTool,
    handleToggleSpotlight,
    handleCycleSpotlightZoom,
    handleUndoAnnotation,
    handleRedoAnnotation,
    handleClearAnnotations,
    handleToggleToolbarCollapse,
  ]);

  // Envia o estado atual de Marcação e Lupa para a janela de overlay externo via IPC
  useEffect(() => {
    if (!isLiveSession) return;
    if (syncingFromExternalRef.current) {
      syncingFromExternalRef.current = false;
      return;
    }
    window.electronAPI?.syncAnnotationState?.({
      activeTool,
      strokeColor,
      strokeSize,
      strokes,
      redoStrokes,
      activeStroke,
      spotlight,
      collapsed: isToolbarCollapsed,
    });
  }, [
    isLiveSession,
    activeTool,
    strokeColor,
    strokeSize,
    strokes,
    redoStrokes,
    activeStroke,
    spotlight,
    isToolbarCollapsed,
  ]);

  // Renderiza em alta performance no canvas sobreposto do visualizador do professor
  const renderRoomAnnotationCanvas = useCallback(() => {
    const hasContent = strokes.length > 0 || activeStroke !== null || spotlight.enabled;
    if (!hasContent && !hadCanvasDrawRef.current) return;
    hadCanvasDrawRef.current = hasContent;

    const canvas = annotationCanvasRef.current;
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
        ctx.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    strokes.forEach(drawStroke);
    if (activeStroke) {
      drawStroke(activeStroke);
    }

    if (spotlight.enabled) {
      const pos = spotlightCoordsRef.current;
      const cx = (spotlight.activeInViewer ? spotlight.x : pos.x) * w;
      const cy = (spotlight.activeInViewer ? spotlight.y : pos.y) * h;
      const radius = Math.max(36, spotlight.radius * Math.min(w, h));

      ctx.save();
      // Otimização de renderização rápida por quadrantes ao redor da lupa
      ctx.fillStyle = 'rgba(0, 0, 0, 0.74)';
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
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = Math.max(2, 2.5 * (w / 1280));
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes, activeStroke, spotlight.enabled, spotlight.radius, spotlight.activeInViewer, spotlight.x, spotlight.y]);

  // Sincroniza o estado das marcações e da Lupa com o pipeline de vídeo (WebRTC + Gravação)
  useEffect(() => {
    setAnnotationOverlayState({
      strokes,
      activeStroke,
      spotlight,
      captureMode,
      externalOverlayActive: isLiveSession && Boolean(window.electronAPI?.startAnnotationOverlay),
    });
    renderRoomAnnotationCanvas();
  }, [
    strokes,
    activeStroke,
    spotlight.enabled,
    spotlight.radius,
    spotlight.zoom,
    captureMode,
    isLiveSession,
    renderRoomAnnotationCanvas,
  ]);

  // Acompanha a posição do mouse no SO quando a Lupa está ativa desacoplado do estado React (Zero CPU lag)
  useEffect(() => {
    if (!spotlight.enabled) return;
    if (!window.electronAPI || typeof window.electronAPI.onCursorState !== 'function') return;

    const unsub = window.electronAPI.onCursorState((state) => {
      if (state.rect) {
        const nx = Math.min(1, Math.max(0, state.rect.x + state.rect.w * 0.35));
        const ny = Math.min(1, Math.max(0, state.rect.y + state.rect.h * 0.35));
        spotlightCoordsRef.current = { x: nx, y: ny };
        if (!rafRoomCanvasDrawRef.current) {
          rafRoomCanvasDrawRef.current = requestAnimationFrame(() => {
            rafRoomCanvasDrawRef.current = 0;
            renderRoomAnnotationCanvas();
          });
        }
      }
    });
    return () => {
      try {
        unsub();
      } catch {}
      if (rafRoomCanvasDrawRef.current) {
        cancelAnimationFrame(rafRoomCanvasDrawRef.current);
        rafRoomCanvasDrawRef.current = 0;
      }
    };
  }, [spotlight.enabled, renderRoomAnnotationCanvas]);

  const getNormalizedCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return { x: 0.5, y: 0.5 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const eraseStrokesNearPoint = useCallback((pt: AnnotationPoint) => {
    const threshold = 0.03;
    setStrokes((prev) =>
      prev.filter((stroke) => {
        return !stroke.points.some((p) => {
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          return Math.sqrt(dx * dx + dy * dy) <= threshold;
        });
      })
    );
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pt = getNormalizedCanvasPoint(e);

    if (spotlight.enabled) {
      spotlightCoordsRef.current = { x: pt.x, y: pt.y };
      if (!rafRoomCanvasDrawRef.current) {
        rafRoomCanvasDrawRef.current = requestAnimationFrame(() => {
          rafRoomCanvasDrawRef.current = 0;
          renderRoomAnnotationCanvas();
        });
      }
    }

    if (activeTool === 'cursor') return;

    isDrawingRef.current = true;
    if (activeTool === 'eraser') {
      eraseStrokesNearPoint(pt);
      return;
    }

    const newStroke: AnnotationStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool: activeTool,
      color: strokeColor,
      size: strokeSize,
      points: [pt],
    };
    setActiveStroke(newStroke);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getNormalizedCanvasPoint(e);

    if (spotlight.enabled) {
      spotlightCoordsRef.current = { x: pt.x, y: pt.y };
      if (!rafRoomCanvasDrawRef.current) {
        rafRoomCanvasDrawRef.current = requestAnimationFrame(() => {
          rafRoomCanvasDrawRef.current = 0;
          renderRoomAnnotationCanvas();
        });
      }
    }

    if (!isDrawingRef.current) return;

    if (activeTool === 'eraser') {
      eraseStrokesNearPoint(pt);
      return;
    }

    setActiveStroke((prev) => {
      if (!prev) return null;
      if (prev.tool === 'rect' || prev.tool === 'arrow') {
        return {
          ...prev,
          points: [prev.points[0], pt],
        };
      }
      return {
        ...prev,
        points: [...prev.points, pt],
      };
    });
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setActiveStroke((current) => {
      if (current && current.points.length > 0) {
        setStrokes((prev) => [...prev, current]);
        setRedoStrokes([]);
      }
      return null;
    });
  };

  const handleCanvasMouseLeave = () => {
    if (spotlight.enabled) {
      setSpotlight((prev) => ({ ...prev, activeInViewer: false }));
    }
    if (isDrawingRef.current) {
      handleCanvasMouseUp();
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!spotlight.enabled) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.015 : -0.015;
    setSpotlight((prev) => ({
      ...prev,
      radius: Math.min(0.35, Math.max(0.06, prev.radius + delta)),
    }));
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  };

  const handleToggleVideoPause = useCallback(() => {
    const nextPaused = !videoPaused;
    toggleVideoPause();
    if (typeof sendStreamPause === 'function') {
      sendStreamPause(nextPaused);
    }
  }, [videoPaused, toggleVideoPause, sendStreamPause]);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.muted = true;
      videoRef.current.volume = 0;
      videoRef.current.srcObject = stream;
      const playPromise = videoRef.current.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }
  }, [stream, isLiveSession]);

  // Auto-seleciona a tela principal ou janela inicial sempre que fontes carregarem
  useEffect(() => {
    if (sources.length > 0) {
      if (captureMode === 'screen') {
        const primary =
          sources.find((s) => s.type === 'screen' || s.id.startsWith('screen')) || sources[0];
        if (!tentativeSource || tentativeSource.type !== 'screen') {
          setTentativeSource(primary);
        }
      } else if (captureMode === 'window') {
        const windowSources = sources.filter(
          (s) => s.type === 'window' || s.id.startsWith('window')
        );
        if (windowSources.length > 0) {
          setSelectedWindowSources((prev) => {
            const valid = prev.filter((p) => windowSources.some((s) => s.id === p.id));
            if (valid.length > 0) return valid;
            return [windowSources[0]];
          });
        }
      }
    }
  }, [sources, captureMode]);

  const handleToggleWindowSelection = useCallback((src: CaptureSource) => {
    setSelectedWindowSources((prev) => {
      const exists = prev.some((s) => s.id === src.id);
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((s) => s.id !== src.id);
      } else {
        return [...prev, src];
      }
    });
  }, []);

  // Rastreamento dinâmico de foco para Múltiplas Janelas na sessão ao vivo
  useEffect(() => {
    if (!isLiveSession || captureMode !== 'window' || !window.electronAPI) return;

    const unsubChanged = window.electronAPI.onActiveWindowChanged?.(async (data: { sourceId: string }) => {
      const targetSrc = selectedWindowSources.find((s) => s.id === data.sourceId);
      if (!targetSrc || targetSrc.id === currentActiveWindowSourceRef.current?.id) return;
      currentActiveWindowSourceRef.current = targetSrc;
      setActiveWindowSource(targetSrc);

      const fps = qualityProfile === '1080p_60' ? 60 : 30;
      const newStream = await selectSource(targetSrc, fps, selectedWindowSources.map((s) => s.id));
      if (newStream) {
        await changeStream(newStream);
      }
    });

    return () => {
      if (typeof unsubChanged === 'function') unsubChanged();
    };
  }, [isLiveSession, captureMode, selectedWindowSources, qualityProfile, selectSource, changeStream]);

  useEffect(() => {
    const thumb = selectedSource?.thumbnail || currentSource?.thumbnail;
    if (thumb) {
      setCurrentThumbnail(thumb);
    }
  }, [selectedSource?.thumbnail, currentSource?.thumbnail]);

  const handleRefreshScreenCapture = useCallback(async () => {
    try {
      if (window.electronAPI && typeof window.electronAPI.getScreenSources === 'function') {
        const freshSources = await window.electronAPI.getScreenSources('screen');
        const activeId = selectedSource?.id || currentSource?.id;
        const matched = freshSources.find((s) => s.id === activeId) || freshSources[0];
        if (matched?.thumbnail) {
          setCurrentThumbnail(matched.thumbnail);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar captura de tela:', err);
    }
  }, [selectedSource?.id, currentSource?.id]);

  // Evita chamar desktopCapturer.getSources() automaticamente no evento focus durante a transmissão ao vivo,
  // pois enumerar e gerar miniaturas de todas as telas via DWM/WGC causa micro-travamento na captura de vídeo ativa.
  void handleRefreshScreenCapture;

  // Identifica telas/monitores disponíveis para alternância rápida
  const screenSources = sources.filter((s) => s.type === 'screen' || s.id.startsWith('screen'));

  const handleSwitchScreen = useCallback(async (source: CaptureSource) => {
    if (window.electronAPI && typeof window.electronAPI.setContentProtection === 'function') {
      await window.electronAPI.setContentProtection(true).catch(() => {});
    }
    const fps = qualityProfile === '1080p_60' ? 60 : 30;
    const allowedIds =
      captureMode === 'window' && selectedWindowSources.length > 0
        ? selectedWindowSources.map((s) => s.id)
        : undefined;
    const newStream = await selectSource(source, fps, allowedIds);
    if (source.thumbnail) {
      setCurrentThumbnail(source.thumbnail);
    }
    setActiveWindowSource(source);
    currentActiveWindowSourceRef.current = source;

    if (newStream) {
      if (micMuted) {
        newStream.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
      await changeStream(newStream);
    }
  }, [selectSource, micMuted, changeStream, qualityProfile, captureMode, selectedWindowSources]);

  // Carrega arquivos iniciais da sala
  useEffect(() => {
    if (!room?.id) return;
    fetch(`http://localhost:8080/rooms/${room.id}/files`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setUploadedFiles(data);
        }
      })
      .catch((err) => console.warn('Erro ao carregar arquivos da sala:', err));
  }, [room?.id, token]);

  // Feedback de arquivo salvo
  useEffect(() => {
    if (savedFilePath) {
      setSaveSuccessMsg(`Gravação salva com sucesso em: ${savedFilePath}`);
      const timer = setTimeout(() => setSaveSuccessMsg(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [savedFilePath]);

  // Avançar e Iniciar Transmissão
  const handleStartSession = useCallback(async () => {
    const sourceToUse = currentSource;
    if (!sourceToUse) return;

    if (sourceToUse.thumbnail) {
      setCurrentThumbnail(sourceToUse.thumbnail);
    }

    // 1º Ativa a proteção no DWM ANTES de iniciar a sessão WGC para evitar E_FAIL (-2147467259)
    if (window.electronAPI && typeof window.electronAPI.setContentProtection === 'function') {
      await window.electronAPI.setContentProtection(true).catch(() => {});
    }

    const fps = qualityProfile === '1080p_60' ? 60 : 30;
    const allowedIds =
      captureMode === 'window' && selectedWindowSources.length > 0
        ? selectedWindowSources.map((s) => s.id)
        : undefined;

    const activeStream = await selectSource(sourceToUse, fps, allowedIds);
    if (!activeStream) {
      if (window.electronAPI && typeof window.electronAPI.setContentProtection === 'function') {
        window.electronAPI.setContentProtection(false).catch(() => {});
      }
      return;
    }

    setActiveWindowSource(sourceToUse);
    currentActiveWindowSourceRef.current = sourceToUse;

    setIsLiveSession(true);

    // Sincroniza o estado de áudio (microfone e som do sistema) com base no estado atual configurado pelo professor
    if (activeStream) {
      const isAudioActive = !micMuted || !systemAudioMuted;
      activeStream.getAudioTracks().forEach((track) => {
        track.enabled = isAudioActive;
      });
    }

    // Se optou por gravar, inicia gravação local
    if (wantRecord) {
      startRecording('webm', activeStream || undefined);
    }

    if (activeStream) {
      // Se já estiver publicando ativamente, substitui o track sem reconexão para manter os alunos conectados
      if (isPublishing && connectionState === 'connected') {
        const replaced = await changeStream(activeStream);
        if (!replaced) {
          startPublishing(activeStream);
        }
      } else {
        startPublishing(activeStream);
      }
    }
  }, [
    currentSource,
    selectSource,
    qualityProfile,
    captureMode,
    selectedWindowSources,
    wantRecord,
    startRecording,
    isPublishing,
    connectionState,
    changeStream,
    startPublishing,
    micMuted,
    systemAudioMuted,
  ]);

  const handleEndSession = useCallback(async () => {
    if (wantRecord && recordingStatus === 'recording') {
      try {
        await stopRecording();
      } catch (err) {
        console.warn('Erro ao aguardar gravação ser salva:', err);
      }
    }
    if (room?.id) {
      closeRoom(room.id).catch((err) => {
        console.warn('Erro ao encerrar sala na API:', err);
      });
      if (window.electronAPI && typeof window.electronAPI.setActiveRoom === 'function') {
        window.electronAPI.setActiveRoom(null);
      }
    }
    if (window.electronAPI && typeof window.electronAPI.setContentProtection === 'function') {
      window.electronAPI.setContentProtection(false).catch(() => {});
    }
    endSession();
    stopCapture();
    onCloseRoom();
  }, [wantRecord, recordingStatus, stopRecording, endSession, stopCapture, onCloseRoom, room?.id]);

  const handleReconfigure = useCallback(() => {
    setIsLiveSession(false);
    // Mantém setContentProtection(true) ativo durante a troca de modo/fonte para que
    // a janela do MLab nunca apareça na transmissão de Tela Cheia para os alunos.
    if (window.electronAPI && typeof window.electronAPI.setContentProtection === 'function') {
      window.electronAPI.setContentProtection(true).catch(() => {});
    }
  }, []);

  const handleSendPublicChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicChatInput.trim()) return;
    if (typeof sendChatMessage === 'function') {
      sendChatMessage(publicChatInput.trim(), false, undefined);
    }
    setPublicChatInput('');
  };

  const handleSendPrivateChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateChatInput.trim()) return;

    let target = targetStudent;
    if (!target) {
      if (studentsOnly.length === 1) {
        const onlyStudent = studentsOnly[0];
        target = {
          id: onlyStudent.participant_id || onlyStudent.id,
          name: onlyStudent.name,
          student_id: onlyStudent.student_id,
        };
        setTargetStudent(target);
      } else if (studentsOnly.length > 1) {
        alert('Por favor, selecione qual aluno receberá esta mensagem privada no menu acima.');
        return;
      } else {
        alert('Nenhum aluno conectado no momento para receber a mensagem privada.');
        return;
      }
    }

    if (typeof sendChatMessage === 'function' && target) {
      sendChatMessage(privateChatInput.trim(), true, target.id);
    }
    setPrivateChatInput('');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      enqueueUploads(Array.from(files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadStatusLabel = (item: UploadItem): string => {
    switch (item.status) {
      case 'aguardando':
        return 'Aguardando';
      case 'enviando':
        return 'Enviando...';
      case 'enviado':
        return 'Enviado';
      default:
        return item.error || 'Erro ao enviar arquivo';
    }
  };

  const studentsOnly = participants.filter((p: any) => p.role === 'aluno');
  const raisedHandsStudents = studentsOnly
    .filter((s: any) => s.hand_raised || s.handRaised)
    .sort((a: any, b: any) => {
      const timeA = new Date(a.hand_raised_at || a.handRaisedAt || 0).getTime();
      const timeB = new Date(b.hand_raised_at || b.handRaisedAt || 0).getTime();
      return timeA - timeB;
    });
  const raisedHandsCount = raisedHandsStudents.length;

  // 017/RF-176, RF-179: leva à barra de marcação (fora do MLab) só a quantidade de mãos levantadas da fila.
  useEffect(() => {
    if (!isLiveSession) return;
    window.electronAPI?.setAnnotationRaisedHands?.(raisedHandsCount)?.catch(() => {});
  }, [isLiveSession, raisedHandsCount]);

  const professorName = typeof window !== 'undefined' ? sessionStorage.getItem('professor_name') : null;

  return (
    <div style={styles.container}>
      {/* Cabeçalho */}
      <header style={styles.header}>
        <div style={styles.headerTitleBox}>
          <BrandMark size={32} title="MLab" />
          <h2 style={styles.title}>{professorName ? `Prof. ${professorName.charAt(0).toUpperCase() + professorName.slice(1)}` : `Sala: ${room.slug}`}</h2>
          {isLiveSession && (
            <>
              <span className={`ml-status ${videoPaused ? 'ml-status--wait' : 'ml-status--live'}`} role="status">
                {videoPaused ? 'Pausada' : 'No ar'}
              </span>
              {wantRecord && recordingStatus === 'recording' && (
                <span className="ml-status ml-status--rec">
                  Gravando <span style={styles.mono}>{formattedDuration} (.webm)</span>
                </span>
              )}
              {wantRecord && recordingStatus === 'paused' && (
                <span className="ml-status ml-status--wait">
                  Gravação pausada <span style={styles.mono}>{formattedDuration}</span>
                </span>
              )}
              {wantRecord && recordingStatus === 'stopped' && (
                <span className="ml-status ml-status--plain">Gravação finalizada</span>
              )}
              <span className="ml-status ml-status--plain">
                <UserMultiple size={14} /> {studentsOnly.length} {studentsOnly.length === 1 ? 'aluno' : 'alunos'}
              </span>
              <span className="ml-status ml-status--plain" style={styles.mono}>
                {qualityProfile === '1080p_60' ? '1080p @ 60fps' : '1080p @ 30fps'}
              </span>
            </>
          )}
        </div>
        <div style={styles.headerLinks}>
          {/* Link direto (mDNS): só com anúncio ativo */}
          {links.mdnsLink && (
          <div style={styles.headerLinkItem}>
            <span style={styles.headerLinkLabel}>Link direto</span>
            <span style={styles.roomLinkStatic}>{links.mdnsLink}</span>
            <IconButton
              type="button"
              variant={copiedMdns ? 'success' : 'ghost'}
              size="sm"
              onClick={handleCopyMdns}
              title={copiedMdns ? 'Link Fixo Copiado' : 'Copiar Link Fixo'}
              aria-label="Copiar Link Fixo"
            >
              {copiedMdns ? <Checkmark size={16} /> : <Copy size={16} />}
            </IconButton>
          </div>
          )}

          {/* Link pelo IP */}
          <div style={styles.headerLinkItem}>
            <span style={styles.headerLinkLabel}>Link pelo IP</span>
            <span style={styles.roomLinkStatic}>{links.ipLink || links.link}</span>
            <IconButton
              type="button"
              variant={copiedIp ? 'success' : 'ghost'}
              size="sm"
              onClick={handleCopyIp}
              title={copiedIp ? 'Link IP Copiado' : 'Copiar Link Direto IP'}
              aria-label="Copiar Link Direto IP"
            >
              {copiedIp ? <Checkmark size={16} /> : <Copy size={16} />}
            </IconButton>
          </div>
        </div>
        <div style={styles.headerActions}>
          <ThemeToggle />
          <span style={styles.headerSep} />
          <button
            onClick={handleEndSession}
            className="ml-btn ml-btn--danger-quiet"
            disabled={isSaving}
          >
            <Exit size={18} /> {isSaving ? 'Salvando Gravação...' : 'Encerrar transmissão'}
          </button>
        </div>
      </header>

      {linkNotice && (
        <Alert variant="warning" message={linkNotice} onClose={dismissNotice} style={{ margin: '8px 16px 0' }} />
      )}

      {screenshotMsg && (
        <div style={styles.screenshotSuccessBanner}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Checkmark size={16} /> {screenshotMsg}
          </span>
        </div>
      )}

      {hasPermissions === false && (
        <div style={styles.permissionAlert}>
          <span>Atenção: Permissões de gravação de tela ou microfone não foram detectadas no Sistema Operacional.</span>
          <button
            onClick={() => loadSources(captureMode)}
            style={styles.retryPermBtn}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Renew size={14} /> Verificar Novamente</span>
          </button>
        </div>
      )}

      {publisherError && (
        <div style={styles.errorBanner}>
          Erro na publicação WebRTC: {publisherError}
        </div>
      )}

      {recordError && (
        <div style={styles.errorBanner}>
          Erro na gravação local: {recordError}
        </div>
      )}

      {saveSuccessMsg && (
        <div style={styles.successBanner}>
          {saveSuccessMsg}
        </div>
      )}

      <main style={isLiveSession ? styles.mainContentLive : styles.mainContent}>
        {!isLiveSession ? (
          /* ── ETAPA DE SETUP GUIADO (PRÉ-TRANSMISSÃO) ── */
          <div style={styles.setupCard}>
            <div>
              <h1 style={styles.setupHeader}>Preparar aula</h1>
              <p style={styles.setupSub}>Tudo nesta página pode ser mudado depois, com a aula em andamento.</p>
            </div>

            {/* O que transmitir */}
            <section style={styles.sectionBox} aria-labelledby="prep-fonte">
              <div style={styles.sectionHeaderRow}>
                <div>
                  <h2 id="prep-fonte" style={styles.sectionTitle}>O que transmitir</h2>
                  <p style={styles.sectionDesc}>Tela inteira mostra tudo, inclusive notificações. Janelas escolhidas protegem o resto.</p>
                </div>
                <div className="ml-segmented">
                  <button
                    type="button"
                    className={captureMode === 'screen' ? 'is-on' : undefined}
                    aria-pressed={captureMode === 'screen'}
                    title="Tela inteira (acompanha tudo o que aparece no monitor)"
                    onClick={() => {
                      setCaptureMode('screen');
                      const primary = sources.find((s) => s.type === 'screen') || sources[0] || null;
                      setTentativeSource(primary);
                    }}
                  >
                    <Screen size={16} /> Tela inteira
                  </button>
                  <button
                    type="button"
                    className={captureMode === 'window' ? 'is-on' : undefined}
                    aria-pressed={captureMode === 'window'}
                    title="Janelas escolhidas (uma ou mais janelas; o resto fica protegido)"
                    onClick={() => {
                      setCaptureMode('window');
                      setTentativeSource(null);
                      const windowSources = sources.filter(
                        (s) => s.type === 'window' || s.id.startsWith('window')
                      );
                      if (windowSources.length > 0) {
                        setSelectedWindowSources([windowSources[0]]);
                      } else {
                        setSelectedWindowSources([]);
                      }
                    }}
                  >
                    <Application size={16} /> Janelas escolhidas
                  </button>
                </div>
              </div>

              {captureMode === 'screen' ? (
                <>
                  <div style={styles.sourceGrid} role="radiogroup" aria-label="Monitor">
                    {sources.length === 0 ? (
                      <div className="ml-choice" style={styles.sourceCard}>
                        <div style={styles.thumbPlaceholder}><Screen size={32} /></div>
                        <div style={styles.sourceMeta}><span style={styles.sourceName}>{currentSource?.name || 'Monitor Principal'}</span></div>
                      </div>
                    ) : (
                      sources.map((src) => {
                        const isSelected = currentSource?.id === src.id;
                        return (
                          <div
                            key={src.id}
                            className="ml-choice ml-brackets"
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => setTentativeSource(src)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setTentativeSource(src);
                              }
                            }}
                            style={styles.sourceCard}
                          >
                            {src.thumbnail ? (
                              <img src={src.thumbnail} alt="" style={styles.thumbnail} />
                            ) : (
                              <div style={styles.thumbPlaceholder}><Screen size={32} /></div>
                            )}
                            <div style={styles.sourceMeta}>
                              <span style={styles.sourceName}>{src.name}</span>
                              <span style={isSelected ? styles.radioDotOn : styles.radioDot} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p style={styles.sourceNote}>
                    <Checkmark size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      Selecionado automaticamente. A tela inteira será transmitida em alta resolução: navegação, trocas de
                      aplicativos e menus do sistema aparecem em tempo real para os alunos.
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <div className="ml-banner ml-banner--info">
                    <Idea size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div><strong style={{ display: 'inline' }}>Dica:</strong> Certifique-se de que a janela ou navegador esteja aberto na Área de Trabalho (não minimizado na barra de tarefas) para que seja listado.</div>
                  </div>

                  <div style={styles.sourceGrid} role="group" aria-label="Janelas que podem aparecer">
                    {sources.length === 0 ? (
                      <p style={styles.noSources}>Nenhuma janela detectada. Certifique-se de que a janela desejada não está minimizada.</p>
                    ) : (
                      sources.map((src) => {
                        const isSelected = selectedWindowSources.some((s) => s.id === src.id);
                        return (
                          <div
                            key={src.id}
                            className="ml-choice ml-brackets"
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onClick={() => handleToggleWindowSelection(src)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleToggleWindowSelection(src);
                              }
                            }}
                            style={styles.sourceCard}
                            title={isSelected ? 'Clique para desmarcar esta janela' : 'Clique para autorizar esta janela'}
                          >
                            <img src={src.thumbnail} alt="" style={styles.thumbnail} />
                            <div style={styles.sourceMeta}>
                              <span style={styles.sourceName}>{src.name}</span>
                              <span style={isSelected ? styles.windowCheckboxChecked : styles.windowCheckbox}>
                                {isSelected ? <Checkmark size={14} /> : null}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={styles.multiWindowBar}>
                    <span style={styles.multiWindowHint}>
                      <strong style={{ color: 'var(--text-1)' }}>
                        {selectedWindowSources.length} {selectedWindowSources.length === 1 ? 'janela autorizada' : 'janelas autorizadas'}
                      </strong>
                      . O MLab transmite a janela autorizada que você estiver usando. Aplicativos não selecionados (ex: WhatsApp, e-mails pessoais) ficam ocultos e protegidos.
                    </span>
                    <div style={styles.multiWindowBarActions}>
                      <button
                        type="button"
                        className="ml-btn ml-btn--ghost ml-btn--sm"
                        onClick={() => setSelectedWindowSources([...sources])}
                        title="Autorizar todas as janelas abertas"
                      >
                        Selecionar Todas
                      </button>
                      {selectedWindowSources.length > 1 && (
                        <button
                          type="button"
                          className="ml-btn ml-btn--ghost ml-btn--sm"
                          onClick={() => setSelectedWindowSources(sources.length > 0 ? [sources[0]] : [])}
                          title="Transmitir apenas a primeira janela"
                        >
                          Apenas a Primeira
                        </button>
                      )}
                      <button
                        type="button"
                        className="ml-btn ml-btn--ghost ml-btn--sm"
                        onClick={refreshSources}
                        title="Atualizar lista de janelas e telas abertas"
                      >
                        <Renew size={16} /> Atualizar Janelas
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Qualidade */}
            <section style={styles.sectionBox} aria-labelledby="prep-qualidade">
              <div>
                <h2 id="prep-qualidade" style={styles.sectionTitle}>Qualidade</h2>
                <p style={styles.sectionDesc}>Escolha pelo tipo de conteúdo da aula.</p>
              </div>
              <div style={styles.qualitySelectorGrid} role="radiogroup" aria-labelledby="prep-qualidade">
                <div
                  className="ml-choice"
                  onClick={() => handleSelectQuality('1080p_30')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectQuality('1080p_30');
                    }
                  }}
                  role="radio"
                  aria-checked={qualityProfile === '1080p_30'}
                  tabIndex={qualityProfile === '1080p_30' ? 0 : -1}
                >
                  <span className="ml-choice__title">Texto e código</span>
                  <span className="ml-choice__desc">Prioriza a nitidez das letras, sem rebaixar a resolução. Ideal para editor, terminal e slides.</span>
                  <span style={styles.qualitySpec}>1080p Full HD @ 30 fps, 4.0 Mbps</span>
                </div>

                <div
                  className="ml-choice"
                  onClick={() => handleSelectQuality('1080p_60')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectQuality('1080p_60');
                    }
                  }}
                  role="radio"
                  aria-checked={qualityProfile === '1080p_60'}
                  tabIndex={qualityProfile === '1080p_60' ? 0 : -1}
                >
                  <span className="ml-choice__title">Vídeo e animação</span>
                  <span className="ml-choice__desc">Movimento mais fluido, a 60 quadros por segundo. Use para vídeos, jogos e simulações.</span>
                  <span style={styles.qualitySpec}>1080p Full HD @ 60 fps, 6.0 Mbps</span>
                </div>
              </div>
            </section>

            {/* Gravação */}
            <section style={styles.sectionBox} aria-labelledby="prep-gravacao">
              <h2 id="prep-gravacao" style={styles.sectionTitle}>Gravação</h2>
              <label className="ml-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={wantRecord}
                  onChange={(e) => setWantRecord(e.target.checked)}
                />
                Gravar a aula neste computador
              </label>
              {wantRecord && (
                <p style={styles.recordNote}>
                  Formato: <span style={styles.qualitySpec}>.webm (Alta Fidelidade em 1080p)</span>. Ao finalizar, você escolhe onde salvar o arquivo.
                </p>
              )}
            </section>
          </div>
        ) : (
          /* ── SESSÃO AO VIVO (TRANSMISSÃO + BARRA + SIDEBAR RETRÁTIL) ── */
          <div style={styles.liveContainer}>
            <div style={styles.liveContentArea}>
              {/* Seção Principal da Transmissão */}
              <div className="ml-on-stage" style={styles.liveMainSection}>
                {/* Rótulo do palco: o que a turma vê */}
                <div style={styles.stageLabel}>
                  O que a turma está vendo agora. Modo: {captureMode === 'screen' ? 'Tela inteira' : (selectedWindowSources.length > 1 ? `Janelas escolhidas (${selectedWindowSources.length} autorizadas)` : 'Janelas escolhidas')} (
                  {activeWindowSource?.name || selectedSource?.name || 'Fonte Ativa'})
                </div>

                {/* Visualizador da Transmissão + Barra Vertical de Marcação e Lupa no Lado Esquerdo */}
                <div className={`ml-brackets ml-brackets--live${videoPaused ? '' : ' is-on'}`} style={styles.stageFrame}>
                <div ref={previewAreaRef} style={styles.previewArea}>
                  {/* Barra Vertical de Marcação (Estilo Editor de PDF) e Lupa — Posicionável e Retrátil */}
                  <div
                    ref={annotationToolbarRef}
                    style={{
                      ...styles.annotationToolbarLeft,
                      ...(toolbarPos
                        ? {
                            left: `${toolbarPos.x}px`,
                            top: `${toolbarPos.y}px`,
                            transform: 'none',
                          }
                        : {}),
                    }}
                    data-testid="annotation-toolbar"
                    data-collapsed={isToolbarCollapsed ? 'true' : 'false'}
                    role="toolbar"
                    aria-label="Ferramentas de Marcação e Lupa"
                  >
                    {isToolbarCollapsed ? (
                      <button
                        type="button"
                        onPointerDown={handleStartDragToolbar}
                        onClick={handleToggleToolbarCollapse}
                        style={styles.annotationCollapsedFabBtn}
                        title="Expandir Ferramentas de Marcação e Lupa (Arraste para posicionar • Atalho: H)"
                        aria-label="Expandir Ferramentas de Marcação"
                        data-testid="tool-btn-collapse"
                      >
                        <Pen size={17} />
                        <span
                          style={{
                            ...styles.colorDotIndicator,
                            backgroundColor: spotlight.enabled ? 'var(--accent)' : strokeColor,
                          }}
                        />
                      </button>
                    ) : (
                      <>
                        {/* Alça de Arrasto + Botão Retrair no Topo da Barra */}
                        <div style={styles.annotationToolbarHeaderRow}>
                          <div
                            onPointerDown={handleStartDragToolbar}
                            style={styles.annotationDragHandle}
                            title="Arraste para posicionar a barra onde preferir"
                            data-testid="annotation-drag-handle"
                          >
                            <Draggable size={13} />
                          </div>
                          <button
                            type="button"
                            onClick={handleToggleToolbarCollapse}
                            style={styles.annotationCollapseMiniBtn}
                            title="Retrair barra em ícone compacto (Atalho: H)"
                            aria-label="Retrair Ferramentas de Marcação"
                            data-testid="tool-btn-collapse"
                          >
                            <ChevronLeft size={13} />
                          </button>
                        </div>

                        <div style={styles.annotationToolbarDivider} />

                        <button
                          type="button"
                          onClick={() => handleSelectTool('cursor')}
                          style={activeTool === 'cursor' ? styles.annotationToolBtnActive : styles.annotationToolBtn}
                          title="Cursor Padrão — Navegação normal (Atalho: V / 1 / Esc)"
                          aria-label="Cursor Padrão"
                          data-testid="tool-btn-cursor"
                        >
                          <Cursor_1 size={16} />
                          <span style={styles.shortcutHintBadge}>V</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectTool('pen')}
                          style={activeTool === 'pen' ? styles.annotationToolBtnActive : styles.annotationToolBtn}
                          title="Pincel / Caneta Livre — Desenhar e circular (Atalho: P / 2)"
                          aria-label="Pincel"
                          data-testid="tool-btn-pen"
                        >
                          <Pen size={16} />
                          <span style={styles.shortcutHintBadge}>P</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectTool('highlighter')}
                          style={activeTool === 'highlighter' ? styles.annotationToolBtnActive : styles.annotationToolBtn}
                          title="Marcador / Marca-Texto PDF — Realçar texto e código (Atalho: M / 3)"
                          aria-label="Marcador"
                          data-testid="tool-btn-highlighter"
                        >
                          <Draw size={16} />
                          <span style={styles.shortcutHintBadge}>M</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectTool('arrow')}
                          style={activeTool === 'arrow' ? styles.annotationToolBtnActive : styles.annotationToolBtn}
                          title="Seta Indicativa — Apontar elemento na tela (Atalho: A / 4)"
                          aria-label="Seta"
                          data-testid="tool-btn-arrow"
                        >
                          <ArrowUpRight size={16} />
                          <span style={styles.shortcutHintBadge}>A</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectTool('rect')}
                          style={activeTool === 'rect' ? styles.annotationToolBtnActive : styles.annotationToolBtn}
                          title="Retângulo de Destaque — Enquadrar área ou bloco (Atalho: R / 5)"
                          aria-label="Retângulo"
                          data-testid="tool-btn-rect"
                        >
                          <SquareOutline size={16} />
                          <span style={styles.shortcutHintBadge}>R</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectTool('eraser')}
                          style={activeTool === 'eraser' ? styles.annotationToolBtnActive : styles.annotationToolBtn}
                          title="Borracha — Apagar marcações tocadas (Atalho: E / B / 6)"
                          aria-label="Borracha"
                          data-testid="tool-btn-eraser"
                        >
                          <Erase size={16} />
                          <span style={styles.shortcutHintBadge}>E</span>
                        </button>

                        <div style={styles.annotationToolbarDivider} />

                        <button
                          type="button"
                          onClick={handleToggleSpotlight}
                          style={spotlight.enabled ? styles.annotationToolBtnSpotlightActive : styles.annotationToolBtn}
                          title="Lupa / Foco no Mouse — Escurece a tela e destaca apenas o ponto do mouse (Atalho: 2 cliques no Ctrl • Tecla L • Scroll ajusta raio • Z alterna zoom)"
                          aria-label="Lupa"
                          data-testid="tool-btn-spotlight"
                        >
                          <ZoomIn size={16} />
                          <span style={styles.shortcutHintBadge}>Ctrl</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPalettePopover((prev) => !prev)}
                          style={showPalettePopover ? styles.annotationToolBtnPaletteOpen : styles.annotationToolBtn}
                          title="Cor da Marcação, Espessura do Traço e Zoom da Lupa (Atalho Zoom: Z)"
                          aria-label="Cores e Espessura"
                          data-testid="tool-btn-palette"
                        >
                          <ColorPalette size={16} />
                          <span
                            style={{
                              ...styles.colorDotIndicator,
                              backgroundColor: strokeColor,
                            }}
                          />
                        </button>

                        <div style={styles.annotationToolbarDivider} />

                        <button
                          type="button"
                          onClick={handleUndoAnnotation}
                          disabled={strokes.length === 0}
                          style={strokes.length === 0 ? styles.annotationToolBtnDisabled : styles.annotationToolBtn}
                          title="Desfazer última marcação (Atalho: Ctrl+Z)"
                          aria-label="Desfazer"
                          data-testid="tool-btn-undo"
                        >
                          <Undo size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={handleRedoAnnotation}
                          disabled={redoStrokes.length === 0}
                          style={redoStrokes.length === 0 ? styles.annotationToolBtnDisabled : styles.annotationToolBtn}
                          title="Refazer marcação (Atalho: Ctrl+Y / Ctrl+Shift+Z)"
                          aria-label="Refazer"
                          data-testid="tool-btn-redo"
                        >
                          <Redo size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={handleClearAnnotations}
                          disabled={strokes.length === 0 && !activeStroke}
                          style={
                            strokes.length === 0 && !activeStroke
                              ? styles.annotationToolBtnDisabled
                              : styles.annotationToolBtnDanger
                          }
                          title="Limpar todas as marcações da tela (Atalho: Ctrl+Shift+X / Delete)"
                          aria-label="Limpar Marcações"
                          data-testid="tool-btn-clear"
                        >
                          <TrashCan size={15} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Popover Flutuante de Cores, Espessura e Nível de Zoom da Lupa */}
                  {showPalettePopover && !isToolbarCollapsed && (
                    <div
                      style={{
                        ...styles.palettePopoverBox,
                        ...(toolbarPos
                          ? {
                              left: `${toolbarPos.x + 54}px`,
                              top: `${toolbarPos.y}px`,
                              transform: 'none',
                            }
                          : {}),
                      }}
                      data-testid="annotation-palette-popover"
                    >
                      <div style={styles.paletteSectionTitle}>Cor da Marcação</div>
                      <div style={styles.paletteColorsRow}>
                        {ANNOTATION_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setStrokeColor(c.hex)}
                            title={c.name}
                            aria-label={`Cor ${c.name}`}
                            style={{
                              ...styles.colorSwatchBtn,
                              backgroundColor: c.hex,
                              border: strokeColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.25)',
                              transform: strokeColor === c.hex ? 'scale(1.15)' : 'scale(1)',
                            }}
                          />
                        ))}
                      </div>

                      <div style={styles.paletteSectionTitle}>Espessura do Traço</div>
                      <div style={styles.paletteSizesRow}>
                        {[
                          { label: 'Fina', value: 3 },
                          { label: 'Média', value: 5 },
                          { label: 'Grossa', value: 9 },
                        ].map((sz) => (
                          <button
                            key={sz.value}
                            type="button"
                            onClick={() => setStrokeSize(sz.value)}
                            style={strokeSize === sz.value ? styles.sizeOptionBtnActive : styles.sizeOptionBtn}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>

                      <div style={styles.paletteSectionTitle}>Zoom da Lupa (Atalho: Z)</div>
                      <div style={styles.paletteSizesRow}>
                        {([1, 1.5, 2] as const).map((zm) => (
                          <button
                            key={zm}
                            type="button"
                            onClick={() => setSpotlight((prev) => ({ ...prev, zoom: zm }))}
                            style={spotlight.zoom === zm ? styles.sizeOptionBtnActive : styles.sizeOptionBtn}
                          >
                            {zm === 1 ? '1x (Foco)' : `${zm}x`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Área Central do Visualizador com Camada de Marcação e Lupa */}
                  <div style={styles.previewStageBox}>
                    {captureMode === 'screen' ? (
                      <div style={styles.staticPreviewBox}>
                        {currentThumbnail || selectedSource?.thumbnail || tentativeSource?.thumbnail ? (
                          <img
                            src={currentThumbnail || selectedSource?.thumbnail || tentativeSource?.thumbnail}
                            alt="Pré-visualização da tela inteira"
                            style={{ ...styles.previewMedia, opacity: videoPaused ? 0.3 : 1 }}
                          />
                        ) : (
                          <div style={styles.screenShieldCard}>
                            <span style={styles.screenShieldIcon}><Screen size={44} /></span>
                            <h3 style={styles.screenShieldTitle}>Sua Tela Inteira está Sendo Transmitida</h3>
                            <p style={styles.screenShieldSubtitle}>
                              A transmissão está ativa e os alunos estão assistindo em tempo real.
                            </p>
                          </div>
                        )}

                        {/* Badge Informativo Estático */}
                        <div style={styles.staticOverlayBadge}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Screen size={14} /> Tela Inteira Ativa • Imagem Estática</span>
                        </div>

                        {videoPaused && (
                          <div style={styles.pausedOverlayBadge}>
                            Transmissão Pausada
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={styles.videoContainer}>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{ ...styles.previewMedia, opacity: videoPaused ? 0.3 : 1 }}
                        />
                        {videoPaused && (
                          <div style={styles.pausedOverlayBadge}>
                            Transmissão Pausada
                          </div>
                        )}
                      </div>
                    )}

                    {/* Canvas Interativo de Marcações (Estilo PDF) e Lupa / Foco */}
                    <canvas
                      ref={annotationCanvasRef}
                      width={1280}
                      height={720}
                      data-testid="annotation-canvas"
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseLeave}
                      onWheel={handleCanvasWheel}
                      style={{
                        ...styles.annotationCanvasOverlay,
                        cursor:
                          activeTool === 'cursor'
                            ? spotlight.enabled
                              ? 'crosshair'
                              : 'default'
                            : activeTool === 'eraser'
                            ? 'cell'
                            : 'crosshair',
                      }}
                    />
                  </div>

                  {/* Notificação Flutuante de Mão Levantada (quando a sidebar estiver recolhida) */}
                  {lastHandRaised && !isSidebarOpen && (
                    <div style={styles.handToastOverlay} role="alert">
                      <div style={styles.handToastContent}>
                        <Touch_1Filled size={18} style={{ color: 'var(--attention)', flexShrink: 0 }} />
                        <div style={styles.handToastText}>
                          <span style={styles.handToastStrong}>{lastHandRaised.name}</span> levantou a mão.
                        </div>
                      </div>
                      <div style={styles.handToastActions}>
                        <button
                          type="button"
                          onClick={() => {
                            setSidebarTab('students');
                            setIsSidebarOpen(true);
                            dismissHandToast();
                          }}
                          style={styles.handToastViewBtn}
                        >
                          Ver Turma
                        </button>
                        <button
                          type="button"
                          onClick={dismissHandToast}
                          style={styles.handToastDismissBtn}
                          title="Dispensar aviso"
                        >
                          <Close size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </div>

                {/* Seletor rápido de janelas autorizadas quando houver múltiplas */}
                {captureMode === 'window' && selectedWindowSources.length > 1 && (
                  <div style={styles.windowPillsBar}>
                    <span style={styles.windowPillsLabel}>
                      Janelas da Aula ({selectedWindowSources.length}):
                    </span>
                    <div style={styles.windowPillsList}>
                      {selectedWindowSources.map((src) => {
                        const isActive = (activeWindowSource?.id || selectedSource?.id) === src.id;
                        return (
                          <button
                            key={src.id}
                            type="button"
                            onClick={() => handleSwitchScreen(src)}
                            style={isActive ? styles.windowPillActive : styles.windowPill}
                            title={`Alternar para transmitir agora: ${src.name}`}
                          >
                            <span style={isActive ? styles.windowPillDotActive : styles.windowPillDot} />
                            <span style={styles.windowPillText}>{src.name}</span>
                            {isActive && <span style={styles.windowPillActiveBadge}>No Ar</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Dock de controles da aula */}
                <div style={styles.dockPos}>
                  <div className="ml-dock" role="toolbar" aria-label="Controles da aula">
                    <button
                      type="button"
                      onClick={toggleMicMute}
                      className={`ml-dock-btn${micMuted ? ' ml-dock-btn--off' : ''}`}
                      aria-pressed={!micMuted}
                      aria-label={micMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
                      title={micMuted ? 'Microfone desligado. Clique para ligar.' : 'Microfone ligado. Clique para desligar.'}
                    >
                      {micMuted ? <MicrophoneOff size={20} /> : <Microphone size={20} />}
                      <span>Microfone</span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleSystemAudio}
                      className={`ml-dock-btn${systemAudioMuted ? ' ml-dock-btn--off' : ''}`}
                      aria-pressed={!systemAudioMuted}
                      aria-label={systemAudioMuted ? 'Ativar Som do PC' : 'Silenciar Som do PC'}
                      title={systemAudioMuted ? "Transmitir o áudio interno do computador (vídeos educativos, músicas, etc.) para os alunos" : "Silenciar o áudio interno do computador"}
                    >
                      {systemAudioMuted ? <VolumeMute size={20} /> : <VolumeUp size={20} />}
                      <span>Som do PC</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReconfigure}
                      className="ml-dock-btn"
                      title="Alterar modo ou fonte da transmissão"
                    >
                      <Settings size={20} />
                      <span>Trocar tela</span>
                    </button>
                    {/* Alternância rápida entre monitores se houver mais de uma tela detectada */}
                    {captureMode === 'screen' && screenSources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextSource = screenSources.find((s) => s.id !== selectedSource?.id) || screenSources[0];
                          handleSwitchScreen(nextSource);
                        }}
                        className="ml-dock-btn"
                        aria-label="Alternar Monitor"
                        title="Alternar rapidamente o monitor sendo transmitido"
                      >
                        <Screen size={20} />
                        <span>Monitor</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleVideoPause}
                      className="ml-dock-btn"
                      aria-pressed={videoPaused}
                      aria-label={videoPaused ? 'Retomar Vídeo' : 'Pausar Vídeo'}
                    >
                      {videoPaused ? <Play size={20} /> : <Pause size={20} />}
                      <span>{videoPaused ? 'Retomar' : 'Pausar'}</span>
                    </button>
                    <span className="ml-dock__sep" />
                    <button
                      type="button"
                      onClick={handleTakeScreenshot}
                      className="ml-dock-btn"
                      aria-label="Tirar Print"
                      title="Tirar print da janela do MLab e copiar para a área de transferência (F10 / PrintScreen)"
                    >
                      <Camera size={20} />
                      <span>Print</span>
                    </button>
                    {wantRecord && recordingStatus === 'recording' && (
                      <button type="button" onClick={pauseRecording} className="ml-dock-btn ml-dock-btn--rec" aria-pressed="true" aria-label="Pausar gravação">
                        <Recording size={20} />
                        <span>Gravando</span>
                      </button>
                    )}
                    {wantRecord && recordingStatus === 'paused' && (
                      <button type="button" onClick={resumeRecording} className="ml-dock-btn" aria-label="Retomar gravação">
                        <Recording size={20} />
                        <span>Retomar gravação</span>
                      </button>
                    )}
                    {wantRecord && recordingStatus !== 'stopped' && (
                      <button
                        type="button"
                        onClick={stopRecording}
                        disabled={isSaving}
                        className="ml-dock-btn"
                        aria-label="Finalizar e Salvar gravação"
                      >
                        <Download size={20} />
                        <span>{isSaving ? 'Salvando...' : 'Salvar gravação'}</span>
                      </button>
                    )}
                    <span className="ml-dock__sep" />
                    <button
                      type="button"
                      onClick={handleToggleSidebar}
                      className="ml-dock-btn"
                      aria-pressed={isSidebarOpen}
                    >
                      {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                      <span>Painel</span>
                      {(unreadCount > 0 || raisedHandsStudents.length > 0) && (
                        <span style={styles.dockBadges}>
                          {unreadCount > 0 && <span style={styles.unreadBadge}>{unreadCount}</span>}
                          {raisedHandsStudents.length > 0 && (
                            <span style={styles.raisedHandHeaderBadge} title={`${raisedHandsStudents.length} mão(s) levantada(s)`}>
                              <Touch_1Filled size={12} /> {raisedHandsStudents.length}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Retrátil na Direita (Padrão de Retração) */}
              <aside
                style={{
                  ...styles.sidebarDesktop,
                  width: isSidebarOpen ? '380px' : '0px',
                  minWidth: isSidebarOpen ? '380px' : '0px',
                  opacity: isSidebarOpen ? 1 : 0,
                  borderLeft: isSidebarOpen ? '1px solid var(--border-subtle)' : 'none',
                  pointerEvents: isSidebarOpen ? 'auto' : 'none',
                }}
              >
                {/* Abas do painel: Turma, Chat, Dúvidas, Arquivos */}
                <div style={styles.sidebarHeader}>
                  <div style={styles.tabButtons}>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('students')}
                      style={sidebarTab === 'students' ? styles.tabBtnActive : styles.tabBtn}
                      title={`Alunos (${studentsOnly.length})`}
                    >
                      Turma
                      {raisedHandsStudents.length > 0 && (
                        <span style={styles.tabHandBadge} title={`${raisedHandsStudents.length} mão(s) levantada(s)`}>
                          <Touch_1Filled size={11} /> {raisedHandsStudents.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarTab('chat');
                        setChatSubTab('public');
                      }}
                      style={sidebarTab === 'chat' && chatSubTab === 'public' ? styles.tabBtnActive : styles.tabBtn}
                      title="Chat público da turma"
                    >
                      Chat
                      {unreadCount > 0 && <span style={styles.tabBadge}>{unreadCount}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarTab('chat');
                        setChatSubTab('private');
                      }}
                      style={sidebarTab === 'chat' && chatSubTab === 'private' ? styles.tabBtnActive : styles.tabBtn}
                      title="Dúvidas privadas dos alunos"
                    >
                      <Locked size={14} /> Dúvidas
                      {messages.filter((m: any) => m.is_private === true).length > 0 && <span style={styles.privateTabBadge}>{messages.filter((m: any) => m.is_private === true).length}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('files')}
                      style={sidebarTab === 'files' ? styles.tabBtnActive : styles.tabBtn}
                    >
                      Arquivos ({uploadedFiles.length})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    style={styles.closeSidebarBtn}
                    title="Recolher Painel"
                    aria-label="Recolher Painel"
                  >
                    <Close size={16} />
                  </button>
                </div>

                {/* Aba 1: Chat da Aula com Abas Separadas: Público vs Privado */}
                {sidebarTab === 'chat' && (
                  <div style={styles.chatTabContent}>
                    {chatSubTab === 'public' ? (
                      // ── ABA PÚBLICA ──────────────────────────────────
                      (() => {
                        const publicMsgs = messages.filter((m: any) => m.is_private !== true);
                        const pinnedPublic = publicMsgs.filter((m: any) => m.pinned === true);

                        return (
                          <>
                            {pinnedPublic.length > 0 && (
                              <div style={styles.pinnedBannerBox} data-testid="pinned-public-section">
                                <div style={styles.pinnedBannerHeader}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <PinFilled size={13} /> Mensagens Fixadas ({pinnedPublic.length}/3)
                                  </span>
                                </div>
                                {pinnedPublic.map((pm: any, pIdx: number) => {
                                  const pmId = pm.message_id || pm.id || `pub-pin-${pIdx}`;
                                  const pmSender = pm.name || pm.sender_name || 'Participante';
                                  return (
                                    <div key={`pin-banner-${pmId}`} style={styles.pinnedBannerItem}>
                                      <span style={styles.pinnedBannerText}>
                                        <strong>{pmSender}:</strong> {decodeChatEntities(pm.content)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => pinChatMessage(pmId, false, false)}
                                        style={styles.pinMsgBtnActive}
                                        title="Desafixar mensagem"
                                        aria-label="Desafixar mensagem"
                                      >
                                        <PinFilled size={13} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div style={styles.messagesList}>
                              {publicMsgs.length === 0 ? (
                                <div style={styles.emptyMessagesBox}>
                                  <p style={styles.emptyText}>Nenhuma mensagem pública no chat até o momento.</p>
                                </div>
                              ) : (
                                publicMsgs.map((m: any, idx: number) => {
                                  const isStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                                  const displayName = m.name || m.sender_name || 'Participante';
                                  const matricula = m.student_id ? `(${m.student_id})` : '';
                                  const msgId = m.message_id || m.id || `pub-${idx}`;
                                  const isPinned = m.pinned === true;
                                  const limitReached = !isPinned && pinnedPublic.length >= 3;

                                  return (
                                    <div
                                      key={msgId}
                                      style={
                                        isPinned
                                          ? { ...styles.messageCard, ...styles.pinnedMessageCard }
                                          : styles.messageCard
                                      }
                                    >
                                      <div style={styles.messageHeaderRow}>
                                        <span style={styles.senderName}>
                                          {displayName} {matricula && <span style={styles.matriculaText}>{matricula}</span>}
                                          <small style={styles.roleTag}> [{isStudent ? 'aluno' : 'professor'}]</small>
                                        </span>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={styles.publicTag}>TURMA</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (limitReached) return;
                                              pinChatMessage(msgId, !isPinned, false);
                                            }}
                                            disabled={limitReached}
                                            style={
                                              isPinned
                                                ? styles.pinMsgBtnActive
                                                : limitReached
                                                ? styles.pinMsgBtnDisabled
                                                : styles.pinMsgBtn
                                            }
                                            title={
                                              isPinned
                                                ? 'Desafixar mensagem'
                                                : limitReached
                                                ? 'Limite máximo de 3 mensagens fixadas atingido'
                                                : 'Fixar mensagem'
                                            }
                                            aria-label={isPinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
                                            data-testid={`pin-msg-btn-${msgId}`}
                                          >
                                            {isPinned ? <PinFilled size={14} /> : <Pin size={14} />}
                                          </button>
                                        </div>
                                      </div>
                                      <p style={styles.messageBody}>{decodeChatEntities(m.content)}</p>
                                    </div>
                                  );
                                })
                              )}
                              <div ref={publicChatEndRef} />
                            </div>
                          </>
                        );
                      })()
                    ) : null}

                    {chatSubTab === 'public' ? (
                      <>
                        {/* Formulário exclusivo do Chat Público */}
                        <form onSubmit={handleSendPublicChat} style={styles.chatForm}>
                          <div style={styles.publicIndicatorText}>
                            Enviando para: <strong>Toda a Turma (Público)</strong>
                          </div>
                          <div style={styles.chatInputRow}>
                            <input
                              type="text"
                              value={publicChatInput}
                              onChange={(e) => setPublicChatInput(e.target.value)}
                              placeholder="Mensagem pública para toda a turma..."
                              style={styles.chatInput}
                            />
                            <button
                              type="submit"
                              disabled={!publicChatInput.trim()}
                              style={{
                                ...styles.sendBtn,
                                opacity: !publicChatInput.trim() ? 0.5 : 1,
                              }}
                            >
                              Enviar
                            </button>
                          </div>
                        </form>
                      </>
                    ) : (
                      // ── ABA PRIVADA ──────────────────────────────────
                      <>
                        {/* Seletor rápido de alunos conectados no topo da aba privada */}
                        <div style={styles.privateHeaderBox}>
                          <label style={styles.privateSelectLabel}>Conversar com o Aluno:</label>
                          <select
                            value={targetStudent?.id || ''}
                            onChange={(e) => {
                              const found = studentsOnly.find((s: any) => (s.participant_id || s.id) === e.target.value);
                              if (found) {
                                setTargetStudent({
                                  id: found.participant_id || found.id,
                                  name: found.name,
                                  student_id: found.student_id,
                                });
                              } else {
                                setTargetStudent(null);
                              }
                            }}
                            style={styles.studentSelect}
                          >
                            <option value="">-- Selecione um aluno online ({studentsOnly.length}) --</option>
                            {studentsOnly.map((s: any) => (
                              <option key={s.participant_id || s.id} value={s.participant_id || s.id}>
                                {s.name} {s.student_id ? `(${s.student_id})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const activePrivateScope = targetStudent
                            ? messages.filter(
                                (m: any) =>
                                  m.is_private === true &&
                                  (m.participant_id === targetStudent.id || m.target_id === targetStudent.id)
                              )
                            : messages.filter((m: any) => m.is_private === true);
                          const pinnedPrivate = activePrivateScope.filter((m: any) => m.pinned === true);

                          return (
                            <>
                              {pinnedPrivate.length > 0 && (
                                <div style={styles.pinnedBannerBoxPrivate} data-testid="pinned-private-section">
                                  <div style={styles.pinnedBannerHeaderPrivate}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <PinFilled size={13} /> Mensagens Privadas Fixadas ({pinnedPrivate.length}/3)
                                    </span>
                                  </div>
                                  {pinnedPrivate.map((pm: any, pIdx: number) => {
                                    const pmId = pm.message_id || pm.id || `priv-pin-${pIdx}`;
                                    const pmSender = pm.name || pm.sender_name || 'Participante';
                                    const isPmStudent = pm.role === 'aluno' || pm.sender_role === 'aluno';
                                    const pmTargetId = isPmStudent ? (pm.participant_id || pm.sender_id) : pm.target_id || targetStudent?.id;
                                    return (
                                      <div key={`pin-priv-banner-${pmId}`} style={styles.pinnedBannerItem}>
                                        <span style={styles.pinnedBannerText}>
                                          <strong>{pmSender}:</strong> {decodeChatEntities(pm.content)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => pinChatMessage(pmId, false, true, pmTargetId)}
                                          style={styles.pinMsgBtnActivePrivate}
                                          title="Desafixar mensagem"
                                          aria-label="Desafixar mensagem"
                                        >
                                          <PinFilled size={13} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <div style={styles.messagesList}>
                                {targetStudent ? (
                                  // Conversa privada filtrada para o aluno selecionado
                                  activePrivateScope.length === 0 ? (
                                    <div style={styles.emptyMessagesBox}>
                                      <p style={styles.emptyText}>
                                        Nenhuma mensagem trocada ainda com <strong>{targetStudent.name}</strong>.
                                      </p>
                                      <p style={{ ...styles.emptyText, fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                                        Envie uma mensagem abaixo para iniciar a conversa privada.
                                      </p>
                                    </div>
                                  ) : (
                                    activePrivateScope.map((m: any, idx: number) => {
                                      const isStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                                      const displayName = m.name || m.sender_name || 'Participante';
                                      const matricula = m.student_id ? `(${m.student_id})` : '';
                                      const msgId = m.message_id || m.id || `priv-${idx}`;
                                      const isPinned = m.pinned === true;
                                      const limitReached = !isPinned && pinnedPrivate.length >= 3;

                                      return (
                                        <div
                                          key={msgId}
                                          style={
                                            isPinned
                                              ? {
                                                  ...styles.messageCard,
                                                  ...styles.privateMessageCard,
                                                  ...styles.pinnedPrivateMessageCard,
                                                }
                                              : { ...styles.messageCard, ...styles.privateMessageCard }
                                          }
                                        >
                                          <div style={styles.messageHeaderRow}>
                                            <span style={styles.senderName}>
                                              {displayName} {matricula && <span style={styles.matriculaText}>{matricula}</span>}
                                              <small style={styles.roleTag}> [{isStudent ? 'aluno' : 'professor'}]</small>
                                            </span>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={styles.privateTag}>
                                                <Locked size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                                PRIVADO
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (limitReached) return;
                                                  pinChatMessage(msgId, !isPinned, true, targetStudent.id);
                                                }}
                                                disabled={limitReached}
                                                style={
                                                  isPinned
                                                    ? styles.pinMsgBtnActivePrivate
                                                    : limitReached
                                                    ? styles.pinMsgBtnDisabled
                                                    : styles.pinMsgBtn
                                                }
                                                title={
                                                  isPinned
                                                    ? 'Desafixar mensagem'
                                                    : limitReached
                                                    ? 'Limite máximo de 3 mensagens fixadas atingido'
                                                    : 'Fixar mensagem'
                                                }
                                                aria-label={isPinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
                                                data-testid={`pin-msg-btn-${msgId}`}
                                              >
                                                {isPinned ? <PinFilled size={14} /> : <Pin size={14} />}
                                              </button>
                                            </div>
                                          </div>
                                          <p style={styles.messageBody}>{decodeChatEntities(m.content)}</p>
                                        </div>
                                      );
                                    })
                                  )
                                ) : (
                                  // Visão geral de todas as dúvidas privadas recebidas dos alunos
                                  activePrivateScope.length === 0 ? (
                                    <div style={styles.emptyMessagesBox}>
                                      <p style={styles.emptyText}>Nenhuma dúvida privada recebida até o momento.</p>
                                      <p style={{ ...styles.emptyText, fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                                        Selecione um aluno no menu acima para iniciar uma conversa.
                                      </p>
                                    </div>
                                  ) : (
                                    activePrivateScope.map((m: any, idx: number) => {
                                      const isStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                                      const displayName = m.name || m.sender_name || 'Participante';
                                      const matricula = m.student_id ? `(${m.student_id})` : '';
                                      const msgId = m.message_id || m.id || `priv-all-${idx}`;
                                      const isPinned = m.pinned === true;
                                      const studentTargetId = isStudent ? (m.participant_id || m.sender_id) : m.target_id;
                                      const limitReached = !isPinned && pinnedPrivate.length >= 3;

                                      return (
                                        <div
                                          key={msgId}
                                          style={
                                            isPinned
                                              ? {
                                                  ...styles.messageCard,
                                                  ...styles.privateMessageCard,
                                                  ...styles.pinnedPrivateMessageCard,
                                                }
                                              : { ...styles.messageCard, ...styles.privateMessageCard }
                                          }
                                        >
                                          <div style={styles.messageHeaderRow}>
                                            <span style={styles.senderName}>
                                              {displayName} {matricula && <span style={styles.matriculaText}>{matricula}</span>}
                                              <small style={styles.roleTag}> [{isStudent ? 'aluno' : 'professor'}]</small>
                                            </span>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={styles.privateTag}>
                                                <Locked size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                                PRIVADO
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (limitReached) return;
                                                  pinChatMessage(msgId, !isPinned, true, studentTargetId);
                                                }}
                                                disabled={limitReached}
                                                style={
                                                  isPinned
                                                    ? styles.pinMsgBtnActivePrivate
                                                    : limitReached
                                                    ? styles.pinMsgBtnDisabled
                                                    : styles.pinMsgBtn
                                                }
                                                title={
                                                  isPinned
                                                    ? 'Desafixar mensagem'
                                                    : limitReached
                                                    ? 'Limite máximo de 3 mensagens fixadas atingido'
                                                    : 'Fixar mensagem'
                                                }
                                                aria-label={isPinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
                                                data-testid={`pin-msg-btn-${msgId}`}
                                              >
                                                {isPinned ? <PinFilled size={14} /> : <Pin size={14} />}
                                              </button>
                                            </div>
                                          </div>
                                          <p style={styles.messageBody}>{decodeChatEntities(m.content)}</p>
                                          {isStudent && (
                                            <button
                                              type="button"
                                              onClick={() => setTargetStudent({ id: m.participant_id, name: displayName, student_id: m.student_id })}
                                              style={styles.replyPrivateBtn}
                                            >
                                              ↩ Responder a {displayName}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })
                                  )
                                )}
                                <div ref={privateChatEndRef} />
                              </div>
                            </>
                          );
                        })()}

                        {/* Formulário exclusivo do Chat Privado — Visível apenas quando houver aluno selecionado */}
                        {targetStudent ? (
                          <form onSubmit={handleSendPrivateChat} style={styles.chatForm}>
                            <div style={styles.targetIndicatorBox}>
                              <span style={styles.targetIndicatorText}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Locked size={14} /> Respondendo em privado para: <strong>{targetStudent.name}</strong> {targetStudent.student_id && `(${targetStudent.student_id})`}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setTargetStudent(null)}
                                style={styles.clearTargetBtn}
                                title="Voltar para todas as dúvidas"
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Close size={14} /> Ver Todas</span>
                              </button>
                            </div>

                            <div style={styles.chatInputRow}>
                              <input
                                type="text"
                                value={privateChatInput}
                                onChange={(e) => setPrivateChatInput(e.target.value)}
                                placeholder={`Mensagem privada para ${targetStudent.name}...`}
                                style={styles.chatInput}
                              />
                              <button
                                type="submit"
                                disabled={!privateChatInput.trim()}
                                style={{
                                  ...styles.sendPrivateBtn,
                                  opacity: !privateChatInput.trim() ? 0.5 : 1,
                                }}
                              >
                                Enviar Privado
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div style={styles.privateSelectPromptBox}>
                            <div style={styles.privateSelectPromptText}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Locked size={14} /> Modo de visualização geral. Selecione um aluno no menu acima para enviar uma mensagem privada.
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Aba 2: Lista de Alunos Conectados com Nome e Matrícula */}
                {sidebarTab === 'students' && (
                  <div style={styles.studentsTabContent}>
                    {/* Seção de Destaque: Fila de Mãos Levantadas */}
                    {raisedHandsStudents.length > 0 && (
                      <div style={styles.raisedHandsSection}>
                        <div style={styles.raisedHandsHeader}>
                          <span style={styles.raisedHandsTitle}>
                            <Touch_1Filled size={16} style={{ color: 'var(--attention)' }} /> Mãos Levantadas ({raisedHandsStudents.length})
                          </span>
                          <span style={styles.raisedHandsHelp}>Ordem de chamada</span>
                        </div>
                        <div style={styles.raisedHandsList}>
                          {raisedHandsStudents.map((s: any, idx: number) => {
                            const pId = s.participant_id || s.id;
                            return (
                              <div key={`raised-${pId}`} style={styles.raisedHandCard}>
                                <div style={styles.raisedHandOrderBadge}>#{idx + 1}</div>
                                <div style={styles.studentInfoBox}>
                                  <span style={styles.studentNameText}>{s.name}</span>
                                  <span style={styles.studentMatriculaText}>
                                    Matrícula: <strong>{s.student_id || 'Não informada'}</strong>
                                  </span>
                                </div>
                                <div style={styles.raisedHandActions}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTargetStudent({ id: pId, name: s.name, student_id: s.student_id });
                                      setChatSubTab('private');
                                      setSidebarTab('chat');
                                    }}
                                    style={styles.startPrivateChatBtn}
                                    title="Enviar Mensagem Privada"
                                  >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Locked size={14} /> Privado
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => lowerStudentHand(pId)}
                                    style={styles.lowerHandBtn}
                                    title="Abaixar Mão do Aluno"
                                  >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Touch_1 size={14} /> Abaixar
                                    </span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={styles.studentsListHeader}>
                      <span style={styles.studentsListTitle}>Alunos Presentes na Aula</span>
                      <span style={styles.studentsCountBadge}>{studentsOnly.length} online</span>
                    </div>

                    <div style={styles.studentsList}>
                      {studentsOnly.length === 0 ? (
                        <div style={styles.emptyMessagesBox}>
                          <p style={styles.emptyText}>Nenhum aluno conectado no momento.</p>
                        </div>
                      ) : (
                        studentsOnly.map((s: any) => {
                          const isRaised = Boolean(s.hand_raised || s.handRaised);
                          const pId = s.participant_id || s.id;
                          return (
                            <div key={pId} style={styles.studentCard}>
                              <div style={styles.studentAvatar}><Education size={20} /></div>
                              <div style={styles.studentInfoBox}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={styles.studentNameText}>{s.name}</span>
                                  {isRaised && (
                                    <span style={styles.studentHandTag} title="Mão levantada">
                                      <Touch_1Filled size={12} /> Mão Levantada
                                    </span>
                                  )}
                                </div>
                                <span style={styles.studentMatriculaText}>
                                  Matrícula: <strong>{s.student_id || 'Não informada'}</strong>
                                </span>
                              </div>
                              {isRaised && (
                                <button
                                  type="button"
                                  onClick={() => lowerStudentHand(pId)}
                                  style={styles.lowerHandSmallBtn}
                                  title="Abaixar Mão"
                                >
                                  <Touch_1 size={14} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetStudent({ id: pId, name: s.name, student_id: s.student_id });
                                  setChatSubTab('private');
                                  setSidebarTab('chat');
                                }}
                                style={styles.startPrivateChatBtn}
                                title="Enviar Mensagem Privada"
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Locked size={14} /> Privado</span>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Aba 3: Compartilhamento de Arquivos com os Alunos */}
                {sidebarTab === 'files' && (
                  <FileDropZone onFiles={enqueueUploads} style={styles.filesTabContent}>
                    <div style={styles.uploadSection}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        data-testid="room-file-input"
                        onChange={handleFileInputChange}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        style={isUploading ? styles.uploadBtnDisabled : styles.uploadBtn}
                      >
                        {isUploading ? 'Enviando Arquivo...' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Attachment size={16} /> Compartilhar Novo Arquivo</span>}
                      </button>

                      <span style={styles.dropHint}>ou arraste arquivos para esta aba</span>

                      {uploadItems.length > 0 && (
                        <ul style={styles.uploadQueueList} role="status" aria-live="polite" aria-label="Envio de arquivos">
                          {uploadItems.map((item) => (
                            <li
                              key={item.id}
                              data-testid="upload-item"
                              data-status={item.status}
                              style={{
                                ...styles.uploadQueueItem,
                                ...(item.status === 'erro' ? styles.uploadQueueItemError : {}),
                                ...(item.status === 'enviado' ? styles.uploadQueueItemDone : {}),
                              }}
                            >
                              <span style={styles.uploadQueueName} title={item.name}>{item.name}</span>
                              <span style={styles.uploadQueueStatus}>{uploadStatusLabel(item)}</span>
                              {item.status === 'erro' && (
                                <button
                                  type="button"
                                  onClick={() => dismissUpload(item.id)}
                                  style={styles.uploadQueueDismiss}
                                  title="Dispensar"
                                  aria-label={`Dispensar ${item.name}`}
                                >
                                  <Close size={12} />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div style={styles.uploadedFilesList}>
                      <span style={styles.filesListTitle}>Arquivos Compartilhados Nesta Aula</span>
                      {uploadedFiles.length === 0 ? (
                        <p style={styles.emptyText}>Nenhum arquivo compartilhado até o momento.</p>
                      ) : (
                        uploadedFiles.map((file: any, idx: number) => (
                          <div key={file.id || idx} style={styles.fileItemRow}>
                            <span style={styles.fileIcon}><Attachment size={16} /></span>
                            <div style={styles.fileInfoColumn}>
                              <span style={styles.fileItemName} title={file.name}>{file.name}</span>
                              <span style={styles.fileItemSize}>{formatFileSize(file.size)}</span>
                            </div>
                            <span style={styles.fileSharedBadge}><Checkmark size={12} style={{ marginRight: '4px' }} />Enviado</span>
                          </div>
                        ))
                      )}
                      <div ref={uploadedFilesEndRef} data-testid="uploaded-files-end" />
                    </div>
                  </FileDropZone>
                )}
              </aside>
            </div>
          </div>
        )}
      </main>

      {!isLiveSession && (
        <div style={styles.actionBar}>
          <div style={styles.actionBarInner}>
            <span style={styles.actionSummary} aria-live="polite">
              <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                {captureMode === 'screen'
                  ? `Tela inteira${currentSource?.name ? `, ${currentSource.name}` : ''}`
                  : `${selectedWindowSources.length} ${selectedWindowSources.length === 1 ? 'janela escolhida' : 'janelas escolhidas'}`}
              </strong>
              {qualityProfile === '1080p_60' ? ', 1080p a 60 fps' : ', 1080p a 30 fps'}
              {wantRecord ? ', com gravação' : ', sem gravação'}
            </span>
            <button
              type="button"
              className="ml-btn ml-btn--primary ml-btn--lg"
              onClick={handleStartSession}
              disabled={!currentSource}
            >
              <Recording size={18} /> Começar transmissão
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg)',
    color: 'var(--text-1)',
    fontFamily: 'var(--font-ui)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px 24px',
    flexWrap: 'wrap',
    minHeight: '56px',
    padding: '8px 16px',
    backgroundColor: 'var(--surface-1)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  headerTitleBox: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px 10px',
  },
  headerLinks: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px 20px',
  },
  headerLinkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
  },
  headerLinkLabel: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    color: colors.textSecondary,
    whiteSpace: 'nowrap',
  },
  headerSep: {
    width: '1px',
    height: '24px',
    backgroundColor: 'var(--border-subtle)',
  },
  mono: {
    fontFamily: 'var(--font-mono)',
  },
  sectionDesc: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-2)',
    margin: '4px 0 0',
  },
  thumbPlaceholder: {
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: '6px',
    backgroundColor: 'var(--stage)',
    color: '#8A93A0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '0 4px 4px',
    minWidth: 0,
  },
  radioDot: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid var(--border-strong)',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  radioDotOn: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '6px solid var(--accent-fill)',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  sourceNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    margin: 0,
    fontSize: 'var(--fs-caption)',
    lineHeight: 1.45,
    color: 'var(--text-3)',
    maxWidth: '72ch',
  },
  qualitySpec: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
  },
  recordNote: {
    margin: 0,
    paddingLeft: '52px',
    fontSize: 'var(--fs-small)',
    lineHeight: 1.45,
    color: 'var(--text-2)',
  },
  actionBar: {
    flexShrink: 0,
    backgroundColor: 'var(--surface-1)',
    borderTop: '1px solid var(--border-subtle)',
  },
  actionBarInner: {
    maxWidth: '880px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 24px',
  },
  actionSummary: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-2)',
    minWidth: 0,
  },
  stageLabel: {
    flexShrink: 0,
    fontSize: 'var(--fs-caption)',
    color: '#9AA2AE',
    margin: '0 -12px 18px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stageFrame: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  dockPos: {
    position: 'absolute',
    left: '50%',
    bottom: '20px',
    transform: 'translateX(-50%)',
    zIndex: 30,
    maxWidth: 'calc(100% - 24px)',
  },
  dockBadges: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    display: 'inline-flex',
    gap: '2px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  logoImg: {
    width: '56px',
    height: '56px',
    objectFit: 'contain',
  },
  title: {
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    color: colors.textPrimary,
    margin: 0,
    whiteSpace: 'nowrap',
  },
  roomLinkStatic: {
    fontSize: 'var(--fs-small)',
    fontFamily: 'var(--font-mono)',
    color: colors.textPrimary,
    backgroundColor: 'var(--surface-2)',
    padding: '5px 8px',
    borderRadius: radii.sm,
    userSelect: 'text',
    cursor: 'default',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '340px',
  },
  screenshotSuccessBanner: {
    margin: '8px 16px 0',
    padding: '10px 14px',
    borderRadius: 'var(--r-panel)',
    backgroundColor: 'var(--surface-2)',
    borderLeft: '3px solid var(--live)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  closeBtn: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: 'var(--danger-fill)',
    color: '#ffffff',
  },
  closeBtnDisabled: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-3)',
    cursor: 'not-allowed',
  },
  permissionAlert: {
    margin: '8px 16px 0',
    backgroundColor: 'var(--surface-2)',
    borderLeft: '3px solid var(--danger)',
    borderRadius: 'var(--r-panel)',
    color: 'var(--text-1)',
    padding: '10px 14px',
    fontSize: 'var(--fs-small)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  retryPermBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    border: '1px solid var(--border-strong)',
    flexShrink: 0,
  },
  errorBanner: {
    margin: '8px 16px 0',
    backgroundColor: 'var(--surface-2)',
    borderLeft: '3px solid var(--danger)',
    borderRadius: 'var(--r-panel)',
    color: 'var(--text-1)',
    padding: '10px 14px',
    fontSize: 'var(--fs-small)',
  },
  successBanner: {
    margin: '8px 16px 0',
    backgroundColor: 'var(--surface-2)',
    borderLeft: '3px solid var(--live)',
    borderRadius: 'var(--r-panel)',
    color: 'var(--text-1)',
    padding: '10px 14px',
    fontSize: 'var(--fs-small)',
  },
  mainContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px 24px 40px',
    display: 'flex',
    flexDirection: 'column',
  },
  mainContentLive: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    boxSizing: 'border-box',
  },
  setupCard: {
    maxWidth: '880px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  setupHeader: {
    fontSize: 'var(--fs-title)',
    lineHeight: 1.2,
    fontWeight: '700',
    letterSpacing: '-0.01em',
    margin: 0,
    color: 'var(--text-1)',
  },
  setupSub: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-2)',
    margin: '8px 0 0',
  },
  sectionBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionTitle: {
    fontSize: 'var(--fs-lead)',
    lineHeight: 1.2,
    fontWeight: '700',
    color: 'var(--text-1)',
    margin: 0,
  },
  sectionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '16px',
    flexWrap: 'wrap',
  },
  refreshSourcesBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
  },
  windowHintBox: {
    padding: '10px 14px',
    borderRadius: 'var(--r-panel)',
    backgroundColor: 'var(--surface-2)',
    borderLeft: '3px solid var(--accent)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-small)',
    lineHeight: 1.4,
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  choiceBtn: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
  },
  choiceBtnActive: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--accent)',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  formatSelectBox: {
    paddingTop: '16px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formatLabel: {
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    color: 'var(--text-2)',
  },
  subChoiceBtnActive: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-start',
    border: '1px solid var(--accent)',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  modeTabs: {
    display: 'flex',
    gap: '3px',
    padding: '3px',
    backgroundColor: 'var(--surface-2)',
    borderRadius: 'calc(var(--r-control) + 3px)',
  },
  modeTab: {
    flex: 1,
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
  modeTabActive: {
    flex: 1,
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-1)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
  sourceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '24px',
    padding: '6px',
  },
  noSources: {
    color: 'var(--text-2)',
    fontSize: 'var(--fs-small)',
  },
  sourceCard: {
    padding: '8px',
    gap: '10px',
  },
  sourceCardSelected: {
    width: '190px',
    padding: '8px',
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--r-panel)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
    cursor: 'pointer',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    borderRadius: '6px',
    backgroundColor: 'var(--stage)',
    display: 'block',
  },
  sourceName: {
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    color: 'var(--text-1)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  selectedBadgeInline: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  selectedBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: 'var(--r-pill)',
  },
  advanceBar: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  advanceBtn: {
    minHeight: '48px',
    padding: '0 24px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
    fontSize: 'var(--fs-body)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  advanceBtnDisabled: {
    minHeight: '48px',
    padding: '0 24px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-3)',
    fontSize: 'var(--fs-body)',
    fontWeight: 600,
    cursor: 'not-allowed',
  },
  liveContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  liveContentArea: {
    flex: 1,
    display: 'flex',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  liveMainSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
    backgroundColor: 'var(--stage)',
    padding: '12px 28px 100px',
  },
  statusBar: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    minHeight: '44px',
    padding: '6px 12px',
    backgroundColor: 'var(--surface-1)',
    borderRadius: 'var(--r-panel)',
    border: '1px solid var(--border-subtle)',
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: 'var(--live)',
    backgroundColor: 'var(--live-soft)',
  },
  pulsingDotGreen: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--live)',
  },
  resolutionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-2)',
    backgroundColor: 'var(--surface-2)',
  },
  studentsBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: 'var(--text-2)',
    backgroundColor: 'var(--surface-2)',
  },
  qualitySelectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '12px',
  },
  qualityCard: {
    position: 'relative',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-panel)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    cursor: 'pointer',
  },
  qualityCardActive: {
    position: 'relative',
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--r-panel)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    cursor: 'pointer',
  },
  qualityCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    minHeight: '26px',
  },
  qualityCardTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '700',
    fontSize: 'var(--fs-body)',
    color: 'var(--text-1)',
  },
  qualityDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: 'var(--fs-small)',
    color: 'var(--text-2)',
  },
  qualityParam: {
    display: 'flex',
    gap: '4px',
  },
  statusInfo: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  statusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  recordStatusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  recordingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)',
    color: 'var(--rec)',
    backgroundColor: 'var(--danger-soft)',
  },
  pulsingDotRed: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--rec)',
  },
  pausedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)',
    color: 'var(--attention)',
    backgroundColor: 'var(--attention-soft)',
  },
  stoppedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: 'var(--text-2)',
    backgroundColor: 'var(--surface-2)',
  },
  noRecordBadge: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
    whiteSpace: 'nowrap',
  },
  recControlBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
  },
  recSaveBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  previewArea: {
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--stage)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Camadas da prévia: vídeo/selos (≤ 10) < canvas de marcação (15) < aviso de mão (20)
  // < barra de marcação (25) < popover de cores (30). O aviso precisa ficar acima do canvas,
  // que ocupa toda a prévia e recebe eventos, senão "Ver Turma" e o X não recebem o clique (031, RF-3101).
  handToastOverlay: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: 20,
    backgroundColor: 'var(--surface-float)',
    borderRadius: 'var(--r-panel)',
    padding: '8px 8px 8px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    boxShadow: 'var(--shadow-float)',
    maxWidth: '380px',
    borderLeft: '3px solid var(--accent)',
  },
  handToastContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  handToastText: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-1)',
  },
  handToastStrong: {
    fontWeight: '600',
    color: '#ffffff',
  },
  handToastActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  handToastViewBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  handToastDismissBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-2)',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--r-control)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMedia: {
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  },
  staticPreviewBox: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  staticOverlayBadge: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    backgroundColor: 'var(--surface-float)',
    color: 'var(--text-2)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  screenShieldCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px',
    textAlign: 'center',
  },
  screenShieldIcon: {
    display: 'flex',
    color: 'var(--live)',
    marginBottom: '16px',
  },
  screenShieldTitle: {
    fontSize: 'var(--fs-title)',
    lineHeight: 1.2,
    fontWeight: '700',
    color: 'var(--text-1)',
    margin: '0 0 8px 0',
  },
  screenShieldSubtitle: {
    fontSize: 'var(--fs-body)',
    lineHeight: 1.5,
    color: 'var(--text-2)',
    margin: 0,
    maxWidth: '440px',
  },
  pausedOverlayBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'var(--surface-float)',
    color: 'var(--attention)',
    fontSize: 'var(--fs-body)',
    fontWeight: '700',
    padding: '12px 20px',
    borderRadius: 'var(--r-panel)',
    boxShadow: 'var(--shadow-float)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    zIndex: 10,
  },
  controlsBar: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    padding: '6px',
    backgroundColor: 'var(--surface-1)',
    borderRadius: 'var(--r-panel)',
    border: '1px solid var(--border-subtle)',
    gap: '4px',
  },
  controlBtn: {
    minHeight: '40px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    padding: '0 10px',
  },
  controlBtnActive: {
    minHeight: '40px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
    backgroundColor: 'var(--danger-soft)',
    color: 'var(--danger)',
    padding: '0 10px',
  },
  controlBtnPauseActive: {
    minHeight: '40px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
    backgroundColor: 'var(--attention-soft)',
    color: 'var(--attention)',
    padding: '0 10px',
  },
  controlBtnActiveChat: {
    minHeight: '40px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
    padding: '0 10px',
  },
  unreadBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: 1,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  raisedHandHeaderBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: 1,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  sidebarDesktop: {
    backgroundColor: 'var(--surface-1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.2s ease, opacity 0.2s ease',
  },
  sidebarHeader: {
    padding: '0 4px 0 8px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '4px',
  },
  tabButtons: {
    display: 'flex',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  tabBtn: {
    flex: 1,
    minHeight: '44px',
    padding: '0 6px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid transparent',
    color: 'var(--text-2)',
    fontWeight: 600,
  },
  tabBtnActive: {
    flex: 1,
    minHeight: '44px',
    padding: '0 6px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid var(--accent)',
    color: 'var(--text-1)',
    fontWeight: 700,
  },
  tabBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: 1,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  tabHandBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: 1,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  closeSidebarBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-2)',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--r-control)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatTabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatSubTabRow: {
    display: 'flex',
    gap: '3px',
    padding: '3px',
    margin: '10px 12px 4px',
    backgroundColor: 'var(--surface-2)',
    borderRadius: 'calc(var(--r-control) + 3px)',
  },
  chatSubTab: {
    flex: 1,
    minHeight: '34px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    fontWeight: 600,
  },
  chatSubTabActive: {
    flex: 1,
    minHeight: '34px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-1)',
    fontWeight: 700,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  chatSubTabActivePrivate: {
    flex: 1,
    minHeight: '34px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-1)',
    fontWeight: 700,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  privateTabBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: 1,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  privateSelectPromptBox: {
    padding: '12px',
    borderTop: '1px solid var(--border-subtle)',
  },
  privateSelectPromptText: {
    fontSize: 'var(--fs-small)',
    lineHeight: 1.4,
    color: 'var(--text-2)',
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  emptyMessagesBox: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 'var(--fs-small)',
    lineHeight: 1.4,
    color: 'var(--text-2)',
    margin: 0,
  },
  messageCard: {
    padding: 0,
  },
  privateMessageCard: {
    backgroundColor: 'var(--surface-2)',
    borderRadius: 'var(--r-panel)',
    padding: '10px 12px',
  },
  pinnedMessageCard: {
    backgroundColor: 'var(--accent-soft)',
    borderRadius: 'var(--r-panel)',
    padding: '10px 12px',
  },
  pinnedPrivateMessageCard: {
    backgroundColor: 'var(--accent-soft)',
    borderRadius: 'var(--r-panel)',
    padding: '10px 12px',
  },
  pinnedBannerBox: {
    padding: '10px 12px',
    backgroundColor: 'var(--accent-soft)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pinnedBannerBoxPrivate: {
    padding: '10px 12px',
    backgroundColor: 'var(--accent-soft)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pinnedBannerHeader: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedBannerHeaderPrivate: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedBannerItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  pinnedBannerText: {
    fontSize: 'var(--fs-small)',
    lineHeight: 1.4,
    color: 'var(--text-1)',
    flex: 1,
    wordBreak: 'break-word',
  },
  pinMsgBtn: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--r-control)',
    color: 'var(--text-3)',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pinMsgBtnActive: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--r-control)',
    color: 'var(--accent)',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pinMsgBtnActivePrivate: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--r-control)',
    color: 'var(--accent)',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pinMsgBtnDisabled: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--r-control)',
    color: 'var(--text-3)',
    width: '28px',
    height: '28px',
    cursor: 'not-allowed',
    opacity: 0.45,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  messageHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '2px',
  },
  senderName: {
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    color: 'var(--text-1)',
  },
  matriculaText: {
    color: 'var(--text-3)',
    fontWeight: 400,
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-caption)',
  },
  roleTag: {
    color: 'var(--text-3)',
    fontWeight: '400',
    fontSize: 'var(--fs-caption)',
  },
  publicTag: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '600',
    color: 'var(--text-3)',
  },
  privateTag: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '600',
    color: 'var(--accent)',
  },
  messageBody: {
    fontSize: 'var(--fs-body)',
    lineHeight: 1.5,
    color: 'var(--text-1)',
    margin: 0,
    wordBreak: 'break-word',
  },
  replyPrivateBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    marginTop: '6px',
    color: 'var(--text-1)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-strong)',
  },
  chatForm: {
    padding: '12px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  targetIndicatorBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--surface-2)',
    padding: '4px 4px 4px 10px',
    borderRadius: 'var(--r-control)',
  },
  targetIndicatorText: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-1)',
  },
  clearTargetBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-2)',
  },
  publicIndicatorText: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
  },
  chatInputRow: {
    display: 'flex',
    gap: '8px',
  },
  chatInput: {
    flex: 1,
    minWidth: 0,
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-body)',
  },
  sendBtn: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  sendPrivateBtn: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    border: 'none',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  privateHeaderBox: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  privateSelectLabel: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-1)',
    fontWeight: 600,
  },
  studentSelect: {
    minHeight: '40px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-small)',
  },
  studentsTabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  studentsListHeader: {
    padding: '14px 12px 6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentsListTitle: {
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    color: 'var(--text-2)',
  },
  studentsCountBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: 1,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    color: 'var(--text-1)',
    backgroundColor: 'var(--surface-2)',
  },
  studentsList: {
    flex: 1,
    padding: '4px 6px 12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  studentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '52px',
    padding: '6px',
    borderRadius: 'var(--r-control)',
  },
  studentAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  studentInfoBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
  },
  studentNameText: {
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: 'var(--text-1)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  studentMatriculaText: {
    fontSize: 'var(--fs-caption)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  startPrivateChatBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    flexShrink: 0,
  },
  raisedHandsSection: {
    padding: '12px',
    backgroundColor: 'var(--attention-soft)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  raisedHandsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  raisedHandsTitle: {
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    color: 'var(--text-1)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  raisedHandsHelp: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-2)',
  },
  raisedHandsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  raisedHandCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '52px',
    padding: '6px 8px',
    backgroundColor: 'var(--surface-1)',
    borderRadius: 'var(--r-control)',
  },
  raisedHandOrderBadge: {
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    minWidth: '28px',
    height: '28px',
    padding: '0 6px',
    borderRadius: 'var(--r-pill)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#ffffff',
    backgroundColor: 'var(--accent-fill)',
  },
  raisedHandActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  lowerHandBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
  },
  lowerHandSmallBtn: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentHandTag: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--attention)',
    backgroundColor: 'var(--attention-soft)',
    padding: '1px 8px',
    borderRadius: 'var(--r-pill)',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  filesTabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  uploadSection: {
    padding: '12px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  uploadBtn: {
    width: '100%',
    minHeight: '48px',
    padding: '0 12px',
    borderRadius: 'var(--r-panel)',
    border: '2px dashed var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
  uploadBtnDisabled: {
    width: '100%',
    minHeight: '48px',
    padding: '0 12px',
    borderRadius: 'var(--r-panel)',
    border: '2px dashed var(--border-subtle)',
    backgroundColor: 'transparent',
    color: 'var(--text-3)',
    fontSize: 'var(--fs-small)',
    cursor: 'not-allowed',
    textAlign: 'center',
  },
  dropHint: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
    textAlign: 'center',
  },
  uploadQueueList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  uploadQueueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: 'var(--r-control)',
    backgroundColor: 'var(--surface-2)',
    borderLeft: '3px solid var(--accent)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-caption)',
  },
  uploadQueueItemDone: {
    borderLeft: '3px solid var(--live)',
  },
  uploadQueueItemError: {
    borderLeft: '3px solid var(--danger)',
    color: 'var(--danger)',
  },
  uploadQueueName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  uploadQueueStatus: {
    flexShrink: 0,
    maxWidth: '55%',
    textAlign: 'right',
  },
  uploadQueueDismiss: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  },
  uploadedFilesList: {
    flex: 1,
    padding: '12px 6px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  filesListTitle: {
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    color: 'var(--text-2)',
    margin: '0 6px 6px',
  },
  fileItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '52px',
    padding: '6px',
    borderRadius: 'var(--r-control)',
  },
  fileIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fileInfoColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  fileItemName: {
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    color: 'var(--text-1)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileItemSize: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
  },
  fileSharedBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '600',
    color: 'var(--live)',
  },
  annotationToolbarLeft: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 25,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 6px',
    backgroundColor: 'var(--surface-float)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-panel)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(8px)',
    userSelect: 'none',
    // 028, RF-2815: a barra nunca passa da prévia; se não couber, rola por dentro.
    boxSizing: 'border-box',
    maxHeight: 'calc(100% - 16px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'thin',
  },
  annotationToolbarHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '2px',
  },
  annotationDragHandle: {
    flex: 1,
    height: '20px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-2)',
    cursor: 'grab',
  },
  annotationCollapseMiniBtn: {
    width: '20px',
    height: '20px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  annotationCollapsedFabBtn: {
    position: 'relative',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--r-panel)',
    border: '1px solid transparent',
    backgroundColor: 'var(--surface-float)',
    color: 'var(--text-1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    padding: 0,
    boxShadow: 'var(--shadow-float)',
  },
  annotationToolBtn: {
    position: 'relative',
    width: '34px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    height: '32px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
  },
  annotationToolBtnActive: {
    position: 'relative',
    width: '34px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    height: '32px',
    border: '1px solid transparent',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  annotationToolBtnSpotlightActive: {
    position: 'relative',
    width: '34px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    height: '32px',
    border: '1px solid transparent',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  annotationToolBtnPaletteOpen: {
    position: 'relative',
    width: '34px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    height: '32px',
    border: '1px solid transparent',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-1)',
  },
  annotationToolBtnDisabled: {
    position: 'relative',
    width: '34px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '30px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-3)',
    cursor: 'not-allowed',
    opacity: 0.45,
  },
  annotationToolBtnDanger: {
    position: 'relative',
    width: '34px',
    borderRadius: 'var(--r-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    height: '30px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--danger)',
  },
  shortcutHintBadge: {
    position: 'absolute',
    bottom: '1px',
    right: '2px',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
    color: 'inherit',
    opacity: 0.75,
    lineHeight: 1,
    pointerEvents: 'none',
  },
  colorDotIndicator: {
    position: 'absolute',
    bottom: '3px',
    right: '3px',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    border: '1px solid var(--border-subtle)',
  },
  annotationToolbarDivider: {
    width: '22px',
    height: '1px',
    backgroundColor: 'var(--border-subtle)',
    margin: '2px 0',
  },
  palettePopoverBox: {
    position: 'absolute',
    left: '64px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 30,
    backgroundColor: 'var(--surface-float)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-panel)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.7)',
    minWidth: '175px',
  },
  paletteSectionTitle: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--text-2)',
  },
  paletteColorsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  colorSwatchBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.12s ease',
  },
  paletteSizesRow: {
    display: 'flex',
    gap: '6px',
  },
  sizeOptionBtn: {
    flex: 1,
    minHeight: '28px',
    padding: '0 6px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  sizeOptionBtnActive: {
    flex: 1,
    minHeight: '28px',
    padding: '0 6px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--accent)',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    cursor: 'pointer',
  },
  previewStageBox: {
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  annotationCanvasOverlay: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 15,
    pointerEvents: 'auto',
  },
  // Auto Screen Selection Styles
  autoScreenCard: {
    padding: 0,
  },
  autoScreenLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '20px',
    flexWrap: 'wrap',
  },
  autoScreenThumb: {
    width: '220px',
    height: '124px',
    objectFit: 'cover',
    borderRadius: 'var(--r-control)',
    outline: '2px solid var(--accent)',
    outlineOffset: '3px',
    backgroundColor: 'var(--stage)',
  },
  autoScreenPlaceholder: {
    width: '220px',
    height: '124px',
    borderRadius: 'var(--r-control)',
    backgroundColor: 'var(--surface-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-3)',
  },
  autoScreenDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '220px',
  },
  autoScreenHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  autoScreenTitle: {
    fontSize: 'var(--fs-body)',
    fontWeight: '700',
    color: 'var(--text-1)',
  },
  autoSelectedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  autoScreenDesc: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-2)',
    margin: 0,
    lineHeight: 1.5,
    maxWidth: '60ch',
  },
  monitorPillsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
    flexWrap: 'wrap',
  },
  monitorPillsLabel: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-2)',
    fontWeight: 600,
  },
  monitorPill: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
  },
  monitorPillActive: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--accent)',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  // Multi-Window Selection Styles
  multiWindowBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  multiWindowBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    flex: 1,
  },
  multiWindowCounterBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '26px',
    padding: '0 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  multiWindowHint: {
    fontSize: 'var(--fs-caption)',
    lineHeight: 1.4,
    color: 'var(--text-3)',
    flex: '1 1 320px',
  },
  multiWindowBarActions: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  multiWindowActionBtn: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
  },
  windowCheckbox: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '2px solid var(--border-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  windowCheckboxChecked: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '2px solid var(--accent-fill)',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  windowPillsBar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '18px',
    padding: '2px 0',
    overflowX: 'auto',
  },
  windowPillsLabel: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--text-2)',
    whiteSpace: 'nowrap',
  },
  windowPillsList: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  windowPill: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    maxWidth: '200px',
  },
  windowPillActive: {
    minHeight: '32px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    border: '1px solid var(--live)',
    backgroundColor: 'var(--live-soft)',
    color: 'var(--text-1)',
    maxWidth: '220px',
  },
  windowPillDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--border-strong)',
    flexShrink: 0,
  },
  windowPillDotActive: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--live)',
    flexShrink: 0,
  },
  windowPillText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  windowPillActiveBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--live)',
    flexShrink: 0,
  },
};

