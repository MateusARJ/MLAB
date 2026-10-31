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
import { closeRoom, getRoomLink } from '../services/room';
import mlabLogo from '../assets/MLAB-logo.png';
import {
  colors,
  radii,
  typography,
  IconButton,
  Screen,
  Application,
  Camera,
  Microphone,
  MicrophoneOff,
  Recording,
  Chat,
  Locked,
  UserMultiple,
  Folder,
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
  const [isPrivacyShieldActive, setIsPrivacyShieldActive] = useState<boolean>(false);
  const [isLiveSession, setIsLiveSession] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedMdns, setCopiedMdns] = useState<boolean>(false);
  const [copiedIp, setCopiedIp] = useState<boolean>(false);
  const [screenshotMsg, setScreenshotMsg] = useState<string | null>(null);
  const [links, setLinks] = useState({
    link: room.link,
    ipLink: room.ipLink || room.link,
    mdnsLink: room.mdnsLink || '',
    shortIpLink: room.shortIpLink || '',
    shortMdnsLink: room.shortMdnsLink || '',
  });

  useEffect(() => {
    if ((!room.mdnsLink || !room.ipLink) && room.id) {
      getRoomLink(room.id)
        .then((resp) => {
          if (resp) {
            setLinks({
              link: resp.link || room.link,
              ipLink: resp.ip_link || resp.link || room.link,
              mdnsLink: resp.mdns_link || '',
              shortIpLink: resp.short_ip_link || '',
              shortMdnsLink: resp.short_mdns_link || '',
            });
          }
        })
        .catch(() => {});
    }
  }, [room.id, room.mdnsLink, room.ipLink, room.link]);

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
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
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

      const currentX = toolbarPos ? toolbarPos.x : 12;
      const currentY = toolbarPos ? toolbarPos.y : Math.max(12, Math.round(effectiveH * 0.15));
      const offsetX = e.clientX - containerRect.left - currentX;
      const offsetY = e.clientY - containerRect.top - currentY;

      isDraggingToolbarRef.current = true;
      dragToolbarMovedRef.current = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingToolbarRef.current) return;
        const rawX = moveEvent.clientX - containerRect.left - offsetX;
        const rawY = moveEvent.clientY - containerRect.top - offsetY;
        const nextX = Math.max(8, Math.min(effectiveW - 56, Math.round(rawX)));
        const nextY = Math.max(8, Math.min(effectiveH - 56, Math.round(rawY)));
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
    const link = links.mdnsLink || links.link;
    if (!link) return;
    await copyToClipboard(link);
    setCopiedMdns(true);
    setTimeout(() => setCopiedMdns(false), 2000);
  }, [copyToClipboard, links.mdnsLink, links.link]);

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
      setIsPrivacyShieldActive(false);

      const fps = qualityProfile === '1080p_60' ? 60 : 30;
      const newStream = await selectSource(targetSrc, fps, selectedWindowSources.map((s) => s.id));
      if (newStream) {
        await changeStream(newStream);
      }
    });

    const unsubUnauthorized = window.electronAPI.onActiveWindowUnauthorized?.((data: { isUnauthorized: boolean }) => {
      setIsPrivacyShieldActive(Boolean(data?.isUnauthorized));
    });

    return () => {
      if (typeof unsubChanged === 'function') unsubChanged();
      if (typeof unsubUnauthorized === 'function') unsubUnauthorized();
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
    setIsPrivacyShieldActive(false);

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
    fetch(`http://localhost:8080/rooms/${room.id}/files`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setUploadedFiles(data);
        }
      })
      .catch((err) => console.warn('Erro ao carregar arquivos da sala:', err));
  }, [room?.id]);

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
    setIsPrivacyShieldActive(false);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploading(true);
    setUploadMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch(`http://localhost:8080/rooms/${room.id}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao enviar arquivo');
      }

      const fileData = await resp.json();
      setUploadedFiles((prev) => [...prev, fileData]);
      setUploadMsg(`Arquivo "${file.name}" compartilhado com sucesso com a turma!`);
      setTimeout(() => setUploadMsg(null), 5000);
    } catch (err: any) {
      setUploadMsg(`Falha no upload: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
  const professorName = typeof window !== 'undefined' ? sessionStorage.getItem('professor_name') : null;

  return (
    <div style={styles.container}>
      {/* Cabeçalho */}
      <header style={styles.header}>
        <div style={styles.headerTitleBox}>
          <img src={mlabLogo} alt="MLab Logo" style={styles.logoImg} />
          <div>
            <h2 style={styles.title}>{professorName ? `MLab — Prof. ${professorName.charAt(0).toUpperCase() + professorName.slice(1)}` : `MLab — Sala: ${room.slug}`}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              {/* Link Fixo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 600, minWidth: '86px' }}>Link Fixo:</span>
                <span style={styles.roomLinkStatic}>{links.mdnsLink || links.link}</span>
                <IconButton
                  type="button"
                  variant={copiedMdns ? 'success' : 'ghost'}
                  size="sm"
                  onClick={handleCopyMdns}
                  title={copiedMdns ? 'Link Fixo Copiado' : 'Copiar Link Fixo'}
                  aria-label="Copiar Link Fixo"
                >
                  {copiedMdns ? <Checkmark size={14} /> : <Copy size={14} />}
                </IconButton>
              </div>

              {/* Link Direto IP */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 600, minWidth: '86px' }}>Link IP Direto:</span>
                <span style={styles.roomLinkStatic}>{links.ipLink || links.link}</span>
                <IconButton
                  type="button"
                  variant={copiedIp ? 'success' : 'ghost'}
                  size="sm"
                  onClick={handleCopyIp}
                  title={copiedIp ? 'Link IP Copiado' : 'Copiar Link Direto IP'}
                  aria-label="Copiar Link Direto IP"
                >
                  {copiedIp ? <Checkmark size={14} /> : <Copy size={14} />}
                </IconButton>
              </div>
            </div>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button
            onClick={handleEndSession}
            style={isSaving ? styles.closeBtnDisabled : styles.closeBtn}
            disabled={isSaving}
          >
            {isSaving ? 'Salvando Gravação...' : 'Encerrar Transmissão'}
          </button>
        </div>
      </header>

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
            <h3 style={styles.setupHeader}>Configurações de Transmissão e Gravação</h3>
            <p style={styles.setupSub}>Configure as opções da sua aula antes de iniciar a transmissão ao vivo para os alunos.</p>

            {/* 1. Escolha de Gravação Local */}
            <div style={styles.sectionBox}>
              <h4 style={styles.sectionTitle}>1. Deseja gravar esta aula no seu computador?</h4>
              <div style={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => setWantRecord(true)}
                  style={wantRecord ? styles.choiceBtnActive : styles.choiceBtn}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Recording size={16} /> Sim, Gravar Aula</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWantRecord(false)}
                  style={!wantRecord ? styles.choiceBtnActive : styles.choiceBtn}
                >
                  Apenas Transmitir (Sem Gravação)
                </button>
              </div>

              {wantRecord && (
                <div style={styles.formatSelectBox}>
                  <label style={styles.formatLabel}>Formato do arquivo de vídeo:</label>
                  <div style={styles.buttonGroup}>
                    <button
                      type="button"
                      style={styles.subChoiceBtnActive}
                    >
                      .webm (Alta Fidelidade em 1080p)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Modo de Transmissão de Tela */}
            <div style={styles.sectionBox}>
              <div style={styles.sectionHeaderRow}>
                <h4 style={styles.sectionTitle}>2. Escolha o modo de captura de tela</h4>
                <button
                  type="button"
                  onClick={refreshSources}
                  style={styles.refreshSourcesBtn}
                  title="Atualizar lista de janelas e telas abertas"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Renew size={14} /> Atualizar Janelas</span>
                </button>
              </div>
              <div style={styles.modeTabs}>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode('screen');
                    const primary = sources.find((s) => s.type === 'screen') || sources[0] || null;
                    setTentativeSource(primary);
                  }}
                  style={captureMode === 'screen' ? styles.modeTabActive : styles.modeTab}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Screen size={16} /> Tela Cheia (Acompanha o SO e Navegação)</span>
                </button>
                <button
                  type="button"
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
                  style={captureMode === 'window' ? styles.modeTabActive : styles.modeTab}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Application size={16} /> Janela / Aba Específica (Múltiplas Selecionáveis)</span>
                </button>
              </div>

              {captureMode === 'screen' ? (
                <div style={styles.autoScreenCard}>
                  <div style={styles.autoScreenLeft}>
                    {currentSource?.thumbnail ? (
                      <img src={currentSource.thumbnail} alt={currentSource.name} style={styles.autoScreenThumb} />
                    ) : (
                      <div style={styles.autoScreenPlaceholder}>
                        <Screen size={48} />
                      </div>
                    )}
                    <div style={styles.autoScreenDetails}>
                      <div style={styles.autoScreenHeaderRow}>
                        <span style={styles.autoScreenTitle}>{currentSource?.name || 'Monitor Principal'}</span>
                        <span style={styles.autoSelectedBadge}>
                          <Checkmark size={13} style={{ marginRight: '4px' }} /> Selecionado Automaticamente
                        </span>
                      </div>
                      <p style={styles.autoScreenDesc}>
                        A tela inteira será transmitida em alta resolução. Toda a sua navegação, trocas de aplicativos e menus do Windows serão transmitidos em tempo real para os alunos.
                      </p>
                      {sources.length > 1 && (
                        <div style={styles.monitorPillsRow}>
                          <span style={styles.monitorPillsLabel}>Alternar monitor:</span>
                          {sources.map((src) => {
                            const isSelected = currentSource?.id === src.id;
                            return (
                              <button
                                key={src.id}
                                type="button"
                                onClick={() => setTentativeSource(src)}
                                style={isSelected ? styles.monitorPillActive : styles.monitorPill}
                              >
                                {src.name} {isSelected ? '(Ativo)' : ''}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.windowHintBox}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle', marginRight: '4px' }}><Idea size={16} /></span><strong>Dica:</strong> Certifique-se de que a janela ou navegador esteja aberto na Área de Trabalho (não minimizado na barra de tarefas) para que seja listado.
                  </div>

                  <div style={styles.multiWindowBar}>
                    <div style={styles.multiWindowBarLeft}>
                      <span style={styles.multiWindowCounterBadge}>
                        {selectedWindowSources.length} {selectedWindowSources.length === 1 ? 'janela autorizada' : 'janelas autorizadas'}
                      </span>
                      <span style={styles.multiWindowHint}>
                        O MLab transmite a janela autorizada que você estiver usando. Aplicativos não selecionados (ex: WhatsApp, e-mails pessoais) ficam ocultos e protegidos.
                      </span>
                    </div>
                    <div style={styles.multiWindowBarActions}>
                      <button
                        type="button"
                        onClick={() => setSelectedWindowSources([...sources])}
                        style={styles.multiWindowActionBtn}
                        title="Autorizar todas as janelas abertas"
                      >
                        Selecionar Todas
                      </button>
                      {selectedWindowSources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSelectedWindowSources(sources.length > 0 ? [sources[0]] : [])}
                          style={styles.multiWindowActionBtn}
                          title="Transmitir apenas a primeira janela"
                        >
                          Apenas a Primeira
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={styles.sourceGrid}>
                    {sources.length === 0 ? (
                      <p style={styles.noSources}>Nenhuma janela detectada. Certifique-se de que a janela desejada não está minimizada.</p>
                    ) : (
                      sources.map((src) => {
                        const isSelected = selectedWindowSources.some((s) => s.id === src.id);
                        return (
                          <div
                            key={src.id}
                            onClick={() => handleToggleWindowSelection(src)}
                            style={isSelected ? styles.sourceCardSelected : styles.sourceCard}
                            title={isSelected ? 'Clique para desmarcar esta janela' : 'Clique para autorizar esta janela'}
                          >
                            <img src={src.thumbnail} alt={src.name} style={styles.thumbnail} />
                            <span style={styles.sourceName}>{src.name}</span>
                            <div style={isSelected ? styles.windowCheckboxChecked : styles.windowCheckbox}>
                              {isSelected ? <Checkmark size={12} /> : null}
                            </div>
                            {isSelected && (
                              <span style={styles.selectedBadge}>
                                <Checkmark size={12} style={{ marginRight: '4px' }} />Autorizada
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 3. Qualidade da Transmissão */}
            <div style={styles.sectionBox}>
              <h4 style={styles.sectionTitle}>3. Resolução e Qualidade de Vídeo</h4>
              <div style={styles.qualitySelectorGrid}>
                <div
                  onClick={() => handleSelectQuality('1080p_30')}
                  style={qualityProfile === '1080p_30' ? styles.qualityCardActive : styles.qualityCard}
                  role="button"
                  tabIndex={0}
                >
                  <div style={styles.qualityCardHeader}>
                    <span style={{ ...styles.qualityCardTitle, display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Screen size={16} /> 1080p Full HD @ 30 fps</span>
                    {qualityProfile === '1080p_30' && <span style={styles.selectedBadgeInline}><Checkmark size={12} style={{ marginRight: '4px' }} />Selecionado</span>}
                  </div>
                  <div style={styles.qualityDetails}>
                    <span style={styles.qualityParam}>Bitrate: <strong>4.0 Mbps</strong> (Padrão)</span>
                    <span style={styles.qualityParam}>Otimização: <strong>Nitidez para Textos e Código</strong></span>
                    <span style={styles.qualityParam}>Fidelidade: <strong>Resolução Bloqueada</strong> (sem rebaixamento)</span>
                  </div>
                </div>

                <div
                  onClick={() => handleSelectQuality('1080p_60')}
                  style={qualityProfile === '1080p_60' ? styles.qualityCardActive : styles.qualityCard}
                  role="button"
                  tabIndex={0}
                >
                  <div style={styles.qualityCardHeader}>
                    <span style={{ ...styles.qualityCardTitle, display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Play size={16} /> 1080p Full HD @ 60 fps</span>
                    {qualityProfile === '1080p_60' && <span style={styles.selectedBadgeInline}><Checkmark size={12} style={{ marginRight: '4px' }} />Selecionado</span>}
                  </div>
                  <div style={styles.qualityDetails}>
                    <span style={styles.qualityParam}>Bitrate: <strong>6.0 Mbps</strong> (Alta Fluidez)</span>
                    <span style={styles.qualityParam}>Otimização: <strong>Fluidez Máxima para Vídeos e Animações</strong></span>
                    <span style={styles.qualityParam}>Fidelidade: <strong>60 fps Contínuos</strong> (Ultra Nítido)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Botão de Avanço */}
            <div style={styles.advanceBar}>
              <button
                type="button"
                onClick={handleStartSession}
                disabled={!currentSource}
                style={currentSource ? styles.advanceBtn : styles.advanceBtnDisabled}
              >
                Avançar e Iniciar Transmissão {wantRecord ? '(Com Gravação)' : ''} →
              </button>
            </div>
          </div>
        ) : (
          /* ── SESSÃO AO VIVO (TRANSMISSÃO + BARRA + SIDEBAR RETRÁTIL) ── */
          <div style={styles.liveContainer}>
            <div style={styles.liveContentArea}>
              {/* Seção Principal da Transmissão */}
              <div style={styles.liveMainSection}>
                {/* Barra de Status */}
                <div style={styles.statusBar}>
                  <div style={styles.statusLeft}>
                    <span style={styles.liveBadge}>
                      <span style={styles.pulsingDotGreen} /> AO VIVO
                    </span>
                    <span style={styles.resolutionBadge}>
                      {qualityProfile === '1080p_60' ? '1080p @ 60fps' : '1080p @ 30fps'}
                    </span>
                    <span style={styles.studentsBadge}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><UserMultiple size={14} /> {studentsOnly.length} {studentsOnly.length === 1 ? 'Aluno' : 'Alunos'}</span>
                    </span>
                    <span style={styles.statusInfo}>
                      Modo: {captureMode === 'screen' ? 'Tela Cheia' : (selectedWindowSources.length > 1 ? `Janela Específica (Múltiplas - ${selectedWindowSources.length} autorizadas)` : 'Janela Específica')} (
                      {activeWindowSource?.name || selectedSource?.name || 'Fonte Ativa'})
                    </span>
                  </div>

                  <div style={styles.statusRight}>
                    {wantRecord ? (
                      <div style={styles.recordStatusBox}>
                        {recordingStatus === 'recording' && (
                          <span style={styles.recordingBadge}>
                            <span style={styles.pulsingDotRed} /> REC {formattedDuration} (.webm)
                          </span>
                        )}
                        {recordingStatus === 'paused' && (
                          <span style={styles.pausedBadge}>PAUSADO {formattedDuration}</span>
                        )}
                        {recordingStatus === 'stopped' && (
                          <span style={styles.stoppedBadge}>GRAVAÇÃO FINALIZADA</span>
                        )}

                        {recordingStatus === 'recording' && (
                          <button type="button" onClick={pauseRecording} style={styles.recControlBtn}>
                            Pausar
                          </button>
                        )}
                        {recordingStatus === 'paused' && (
                          <button type="button" onClick={resumeRecording} style={styles.recControlBtn}>
                            Retomar
                          </button>
                        )}
                        {recordingStatus !== 'stopped' && (
                          <button
                            type="button"
                            onClick={stopRecording}
                            disabled={isSaving}
                            style={styles.recSaveBtn}
                          >
                            {isSaving ? 'Salvando...' : 'Finalizar e Salvar'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span style={styles.noRecordBadge}>Modo Apenas Transmissão</span>
                    )}
                  </div>
                </div>

                {/* Visualizador da Transmissão + Barra Vertical de Marcação e Lupa no Lado Esquerdo */}
                <div ref={previewAreaRef} style={styles.previewArea}>
                  {/* Barra Vertical de Marcação (Estilo Editor de PDF) e Lupa — Posicionável e Retrátil */}
                  <div
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
                            backgroundColor: spotlight.enabled ? '#facc15' : strokeColor,
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
                            alt="Pré-visualização da Tela Cheia"
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
                        <Touch_1Filled size={18} style={{ color: '#0f62fe', flexShrink: 0 }} />
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

                {/* Barra de Controles de Transmissão */}
                <div style={styles.controlsBar}>
                  <button
                    type="button"
                    onClick={toggleMicMute}
                    style={micMuted ? styles.controlBtnActive : styles.controlBtn}
                  >
                    {micMuted ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><MicrophoneOff size={16} /> Desmutar Microfone</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Microphone size={16} /> Mutar Microfone</span>}
                  </button>
                  <button
                    type="button"
                    onClick={toggleSystemAudio}
                    style={systemAudioMuted ? styles.controlBtnActive : styles.controlBtn}
                    title={systemAudioMuted ? "Transmitir o áudio interno do computador (vídeos educativos, músicas, etc.) para os alunos" : "Silenciar o áudio interno do computador"}
                  >
                    {systemAudioMuted ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <VolumeMute size={16} /> Ativar Som do PC
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <VolumeUp size={16} /> Silenciar Som do PC
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleVideoPause}
                    style={videoPaused ? styles.controlBtnPauseActive : styles.controlBtn}
                  >
                    {videoPaused ? 'Retomar Vídeo' : 'Pausar Vídeo'}
                  </button>
                  <button type="button" onClick={handleReconfigure} style={styles.controlBtn}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Settings size={16} /> Alterar Modo / Fonte</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTakeScreenshot}
                    style={styles.controlBtn}
                    title="Tirar print da janela do MLab e copiar para a área de transferência (F10 / PrintScreen)"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Camera size={16} /> Tirar Print
                    </span>
                  </button>
                  {/* Alternância rápida entre monitores se houver mais de uma tela detectada */}
                  {captureMode === 'screen' && screenSources.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextSource = screenSources.find((s) => s.id !== selectedSource?.id) || screenSources[0];
                        handleSwitchScreen(nextSource);
                      }}
                      style={styles.controlBtn}
                      title="Alternar rapidamente o monitor sendo transmitido"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Screen size={16} /> Alternar Monitor</span>
                    </button>
                  )}
                  {/* Botão de Chat no Header de Baixo */}
                  <button
                    type="button"
                    onClick={handleToggleSidebar}
                    style={isSidebarOpen ? styles.controlBtnActiveChat : styles.controlBtn}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Chat size={16} /> Chat & Turma</span>
                    {unreadCount > 0 && (
                      <span style={styles.unreadBadge}>{unreadCount}</span>
                    )}
                    {raisedHandsStudents.length > 0 && (
                      <span style={styles.raisedHandHeaderBadge} title={`${raisedHandsStudents.length} mão(s) levantada(s)`}>
                        <Touch_1Filled size={12} /> {raisedHandsStudents.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Sidebar Retrátil na Direita (Padrão de Retração) */}
              <aside
                style={{
                  ...styles.sidebarDesktop,
                  width: isSidebarOpen ? '360px' : '0px',
                  minWidth: isSidebarOpen ? '360px' : '0px',
                  opacity: isSidebarOpen ? 1 : 0,
                  borderLeft: isSidebarOpen ? '1px solid #1e293b' : 'none',
                  pointerEvents: isSidebarOpen ? 'auto' : 'none',
                }}
              >
                {/* Header da Sidebar */}
                <div style={styles.sidebarHeader}>
                  <div style={styles.tabButtons}>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('chat')}
                      style={sidebarTab === 'chat' ? styles.tabBtnActive : styles.tabBtn}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Chat size={16} /> Chat</span>
                      {unreadCount > 0 && <span style={styles.tabBadge}>{unreadCount}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('students')}
                      style={sidebarTab === 'students' ? styles.tabBtnActive : styles.tabBtn}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <UserMultiple size={16} /> Alunos ({studentsOnly.length})
                        {raisedHandsStudents.length > 0 && (
                          <span style={styles.tabHandBadge} title={`${raisedHandsStudents.length} mão(s) levantada(s)`}>
                            <Touch_1Filled size={11} /> {raisedHandsStudents.length}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('files')}
                      style={sidebarTab === 'files' ? styles.tabBtnActive : styles.tabBtn}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Folder size={16} /> Arquivos ({uploadedFiles.length})</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    style={styles.closeSidebarBtn}
                    title="Recolher Painel"
                  >
                    <Close size={16} />
                  </button>
                </div>

                {/* Aba 1: Chat da Aula com Abas Separadas: Público vs Privado */}
                {sidebarTab === 'chat' && (
                  <div style={styles.chatTabContent}>
                    {/* Seletor de Sub-aba: Chat Público vs Chat Privado */}
                    <div style={styles.chatSubTabRow}>
                      <button
                        type="button"
                        onClick={() => {
                          setChatSubTab('public');
                        }}
                        style={chatSubTab === 'public' ? styles.chatSubTabActive : styles.chatSubTab}
                      >
                        Turma (Público)
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatSubTab('private')}
                        style={chatSubTab === 'private' ? styles.chatSubTabActivePrivate : styles.chatSubTab}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Locked size={14} /> Dúvidas Privadas</span>
                        {messages.filter((m: any) => m.is_private === true).length > 0 && (
                          <span style={styles.privateTabBadge}>
                            {messages.filter((m: any) => m.is_private === true).length}
                          </span>
                        )}
                      </button>
                    </div>

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
                                      <p style={{ ...styles.emptyText, fontSize: '11px', color: '#64748b' }}>
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
                                      <p style={{ ...styles.emptyText, fontSize: '11px', color: '#64748b' }}>
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
                            <Touch_1Filled size={16} style={{ color: '#0f62fe' }} /> Mãos Levantadas ({raisedHandsStudents.length})
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
                  <div style={styles.filesTabContent}>
                    <div style={styles.uploadSection}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
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

                      {uploadMsg && (
                        <div style={styles.uploadFeedbackBanner}>
                          {uploadMsg}
                        </div>
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
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#090d16',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 24px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  headerTitleBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImg: {
    width: '56px',
    height: '56px',
    objectFit: 'contain',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    margin: 0,
    lineHeight: '26px',
    letterSpacing: '-0.02em',
  },
  roomLinkStatic: {
    fontSize: '12px',
    fontFamily: 'monospace, Consolas, sans-serif',
    color: colors.textPrimary,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: '2px 8px',
    borderRadius: radii.sm,
    border: `1px solid ${colors.borderSubtle}`,
    userSelect: 'text',
    cursor: 'default',
  },
  screenshotSuccessBanner: {
    padding: '10px 16px',
    borderRadius: '8px',
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    border: '1px solid #16a34a',
    color: '#86efac',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  closeBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  closeBtnDisabled: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#64748b',
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  permissionAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    padding: '10px 24px',
    fontSize: '13px',
    borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  retryPermBtn: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    padding: '8px 24px',
    fontSize: '13px',
  },
  successBanner: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#86efac',
    padding: '10px 24px',
    fontSize: '13px',
    borderBottom: '1px solid rgba(34, 197, 94, 0.4)',
  },
  mainContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  mainContentLive: {
    flex: 1,
    overflow: 'hidden',
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 65px)',
    minHeight: 0,
    boxSizing: 'border-box',
  },
  setupCard: {
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  setupHeader: {
    fontSize: '22px',
    fontWeight: '700',
    margin: 0,
    color: '#f8fafc',
  },
  setupSub: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
  },
  sectionBox: {
    backgroundColor: '#172033',
    padding: '20px',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e2e8f0',
    margin: 0,
  },
  sectionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  refreshSourcesBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#38bdf8',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  windowHintBox: {
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    color: '#93c5fd',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  choiceBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  choiceBtnActive: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  formatSelectBox: {
    marginTop: '6px',
    paddingTop: '12px',
    borderTop: '1px solid #243048',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formatLabel: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  subChoiceBtnActive: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#4ade80',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
  modeTabs: {
    display: 'flex',
    gap: '10px',
  },
  modeTab: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'center',
  },
  modeTabActive: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    color: '#38bdf8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'center',
  },
  sourceGrid: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    maxHeight: '260px',
    overflowY: 'auto',
    padding: '4px',
  },
  noSources: {
    color: '#94a3b8',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  sourceCard: {
    width: '180px',
    padding: '10px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
  },
  sourceCardSelected: {
    width: '180px',
    padding: '10px',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    border: '2px solid #38bdf8',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '95px',
    objectFit: 'cover',
    borderRadius: '4px',
  },
  sourceName: {
    fontSize: '12px',
    color: '#f8fafc',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%',
  },
  selectedBadgeInline: {
    backgroundColor: colors.accent,
    color: colors.bgBase,
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: radii.sm,
    display: 'inline-flex',
    alignItems: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    backgroundColor: '#38bdf8',
    color: '#090d16',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  advanceBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  advanceBtn: {
    padding: '12px 28px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  advanceBtnDisabled: {
    padding: '12px 28px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#334155',
    color: '#64748b',
    fontSize: '15px',
    fontWeight: '600',
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
    gap: '12px',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  liveMainSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: 0,
    justifyContent: 'space-between',
  },
  statusBar: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    border: '1px solid #1e293b',
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  pulsingDotGreen: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
  },
  resolutionBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    padding: '2px 7px',
    borderRadius: '6px',
  },
  studentsBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#e2e8f0',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid #334155',
    padding: '2px 7px',
    borderRadius: '6px',
  },
  qualitySelectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  },
  qualityCard: {
    position: 'relative',
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  qualityCardActive: {
    position: 'relative',
    backgroundColor: '#0f172a',
    border: '1.5px solid #38bdf8',
    boxShadow: '0 0 12px rgba(56, 189, 248, 0.15)',
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  qualityCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityCardTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: '700',
    fontSize: '14px',
    color: '#e2e8f0',
  },
  qualityDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  qualityParam: {
    display: 'flex',
    gap: '4px',
  },
  statusInfo: {
    fontSize: '12px',
    color: '#cbd5e1',
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
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#f87171',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  pulsingDotRed: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
  pausedBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#38bdf8',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  stoppedBadge: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  noRecordBadge: {
    fontSize: '12px',
    color: '#64748b',
  },
  recControlBtn: {
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    fontSize: '11px',
    cursor: 'pointer',
  },
  recSaveBtn: {
    padding: '5px 10px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#22c55e',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  previewArea: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    backgroundColor: '#020617',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  handToastOverlay: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: 10,
    backgroundColor: '#161616',
    border: '1px solid #0f62fe',
    borderLeft: '4px solid #0f62fe',
    borderRadius: '6px',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    maxWidth: '340px',
  },
  handToastContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  handToastText: {
    fontSize: '12px',
    color: '#f4f4f4',
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
    padding: '3px 8px',
    backgroundColor: '#0f62fe',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  handToastDismissBtn: {
    background: 'transparent',
    border: 'none',
    color: '#c6c6c6',
    cursor: 'pointer',
    padding: '2px',
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
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '500',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(51, 65, 85, 0.7)',
    backdropFilter: 'blur(6px)',
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
    fontSize: '48px',
    marginBottom: '12px',
  },
  screenShieldTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 8px 0',
  },
  screenShieldSubtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
    maxWidth: '400px',
  },
  pausedOverlayBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    color: '#38bdf8',
    fontSize: '16px',
    fontWeight: '700',
    padding: '12px 24px',
    borderRadius: '10px',
    border: '1px solid rgba(56, 189, 248, 0.4)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    zIndex: 10,
  },
  controlsBar: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    padding: '10px 16px',
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    border: '1px solid #1e293b',
  },
  controlBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  controlBtnActive: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  controlBtnPauseActive: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #0284c7',
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    color: '#38bdf8',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  controlBtnActiveChat: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #38bdf8',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '10px',
    lineHeight: '1',
  },
  raisedHandHeaderBadge: {
    backgroundColor: '#0f62fe',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '10px',
    lineHeight: '1',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
  },
  sidebarDesktop: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.25s ease, opacity 0.2s ease',
  },
  sidebarHeader: {
    padding: '10px 12px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#172033',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  tabButtons: {
    display: 'flex',
    gap: '6px',
    flex: 1,
  },
  tabBtn: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
  },
  tabBtnActive: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '8px',
  },
  tabHandBadge: {
    backgroundColor: '#0f62fe',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
  },
  closeSidebarBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: '4px',
  },
  chatTabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatSubTabRow: {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  chatSubTab: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  chatSubTabActive: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  chatSubTabActivePrivate: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    color: '#c084fc',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  privateTabBadge: {
    backgroundColor: '#a855f7',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '8px',
  },
  privateSelectPromptBox: {
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateSelectPromptText: {
    padding: '6px 10px',
    fontSize: '11px',
    color: '#c084fc',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: '6px',
    border: '1px dashed rgba(168, 85, 247, 0.4)',
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  emptyMessagesBox: {
    padding: '30px 16px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
  },
  messageCard: {
    backgroundColor: '#172033',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
  },
  privateMessageCard: {
    backgroundColor: 'rgba(49, 46, 129, 0.4)',
    border: '1px solid #6366f1',
  },
  pinnedMessageCard: {
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  pinnedPrivateMessageCard: {
    border: '1px solid #a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  pinnedBannerBox: {
    padding: '8px 12px',
    backgroundColor: 'rgba(14, 116, 144, 0.18)',
    borderBottom: '1px solid rgba(56, 189, 248, 0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pinnedBannerBoxPrivate: {
    padding: '8px 12px',
    backgroundColor: 'rgba(88, 28, 135, 0.22)',
    borderBottom: '1px solid rgba(168, 85, 247, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pinnedBannerHeader: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedBannerHeaderPrivate: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#c084fc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedBannerItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '5px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
  },
  pinnedBannerText: {
    fontSize: '11px',
    color: '#f1f5f9',
    flex: 1,
    wordBreak: 'break-word',
  },
  pinMsgBtn: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    color: '#94a3b8',
    padding: '2px 4px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinMsgBtnActive: {
    background: 'rgba(56, 189, 248, 0.18)',
    border: '1px solid #38bdf8',
    borderRadius: '4px',
    color: '#38bdf8',
    padding: '2px 4px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinMsgBtnActivePrivate: {
    background: 'rgba(168, 85, 247, 0.2)',
    border: '1px solid #a855f7',
    borderRadius: '4px',
    color: '#c084fc',
    padding: '2px 4px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinMsgBtnDisabled: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    color: '#475569',
    padding: '2px 4px',
    cursor: 'not-allowed',
    opacity: 0.45,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  senderName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#38bdf8',
  },
  matriculaText: {
    color: '#e2e8f0',
    fontWeight: '500',
    fontSize: '11px',
  },
  roleTag: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  publicTag: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid #38bdf8',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  privateTag: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#c7d2fe',
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    border: '1px solid #818cf8',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  messageBody: {
    fontSize: '13px',
    color: '#f8fafc',
    margin: 0,
    wordBreak: 'break-word',
  },
  replyPrivateBtn: {
    marginTop: '6px',
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#a5b4fc',
    backgroundColor: 'transparent',
    border: '1px solid #6366f1',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  chatForm: {
    padding: '12px',
    borderTop: '1px solid #1e293b',
    backgroundColor: '#172033',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  targetIndicatorBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #6366f1',
  },
  targetIndicatorText: {
    fontSize: '11px',
    color: '#c7d2fe',
  },
  clearTargetBtn: {
    background: 'transparent',
    border: 'none',
    color: '#f87171',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  publicIndicatorText: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  chatInputRow: {
    display: 'flex',
    gap: '8px',
  },
  chatInput: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '12px',
    outline: 'none',
  },
  sendBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  sendPrivateBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#6366f1',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  privateHeaderBox: {
    padding: '10px 12px',
    backgroundColor: '#111c30',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  privateSelectLabel: {
    fontSize: '11px',
    color: '#a5b4fc',
    fontWeight: '600',
  },
  studentSelect: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #475569',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
  },
  studentsTabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  studentsListHeader: {
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1e293b',
  },
  studentsListTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  studentsCountBadge: {
    fontSize: '11px',
    color: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: '600',
  },
  studentsList: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  studentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: '#172033',
    borderRadius: '8px',
    border: '1px solid #1e293b',
  },
  studentAvatar: {
    fontSize: '20px',
  },
  studentInfoBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
  },
  studentNameText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  studentMatriculaText: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  startPrivateChatBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#c7d2fe',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
  raisedHandsSection: {
    padding: '10px 12px',
    backgroundColor: 'rgba(15, 98, 254, 0.08)',
    borderBottom: '1px solid rgba(15, 98, 254, 0.3)',
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
    fontSize: '12px',
    fontWeight: '600',
    color: '#78a9ff',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  raisedHandsHelp: {
    fontSize: '10px',
    color: '#a8a8a8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  raisedHandsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  raisedHandCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    backgroundColor: '#161616',
    borderRadius: '6px',
    border: '1px solid #0f62fe',
  },
  raisedHandOrderBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#0f62fe',
    backgroundColor: 'rgba(15, 98, 254, 0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
    flexShrink: 0,
  },
  raisedHandActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  lowerHandBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #da1e28',
    backgroundColor: 'rgba(218, 30, 40, 0.15)',
    color: '#ff8389',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  lowerHandSmallBtn: {
    padding: '4px 6px',
    borderRadius: '4px',
    border: '1px solid #da1e28',
    backgroundColor: 'rgba(218, 30, 40, 0.15)',
    color: '#ff8389',
    fontSize: '11px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentHandTag: {
    fontSize: '10px',
    color: '#78a9ff',
    backgroundColor: 'rgba(15, 98, 254, 0.15)',
    padding: '1px 6px',
    borderRadius: '10px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  filesTabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  uploadSection: {
    padding: '14px 12px',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  uploadBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px dashed #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
  },
  uploadBtnDisabled: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px dashed #475569',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '12px',
    cursor: 'not-allowed',
    textAlign: 'center',
  },
  uploadFeedbackBanner: {
    padding: '8px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid #22c55e',
    color: '#86efac',
    fontSize: '11px',
    fontWeight: '500',
  },
  uploadedFilesList: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  filesListTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '4px',
  },
  fileItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    backgroundColor: '#172033',
    borderRadius: '6px',
    border: '1px solid #1e293b',
  },
  fileIcon: {
    fontSize: '18px',
  },
  fileInfoColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  fileItemName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileItemSize: {
    fontSize: '10px',
    color: '#94a3b8',
  },
  fileSharedBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
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
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid #334155',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(8px)',
    userSelect: 'none',
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
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    cursor: 'grab',
  },
  annotationCollapseMiniBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: 'rgba(51, 65, 85, 0.45)',
    color: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  annotationCollapsedFabBtn: {
    position: 'relative',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    color: '#38bdf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    padding: 0,
    boxShadow: '0 0 12px rgba(56, 189, 248, 0.28)',
  },
  annotationToolBtn: {
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
    transition: 'all 0.15s ease',
  },
  annotationToolBtnActive: {
    position: 'relative',
    width: '34px',
    height: '32px',
    borderRadius: '7px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
  },
  annotationToolBtnSpotlightActive: {
    position: 'relative',
    width: '34px',
    height: '32px',
    borderRadius: '7px',
    border: '1px solid #facc15',
    backgroundColor: 'rgba(250, 204, 21, 0.22)',
    color: '#facc15',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 12px rgba(250, 204, 21, 0.35)',
  },
  annotationToolBtnPaletteOpen: {
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
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.15)',
  },
  annotationToolBtnDisabled: {
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
  annotationToolBtnDanger: {
    position: 'relative',
    width: '34px',
    height: '30px',
    borderRadius: '7px',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  shortcutHintBadge: {
    position: 'absolute',
    bottom: '1px',
    right: '3px',
    fontSize: '8px',
    fontWeight: '700',
    color: '#94a3b8',
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
    border: '1px solid #0f172a',
  },
  annotationToolbarDivider: {
    width: '22px',
    height: '1px',
    backgroundColor: '#334155',
    margin: '2px 0',
  },
  palettePopoverBox: {
    position: 'absolute',
    left: '64px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 30,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.7)',
    minWidth: '175px',
  },
  paletteSectionTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
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
    padding: '4px 6px',
    borderRadius: '5px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  sizeOptionBtnActive: {
    flex: 1,
    padding: '4px 6px',
    borderRadius: '5px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    fontSize: '11px',
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
    backgroundColor: '#0f172a',
    border: '2px solid rgba(56, 189, 248, 0.4)',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
  },
  autoScreenLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  autoScreenThumb: {
    width: '200px',
    height: '115px',
    objectFit: 'cover',
    borderRadius: '6px',
    border: '2px solid #38bdf8',
    backgroundColor: '#000',
  },
  autoScreenPlaceholder: {
    width: '200px',
    height: '115px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#172033',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
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
    fontSize: '15px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  autoSelectedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: '700',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    color: '#38bdf8',
    border: '1px solid #38bdf8',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  autoScreenDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.4',
  },
  monitorPillsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
    flexWrap: 'wrap',
  },
  monitorPillsLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  monitorPill: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#172033',
    color: '#cbd5e1',
    fontSize: '12px',
    cursor: 'pointer',
  },
  monitorPillActive: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // Multi-Window Selection Styles
  multiWindowBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '10px 14px',
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
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    fontSize: '12px',
    fontWeight: '700',
  },
  multiWindowHint: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  multiWindowBarActions: {
    display: 'flex',
    gap: '8px',
  },
  multiWindowActionBtn: {
    padding: '5px 10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  windowCheckbox: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '1.5px solid #64748b',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  windowCheckboxChecked: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '1.5px solid #38bdf8',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  windowPillsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#0b1120',
    borderTop: '1px solid #1e293b',
    padding: '6px 16px',
    overflowX: 'auto',
  },
  windowPillsLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  windowPillsList: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  windowPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    fontSize: '12px',
    cursor: 'pointer',
    maxWidth: '180px',
  },
  windowPillActive: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    color: '#f8fafc',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    maxWidth: '200px',
  },
  windowPillDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#64748b',
    flexShrink: 0,
  },
  windowPillDotActive: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    boxShadow: '0 0 6px #22c55e',
    flexShrink: 0,
  },
  windowPillText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  windowPillActiveBadge: {
    fontSize: '9px',
    fontWeight: '700',
    backgroundColor: '#22c55e',
    color: '#090d16',
    padding: '1px 4px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
};

