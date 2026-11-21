import {
  Chat,
  Folder,
  Popup,
  Maximize,
  FillScreen,
  FitScreen,
  Exit,
  Close,
  Locked,
  Attachment,
  Download,
  Renew,
  Touch_1,
  Touch_1Filled,
  PinFilled,
  Alert,
  Button,
  BrandMark,
  StatusBadge,
  colors,
  radii,
  decodeChatEntities,
} from '@mlab/ui';
import React, { useRef, useEffect, useState } from 'react';
import { useWebRTCSubscriber } from '../hooks/useWebRTCSubscriber';
import { fileDownloadPath, fileDownloadUrl } from '../services/api';

interface RoomProps {
  token: string;
  roomInfo: {
    room_id: string;
    ws_url: string;
    ice_servers: any[];
    professor_name?: string;
    room_title?: string;
  };
  onLeave: (reason?: string) => void;
}

/** Rótulos do estado da conexão em linguagem do aluno (só apresentação). */
const CONNECTION_LABELS: Record<string, string> = {
  connecting: 'Conectando',
  connected: 'Conectado',
  reconnecting: 'Reconectando',
  closed: 'Encerrada',
  duplicate: 'Sessão duplicada',
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function checkIsMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const isSmallWidth = window.innerWidth <= 768;
  const isMobileLandscape =
    window.innerHeight > 0 &&
    window.innerHeight <= 500 &&
    window.innerWidth <= 1024 &&
    window.innerWidth > window.innerHeight;
  const isTouchDevice =
    typeof window !== 'undefined' &&
    window.innerWidth <= 1024 &&
    window.innerHeight > 0 &&
    window.innerHeight <= 600 &&
    ('ontouchstart' in window ||
      (typeof navigator !== 'undefined' &&
        ((navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
          ((navigator as any).msMaxTouchPoints && (navigator as any).msMaxTouchPoints > 0))) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches));

  return isSmallWidth || isMobileLandscape || isTouchDevice;
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as any;
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

// 049/RF-4905: modo do vídeo em tela cheia, salvo no dispositivo como o tema (`mlab-theme`). `cover` preenche a tela
// sem faixas (pode cortar as bordas); `contain` mostra a imagem inteira. Armazenamento indisponível não é erro.
type VideoFit = 'cover' | 'contain';
const VIDEO_FIT_KEY = 'mlab-video-fit';

function readVideoFit(): VideoFit {
  try {
    const v = window.localStorage.getItem(VIDEO_FIT_KEY);
    if (v === 'cover' || v === 'contain') return v;
  } catch {}
  return 'cover';
}

function saveVideoFit(fit: VideoFit): void {
  try {
    window.localStorage.setItem(VIDEO_FIT_KEY, fit);
  } catch {}
}

// 050/RF-5001, RF-5002: nome acessível dos botões do cabeçalho. No celular eles só têm ícone; sem `aria-label`, o
// selo de contagem viraria o nome ("1", "3"). A contagem entra no nome e o selo fica `aria-hidden`.
function filesButtonLabel(count: number): string {
  if (count <= 0) return 'Arquivos da aula';
  return `Arquivos da aula (${count} ${count === 1 ? 'arquivo' : 'arquivos'})`;
}

function withUnread(label: string, count: number): string {
  if (count <= 0) return label;
  if (count > 99) return `${label} (99+ não lidas)`;
  return `${label} (${count} ${count === 1 ? 'não lida' : 'não lidas'})`;
}

export const Room: React.FC<RoomProps> = ({ token, roomInfo, onLeave }) => {
  const {
    stream,
    autoplayBlocked,
    setAutoplayBlocked,
    connectionStatus,
    isStreamPaused = false,
    sharedFiles = [],
    messages = [],
    sendChatMessage,
    requestKeyframe,
    isHandRaised = false,
    toggleHand = () => {},
    chatNotice = null,
    dismissChatNotice = () => {},
    isChatReady = false,
  } = useWebRTCSubscriber(token, roomInfo);

  // Chat só aceita mensagens com o WebSocket da sala aberto (005/RF-506, C-506).
  const chatConnectingPlaceholder = 'Conectando ao chat...';

  // Aviso de limite do chat (CHAT_RATE_LIMITED — 001/plan.md §10b, 005/C-503).
  const chatNoticeAlert = chatNotice ? (
    <Alert variant="warning" message={chatNotice} onClose={dismissChatNotice} style={{ marginBottom: '8px' }} />
  ) : null;

  // Quando o professor encerra a transmissão (connectionStatus === 'closed'), redireciona de volta para a tela de credenciais
  useEffect(() => {
    if (connectionStatus === 'duplicate') {
      // RN-04: outra sessão do mesmo aluno assumiu o lugar desta (005/C-502).
      onLeave('Sua sessão foi aberta em outra aba ou dispositivo.');
    } else if (connectionStatus === 'student-id-in-use') {
      // RN-04 (ADR 0010): outro aluno já está conectado com esta matrícula (027/RF-2706).
      onLeave('Esta matrícula já está conectada nesta transmissão.');
    } else if (connectionStatus === 'closed') {
      onLeave('A transmissão foi encerrada pelo professor. Por favor, insira suas credenciais novamente.');
    }
  }, [connectionStatus, onLeave]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [publicChatInput, setPublicChatInput] = useState('');
  const [privateChatInput, setPrivateChatInput] = useState('');
  const [studentChatTab, setStudentChatTab] = useState<'public' | 'private'>('public');
  const [, setIsVideoHovered] = useState<boolean>(false);
  const [isFilesOpen, setIsFilesOpen] = useState<boolean>(false);
  const [mobileDrawerTab, setMobileDrawerTab] = useState<'chat' | 'files'>('chat');

  const [isMobile, setIsMobile] = useState<boolean>(() => checkIsMobileDevice());

  const [isChatOpen, setIsChatOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !checkIsMobileDevice();
    }
    return true;
  });

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState<boolean>(false);
  const [isFullscreenSidebarOpen, setIsFullscreenSidebarOpen] = useState<boolean>(false);
  const prevMessagesLength = useRef(messages.length);
  const publicMessagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para descer o chat quando novas mensagens forem adicionadas
  useEffect(() => {
    if (studentChatTab === 'public') {
      publicMessagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    } else {
      privateMessagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [messages.length, studentChatTab, isChatOpen]);

  // Auto-scroll da lista de arquivos, no mesmo padrão do chat (018/RF-191): ao abrir a lista e a cada arquivo
  // novo, mostra o último. A gaveta (desktop) e a aba do celular nunca aparecem juntas, então um ref basta.
  const filesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    filesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [sharedFiles.length, isFilesOpen, mobileDrawerTab, isChatOpen, isMobile]);

  const effectiveFullscreen = isFullscreen || isPseudoFullscreen;

  // 049/RF-4901 a RF-4905: Preencher (padrão) ou Ajustar, só em tela cheia.
  const [videoFit, setVideoFit] = useState<VideoFit>(readVideoFit);
  const toggleVideoFit = () => {
    setVideoFit((prev) => {
      const next: VideoFit = prev === 'cover' ? 'contain' : 'cover';
      saveVideoFit(next);
      return next;
    });
  };

  // 049/RF-4906: ao entrar em tela cheia, Chat e Arquivos fecham para o vídeo ocupar a tela; só na transição,
  // para continuarem abrindo pelo menu da transmissão.
  const wasFullscreenRef = useRef(false);
  useEffect(() => {
    if (effectiveFullscreen && !wasFullscreenRef.current) {
      setIsChatOpen(false);
      setIsFilesOpen(false);
    }
    wasFullscreenRef.current = effectiveFullscreen;
  }, [effectiveFullscreen]);

  useEffect(() => {
    const handleFsChange = () => {
      const fs = !!getFullscreenElement();
      setIsFullscreen(fs);
      if (!fs && !isPseudoFullscreen) {
        setIsFullscreenSidebarOpen(false);
        setIsVideoHovered(false);
        if (typeof window !== 'undefined' && window.screen?.orientation && 'unlock' in window.screen.orientation) {
          try {
            // @ts-ignore
            window.screen.orientation.unlock();
          } catch {}
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, [isPseudoFullscreen]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(checkIsMobileDevice());
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isChatOpen && messages.length > prevMessagesLength.current) {
      setUnreadCount((prev) => prev + (messages.length - prevMessagesLength.current));
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isChatOpen]);

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) return;

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }

    const attemptPlay = () => {
      if (!videoEl) return;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAutoplayBlocked(false);
          })
          .catch((err) => {
            // RF-21: Se o navegador bloquear áudio (Autoplay Policy), muta e inicia o vídeo instantaneamente
            if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
              videoEl.muted = true;
              videoEl
                .play()
                .then(() => {
                  setAutoplayBlocked(true);
                })
                .catch(() => {});
            }
          });
      }
    };

    // Tenta reproduzir imediatamente e em eventos sucessivos de disponibilidade de dados
    attemptPlay();

    videoEl.onloadedmetadata = () => {
      attemptPlay();
    };
    videoEl.onloadeddata = () => {
      attemptPlay();
    };
    videoEl.oncanplay = () => {
      attemptPlay();
    };

    const handleAddTrack = () => {
      if (videoEl && videoEl.srcObject === stream) {
        attemptPlay();
      }
    };

    const handleUnmuteTrack = () => {
      if (videoEl && videoEl.paused) {
        attemptPlay();
      }
    };

    const handleResize = () => {
      if (videoEl && videoEl.paused) {
        attemptPlay();
      }
    };

    const handleStalled = () => {
      if (typeof requestKeyframe === 'function') {
        requestKeyframe();
      }
    };

    videoEl.addEventListener('resize', handleResize);
    videoEl.addEventListener('stalled', handleStalled);
    videoEl.addEventListener('waiting', handleStalled);

    const videoTracks = typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
    videoTracks.forEach((t) => {
      if (typeof t.addEventListener === 'function') {
        t.addEventListener('unmute', handleUnmuteTrack);
      }
    });

    if (typeof stream.addEventListener === 'function') {
      stream.addEventListener('addtrack', handleAddTrack);
    }

    return () => {
      if (typeof stream.removeEventListener === 'function') {
        stream.removeEventListener('addtrack', handleAddTrack);
      }
      videoTracks.forEach((t) => {
        if (typeof t.removeEventListener === 'function') {
          t.removeEventListener('unmute', handleUnmuteTrack);
        }
      });
      if (videoEl) {
        videoEl.onloadedmetadata = null;
        videoEl.removeEventListener('resize', handleResize);
        videoEl.removeEventListener('stalled', handleStalled);
        videoEl.removeEventListener('waiting', handleStalled);
      }
    };
  }, [stream, requestKeyframe]);

  // Watchdog de desengasgo e descongelação de tela (destrava transmissões com picos de cores/partículas)
  useEffect(() => {
    if (!stream || isStreamPaused || connectionStatus !== 'connected') return;

    let lastTime = -1;
    let freezeCount = 0;

    const interval = setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl || videoEl.paused || videoEl.ended) return;

      // 1. Compensação ativa de drift de latência do elemento <video> (trava o aluno no 'ao vivo' instantâneo)
      if (videoEl.buffered && videoEl.buffered.length > 0) {
        try {
          const liveEdge = videoEl.buffered.end(videoEl.buffered.length - 1);
          const latencyLag = liveEdge - videoEl.currentTime;
          if (latencyLag > 0.35 && Number.isFinite(liveEdge)) {
            videoEl.currentTime = Math.max(0, liveEdge - 0.04);
          }
        } catch {}
      }

      // 2. Detecção de estagnação de quadros
      const currentTime = videoEl.currentTime;
      if (currentTime === lastTime && currentTime > 0) {
        freezeCount++;
        // Se a reprodução estagnar por 2 intervalos (500ms) mesmo sem pausar, solicita Keyframe imediato ao SFU
        if (freezeCount >= 2) {
          if (typeof requestKeyframe === 'function') {
            requestKeyframe();
          }
          freezeCount = 0;
        }
      } else {
        lastTime = currentTime;
        freezeCount = 0;
      }
    }, 250);

    return () => clearInterval(interval);
  }, [stream, isStreamPaused, connectionStatus, requestKeyframe]);

  // Reativa reprodução imediatamente quando o professor despausa a transmissão
  useEffect(() => {
    if (!isStreamPaused && videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isStreamPaused, stream]);

  const handleUnmuteAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
      setAutoplayBlocked(false);
    }
  };

  // Suporte a Fullscreen com orientação horizontal (Landscape) e fallback Pseudo-Fullscreen (iOS Safari)
  const handleToggleFullscreen = async () => {
    const container = containerRef.current as any;
    if (!container) return;

    if (!effectiveFullscreen) {
      let nativeFsSuccess = false;
      const requestFs =
        container.requestFullscreen ||
        container.webkitRequestFullscreen ||
        container.mozRequestFullScreen ||
        container.msRequestFullscreen;

      if (typeof requestFs === 'function') {
        try {
          await requestFs.call(container);
          nativeFsSuccess = true;
        } catch (err) {
          console.warn('Fullscreen nativo indisponível ou rejeitado, ativando fallback visual:', err);
        }
      }

      // Se o fullscreen nativo falhou ou não existe (ex.: iOS Safari em div), aciona pseudo-fullscreen via CSS
      if (!nativeFsSuccess && !getFullscreenElement()) {
        setIsPseudoFullscreen(true);
      }

      // Tenta travar orientação em landscape no smartphone
      if (checkIsMobileDevice() && typeof window !== 'undefined' && window.screen?.orientation && 'lock' in window.screen.orientation) {
        try {
          // @ts-ignore
          await window.screen.orientation.lock('landscape');
        } catch (err) {
          console.warn('Orientação landscape não suportada:', err);
        }
      }
    } else {
      if (isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
      }

      if (getFullscreenElement()) {
        const doc = document as any;
        const exitFs =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;

        if (typeof exitFs === 'function') {
          try {
            await exitFs.call(doc);
          } catch (e) {
            console.warn('Erro ao sair de fullscreen nativo:', e);
          }
        }
      }

      if (typeof window !== 'undefined' && window.screen?.orientation && 'unlock' in window.screen.orientation) {
        try {
          // @ts-ignore
          window.screen.orientation.unlock();
        } catch {}
      }
      setIsFullscreenSidebarOpen(false);
    }
  };

  // RF-22: Suporte a Picture-in-Picture
  const handleTogglePiP = () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else {
        videoRef.current.requestPictureInPicture().catch(() => {});
      }
    }
  };

  const handleSendPublicChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicChatInput.trim()) return;
    sendChatMessage(publicChatInput.trim(), false);
    setPublicChatInput('');
  };

  const handleSendPrivateChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateChatInput.trim()) return;
    sendChatMessage(privateChatInput.trim(), true);
    setPrivateChatInput('');
  };

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        ...(isPseudoFullscreen ? styles.pseudoFullscreen : {}),
      }}
    >
      {/* Botão flutuante semi-transparente no canto superior direito exclusivamente em tela cheia */}
      {effectiveFullscreen && !isChatOpen && !isFilesOpen && (
        <button
          onClick={() => setIsFullscreenSidebarOpen((prev) => !prev)}
          style={{
            ...styles.fullscreenMenuBtn,
            ...(isFullscreenSidebarOpen ? styles.fullscreenMenuBtnActive : {}),
          }}
          title={isFullscreenSidebarOpen ? 'Fechar menu da transmissão' : 'Abrir menu da transmissão'}
          aria-label={isFullscreenSidebarOpen ? 'Fechar menu da transmissão' : 'Abrir menu da transmissão'}
          aria-expanded={isFullscreenSidebarOpen}
          aria-controls="fullscreen-right-sidebar"
          data-testid="fullscreen-menu-trigger"
        >
          {isFullscreenSidebarOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
          {unreadCount > 0 && !isFullscreenSidebarOpen && (
            <span style={styles.fullscreenMenuBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      )}

      {/* Backdrop para fechar a sidebar ao tocar fora em tela cheia */}
      {effectiveFullscreen && isFullscreenSidebarOpen && (
        <div
          style={styles.fullscreenSidebarBackdrop}
          onClick={() => setIsFullscreenSidebarOpen(false)}
          data-testid="fullscreen-sidebar-backdrop"
        />
      )}

      {/* Sidebar Retrátil na lateral direita em tela cheia */}
      {effectiveFullscreen && (
        <aside
          id="fullscreen-right-sidebar"
          data-testid="fullscreen-right-sidebar"
          style={{
            ...styles.fullscreenRightSidebar,
            transform: isFullscreenSidebarOpen ? 'translateX(0)' : 'translateX(100%)',
            // 049/RF-4908: fechado fora da tela, a sombra vazaria como faixa escura na borda direita.
            boxShadow: isFullscreenSidebarOpen ? styles.fullscreenRightSidebar.boxShadow : 'none',
            pointerEvents: isFullscreenSidebarOpen ? 'auto' : 'none',
          }}
        >
          <div style={styles.fullscreenSidebarHeader}>
            <div style={styles.fullscreenBrandBox}>
              <BrandMark size={32} title="MLab" />
              <div>
                <h3 style={styles.fullscreenSidebarTitle}>
                  {roomInfo.professor_name ? `Prof. ${roomInfo.professor_name}` : 'MLab'}
                </h3>
                <span style={styles.fullscreenSidebarSubtitle}>Controles da Transmissão</span>
              </div>
            </div>
            {/* 043/RF-4305: sem botão de fechar aqui; o gatilho flutuante (X) fecha o menu no mesmo canto. */}
          </div>

          <div style={styles.fullscreenSidebarContent}>
            {/* Status da Transmissão idêntico ao do Header */}
            <div style={styles.fullscreenStatusCard}>
              <span style={styles.statusLabel}>
                {isStreamPaused ? (
                  <StatusBadge status="paused" label="Pausado" />
                ) : (
                  <StatusBadge
                    status={connectionStatus === 'connected' ? 'live' : connectionStatus === 'closed' || connectionStatus === 'duplicate' ? 'neutral' : 'waiting'}
                    label={CONNECTION_LABELS[connectionStatus] || connectionStatus}
                  />
                )}
              </span>
            </div>

            {/* Ações da Transmissão */}
            <div style={styles.fullscreenActionsGroup}>
              {/* Botão de Chat */}
              <button
                onClick={() => {
                  setIsFullscreenSidebarOpen(false);
                  if (isMobile) {
                    setMobileDrawerTab('chat');
                    setIsChatOpen(true);
                  } else {
                    setIsChatOpen(true);
                  }
                }}
                style={styles.fullscreenActionButton}
              >
                <div style={styles.fullscreenActionLeft}>
                  <span style={styles.fullscreenActionIcon}><Chat size={18} /></span>
                  <div style={styles.fullscreenActionMeta}>
                    <span style={styles.fullscreenActionTitle}>Chat da Turma</span>
                    <span style={styles.fullscreenActionDesc}>Mensagens públicas e privadas</span>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <span style={styles.unreadBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>

              {/* Botão de Arquivos */}
              <button
                onClick={() => {
                  setIsFullscreenSidebarOpen(false);
                  if (isMobile) {
                    setMobileDrawerTab('files');
                    setIsChatOpen(true);
                  } else {
                    setIsFilesOpen(true);
                  }
                }}
                style={styles.fullscreenActionButton}
              >
                <div style={styles.fullscreenActionLeft}>
                  <span style={styles.fullscreenActionIcon}><Folder size={18} /></span>
                  <div style={styles.fullscreenActionMeta}>
                    <span style={styles.fullscreenActionTitle}>Arquivos da Aula</span>
                    <span style={styles.fullscreenActionDesc}>Material compartilhado ({sharedFiles.length})</span>
                  </div>
                </div>
                {sharedFiles.length > 0 && (
                  <span style={styles.filesBadge}>{sharedFiles.length}</span>
                )}
              </button>

              {/* Levantar / Abaixar Mão em Tela Cheia */}
              <button
                onClick={() => {
                  toggleHand();
                }}
                style={isHandRaised ? styles.fullscreenActionButtonActive : styles.fullscreenActionButton}
                title={isHandRaised ? 'Abaixar mão' : 'Levantar mão'}
                aria-label={isHandRaised ? 'Abaixar mão' : 'Levantar mão'}
              >
                <div style={styles.fullscreenActionLeft}>
                  <span style={styles.fullscreenActionIcon}>
                    {isHandRaised ? <Touch_1Filled size={18} /> : <Touch_1 size={18} />}
                  </span>
                  <div style={styles.fullscreenActionMeta}>
                    <span style={styles.fullscreenActionTitle}>
                      {isHandRaised ? 'Mão Levantada (Abaixar)' : 'Levantar Mão'}
                    </span>
                    <span style={styles.fullscreenActionDesc}>
                      {isHandRaised ? 'Cancelar solicitação de dúvida' : 'Avisar o professor que você tem uma dúvida'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Picture-in-Picture */}
              <button
                onClick={() => {
                  setIsFullscreenSidebarOpen(false);
                  handleTogglePiP();
                }}
                style={styles.fullscreenActionButton}
              >
                <div style={styles.fullscreenActionLeft}>
                  <span style={styles.fullscreenActionIcon}><Popup size={18} /></span>
                  <div style={styles.fullscreenActionMeta}>
                    <span style={styles.fullscreenActionTitle}>Picture-in-Picture</span>
                    <span style={styles.fullscreenActionDesc}>Assistir em janela flutuante</span>
                  </div>
                </div>
              </button>

              {/* 049/RF-4904: Preencher (sem faixas) ou Ajustar (tela inteira do professor); não fecha o menu */}
              <button
                type="button"
                onClick={toggleVideoFit}
                style={styles.fullscreenActionButton}
                title={videoFit === 'cover' ? 'Mostrar tela inteira' : 'Preencher a tela'}
                aria-label={videoFit === 'cover' ? 'Mostrar tela inteira' : 'Preencher a tela'}
                data-testid="video-fit-toggle"
              >
                <div style={styles.fullscreenActionLeft}>
                  <span style={styles.fullscreenActionIcon}>
                    {videoFit === 'cover' ? <FitScreen size={18} /> : <FillScreen size={18} />}
                  </span>
                  <div style={styles.fullscreenActionMeta}>
                    <span style={styles.fullscreenActionTitle}>
                      {videoFit === 'cover' ? 'Mostrar tela inteira' : 'Preencher a tela'}
                    </span>
                    <span style={styles.fullscreenActionDesc}>
                      {videoFit === 'cover' ? 'Ajustar sem cortar as bordas' : 'Sem bordas; pode cortar as laterais'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Sair da Tela Cheia */}
              <button
                onClick={() => {
                  setIsFullscreenSidebarOpen(false);
                  handleToggleFullscreen();
                }}
                style={styles.fullscreenActionButton}
              >
                <div style={styles.fullscreenActionLeft}>
                  <span style={styles.fullscreenActionIcon}><Maximize size={18} /></span>
                  <div style={styles.fullscreenActionMeta}>
                    <span style={styles.fullscreenActionTitle}>Sair da Tela Cheia</span>
                    <span style={styles.fullscreenActionDesc}>Restaurar visualização normal</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Botão de Sair da Sala */}
            <div style={styles.fullscreenFooterBox}>
              <button
                onClick={() => {
                  setIsFullscreenSidebarOpen(false);
                  onLeave();
                }}
                style={styles.fullscreenLeaveBtn}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Exit size={16} /> Sair da Sala</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Cabeçalho tradicional exibido apenas quando NÃO estiver em tela cheia */}
      {!effectiveFullscreen && (
        <header
          style={{
            ...styles.header,
            ...(isMobile ? styles.headerMobile : {}),
          }}
        >
          <div style={isMobile ? styles.brandBoxMobile : styles.brandBox}>
            <BrandMark size={32} title="MLab" />
            <div style={styles.who}>
              <h2 style={isMobile ? styles.titleMobile : styles.title}>
                {(roomInfo as any).room_title || 'Aula ao vivo'}
              </h2>
              {roomInfo.professor_name && !isMobile && (
                <span style={styles.whoSub}>Prof. {roomInfo.professor_name}</span>
              )}
            </div>
          </div>
          <div style={isMobile ? styles.statusBoxMobile : styles.statusBox}>
            <span style={styles.statusLabel} role="status">
              {isStreamPaused ? (
                <StatusBadge status="paused" label="Pausado" />
              ) : (
                <StatusBadge
                  status={connectionStatus === 'connected' ? 'live' : connectionStatus === 'closed' || connectionStatus === 'duplicate' ? 'neutral' : 'waiting'}
                  label={CONNECTION_LABELS[connectionStatus] || connectionStatus}
                />
              )}
            </span>

            {/* Botão de Arquivos da Aula */}
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileDrawerTab('files');
                  setIsChatOpen(true);
                } else {
                  setIsFilesOpen((prev) => !prev);
                }
              }}
              style={{
                ...styles.headerBtn,
                ...(isMobile ? styles.headerBtnMobile : {}),
                ...(isFilesOpen || (isMobile && isChatOpen && mobileDrawerTab === 'files')
                  ? styles.headerBtnActive
                  : {}),
              }}
              title="Arquivos da Aula"
              aria-label={filesButtonLabel(sharedFiles.length)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Folder size={16} /> {isMobile ? '' : 'Arquivos da aula'}</span>
              {sharedFiles.length > 0 && (
                <span style={styles.filesBadge} aria-hidden="true">{sharedFiles.length}</span>
              )}
            </button>

            {/* Botão de Chat no Header */}
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileDrawerTab('chat');
                  handleToggleChat();
                } else {
                  handleToggleChat();
                }
              }}
              style={{
                ...styles.chatToggleBtn,
                ...(isMobile ? styles.chatToggleBtnMobile : {}),
                ...(isChatOpen && (!isMobile || mobileDrawerTab === 'chat')
                  ? styles.chatToggleBtnActive
                  : {}),
              }}
              title={isChatOpen ? 'Recolher Chat' : 'Abrir Chat'}
              aria-label={withUnread(isMobile ? (isChatOpen ? 'Recolher Chat' : 'Abrir Chat') : 'Chat', unreadCount)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Chat size={16} /> {isMobile ? '' : 'Chat'}</span>
              {unreadCount > 0 && (
                <span style={styles.unreadBadge} aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            <button onClick={() => onLeave()} style={isMobile ? styles.leaveBtnMobile : styles.leaveBtn}>Sair</button>
          </div>
        </header>
      )}

      {/* RF-21: Banner de Autoplay Policy */}
      {autoplayBlocked && (
        <div style={styles.autoplayBanner} role="alert">
          <span>O áudio da aula foi pausado pelo navegador.</span>
          <button onClick={handleUnmuteAudio} style={styles.unmuteBtn}>
            Clique para Ativar Som
          </button>
        </div>
      )}

      <main style={styles.mainLayout}>
        <div
          className="ml-on-stage"
          style={{
            ...styles.videoSection,
            // 049/RF-4907: em tela cheia o vídeo vai até a borda inferior, sem reservar a área segura.
            ...(isMobile && !effectiveFullscreen ? styles.videoSectionMobile : {}),
          }}
          data-testid="video-section"
          onClick={() => {
            if (isChatOpen) {
              setIsChatOpen(false);
            }
            if (isFilesOpen) {
              setIsFilesOpen(false);
            }
            if (isFullscreenSidebarOpen) {
              setIsFullscreenSidebarOpen(false);
            }
          }}
          onMouseEnter={() => setIsVideoHovered(true)}
          onMouseLeave={() => setIsVideoHovered(false)}
        >
          {/* Tela de Espera quando a aula for pausada pelo professor */}
          {isStreamPaused ? (
            <div style={styles.pausedScreen}>
              <div style={styles.pausedIconWrapper}>
                <span className="ml-spin-slow" style={styles.pausedIcon}><Renew size={36} /></span>
              </div>
              <h3 style={styles.pausedTitle}>Aula Pausada pelo Professor</h3>
              <p style={styles.pausedSub}>
                A transmissão foi pausada momentaneamente. A aula retornará em instantes...
              </p>
            </div>
          ) : stream ? (
            <div style={styles.videoWrapper}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={autoplayBlocked}
                data-testid="room-video"
                style={{ ...styles.video, objectFit: effectiveFullscreen ? videoFit : 'contain' }}
              />
              {/* Banner de feedback quando a mão está levantada */}
              {isHandRaised && (
                <div style={styles.handRaisedBanner} role="status" data-testid="hand-raised-banner">
                  <div style={styles.handRaisedBannerContent}>
                    <span style={styles.handRaisedBannerMessage}>
                      <span style={styles.handRaisedBannerIcon} data-testid="hand-raised-banner-icon">
                        <Touch_1Filled size={16} />
                      </span>
                      <span>Sua mão está levantada. O professor foi notificado.</span>
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHand(false);
                      }}
                      style={styles.handRaisedLowerBtn}
                    >
                      Abaixar Mão
                    </Button>
                  </div>
                </div>
              )}
              {/* Controles sobre o vídeo (ocultados em tela cheia): sempre visíveis */}
              {/* 043/RF-4301: pílula e grupo PiP / Tela Cheia na mesma linha, com espaço mínimo entre eles; o
                  espaçador centraliza a pílula quando há espaço e encolhe primeiro em telas estreitas. */}
              {!effectiveFullscreen && (
                <div style={styles.videoBottomBar} data-testid="video-bottom-bar">
                  <div className="ml-video-bar-spacer" style={styles.videoBottomSpacer} aria-hidden="true" />
                  <div style={styles.handSlot}>
                    <button
                      type="button"
                      className="ml-hand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHand();
                      }}
                      style={isHandRaised ? styles.handBtnActive : styles.handBtn}
                      title={isHandRaised ? 'Abaixar mão' : 'Levantar mão'}
                      aria-label={isHandRaised ? 'Abaixar mão' : 'Levantar mão'}
                      aria-pressed={isHandRaised}
                    >
                      {isHandRaised ? <Touch_1Filled size={20} /> : <Touch_1 size={20} />}
                      {isHandRaised ? (
                        <>
                          <span className="ml-hand-label">Mão levantada (abaixar)</span>
                          <span className="ml-hand-label-short">Abaixar mão</span>
                        </>
                      ) : (
                        <span className="ml-hand-label-any">Levantar mão</span>
                      )}
                    </button>
                  </div>
                  <div style={styles.videoOverlayControls} role="toolbar" aria-label="Visualização">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePiP();
                      }}
                      style={styles.overlayBtn}
                      title="Picture-in-Picture"
                      aria-label="Picture-in-Picture"
                    >
                      <Popup size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFullscreen();
                      }}
                      style={styles.overlayBtn}
                      title="Tela Cheia"
                      aria-label="Tela Cheia"
                    >
                      <Maximize size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={styles.waitingStateBox}>
              <h3 style={styles.waitingTitle}>
                {connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                  ? 'Sincronizando com a transmissão...'
                  : 'Aguardando o professor iniciar a transmissão...'}
              </h3>
              <p style={styles.waitingSub}>
                {connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                  ? 'Conectando ao servidor WebRTC. O vídeo aparecerá automaticamente...'
                  : 'Você receberá o vídeo e áudio automaticamente assim que a aula começar.'}
              </p>
              {!isChatOpen && (
                <button
                  onClick={handleToggleChat}
                  style={styles.waitingChatBtn}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Chat size={16} /> Abrir Chat da Aula</span>
                  {unreadCount > 0 && (
                    <span style={styles.unreadBadge}>{unreadCount}</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal/Gaveta de Arquivos da Aula (Desktop) */}
        {!isMobile && isFilesOpen && (
          <div
            style={{
              ...styles.filesDrawer,
              top: effectiveFullscreen ? '16px' : '12px',
              right: isChatOpen ? '360px' : '20px',
            }}
          >
            <div style={styles.drawerHeader}>
              <span style={{ ...styles.drawerTitle, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Folder size={18} /> Arquivos da Aula ({sharedFiles.length})</span>
              <button
                onClick={() => setIsFilesOpen(false)}
                style={styles.closeDrawerBtn}
                title="Fechar Arquivos"
                aria-label="Fechar Arquivos"
                data-testid="close-files-btn"
              >
                <Close size={16} />
              </button>
            </div>
            <div style={styles.filesList} data-testid="files-list">
              {sharedFiles.length === 0 ? (
                <div style={styles.noFilesBox}>
                  <p style={styles.noFilesText}>Nenhum arquivo compartilhado pelo professor até o momento.</p>
                </div>
              ) : (
                sharedFiles.map((file, idx) => (
                  <div key={file.id || idx} style={styles.fileItemCard}>
                    <div style={styles.fileIconBox}><Attachment size={18} /></div>
                    <div style={styles.fileMeta}>
                      <span style={styles.fileName} title={file.name}>{file.name}</span>
                      <span style={styles.fileSize}>{formatFileSize(file.size)}</span>
                    </div>
                    <a
                      href={fileDownloadUrl(fileDownloadPath(roomInfo.room_id, file.id), token)}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.downloadBtn}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Download size={14} /> Baixar
                      </span>
                    </a>
                  </div>
                ))
              )}
              <div ref={filesEndRef} data-testid="files-end" />
            </div>
          </div>
        )}

        {/* Backdrop para mobile quando a gaveta de chat/arquivos estiver aberta */}
        {isMobile && isChatOpen && (
          <div style={styles.mobileBackdrop} onClick={() => setIsChatOpen(false)} />
        )}

        {/* Painel Retrátil (Sidebar no Desktop / Drawer com Abas no Mobile) */}
        <aside
          style={
            isMobile
              ? {
                  ...styles.chatDrawerMobile,
                  transform: isChatOpen ? 'translateX(0)' : 'translateX(100%)',
                  // 049/RF-4908: fechada fora da tela, a sombra vazaria na borda direita.
                  boxShadow: isChatOpen ? styles.chatDrawerMobile.boxShadow : 'none',
                  pointerEvents: isChatOpen ? 'auto' : 'none',
                }
              : {
                  ...styles.chatSectionDesktop,
                  width: isChatOpen ? '340px' : '0px',
                  minWidth: isChatOpen ? '340px' : '0px',
                  opacity: isChatOpen ? 1 : 0,
                  borderLeft: isChatOpen ? '1px solid var(--border-subtle)' : 'none',
                  pointerEvents: isChatOpen ? 'auto' : 'none',
                }
          }
        >
          {isMobile ? (
            <div style={styles.mobileDrawerHeader}>
              <div style={styles.mobileTabsRow}>
                <button
                  type="button"
                  onClick={() => setMobileDrawerTab('chat')}
                  style={mobileDrawerTab === 'chat' ? styles.mobileTabActive : styles.mobileTab}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Chat size={16} /> Chat</span>
                  {unreadCount > 0 && <span style={styles.unreadBadge}>{unreadCount}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileDrawerTab('files')}
                  style={mobileDrawerTab === 'files' ? styles.mobileTabActive : styles.mobileTab}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Folder size={16} /> Arquivos</span>
                  {sharedFiles.length > 0 && <span style={styles.filesBadge}>{sharedFiles.length}</span>}
                </button>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                style={styles.closeChatBtn}
                title="Fechar"
              >
                <Close size={16} />
              </button>
            </div>
          ) : (
            <div style={styles.chatHeader}>
              <span>Chat da Aula</span>
              <button
                onClick={handleToggleChat}
                style={styles.closeChatBtn}
                title="Recolher Chat"
              >
                <Close size={16} />
              </button>
            </div>
          )}

          {isMobile && mobileDrawerTab === 'files' ? (
            <div style={styles.mobileFilesContent} data-testid="mobile-files-content">
              <div style={styles.mobileFilesList} data-testid="mobile-files-list">
                {sharedFiles.length === 0 ? (
                  <div style={styles.noFilesBox}>
                    <p style={styles.noFilesText}>Nenhum arquivo compartilhado pelo professor até o momento.</p>
                  </div>
                ) : (
                  sharedFiles.map((file, idx) => (
                    <div key={file.id || idx} style={styles.fileItemCard}>
                      <div style={styles.fileIconBox}><Attachment size={18} /></div>
                      <div style={styles.fileMeta}>
                        <span style={styles.fileName} title={file.name}>{file.name}</span>
                        <span style={styles.fileSize}>{formatFileSize(file.size)}</span>
                      </div>
                      <a
                        href={fileDownloadUrl(fileDownloadPath(roomInfo.room_id, file.id), token)}
                        download={file.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.downloadBtn}
                      >
                        ⬇ Baixar
                      </a>
                    </div>
                  ))
                )}
                <div ref={filesEndRef} data-testid="files-end" />
              </div>
            </div>
          ) : (
            <>
              {/* Abas no topo do Chat: Público vs Privado */}
              <div style={styles.chatSubTabs}>
                <button
                  type="button"
                  onClick={() => setStudentChatTab('public')}
                  style={studentChatTab === 'public' ? styles.chatSubTabActive : styles.chatSubTab}
                >
                  Turma
                </button>
                <button
                  type="button"
                  onClick={() => setStudentChatTab('private')}
                  style={studentChatTab === 'private' ? styles.chatSubTabActivePrivate : styles.chatSubTab}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} aria-label="Privado com Professor"><Locked size={14} /> Professor</span>
                  {messages.filter((m) => m.is_private).length > 0 && (
                    <span style={styles.tabBadge}>
                      {messages.filter((m) => m.is_private).length}
                    </span>
                  )}
                </button>
              </div>

              {studentChatTab === 'public' ? (
                // ── CHAT PÚBLICO DA TURMA ──
                (() => {
                  const publicMsgs = messages.filter((m) => m.is_private !== true);
                  const pinnedPublic = publicMsgs.filter((m) => m.pinned === true);

                  return (
                    <>
                      {pinnedPublic.length > 0 && (
                        <div style={styles.pinnedBannerBox} data-testid="pinned-public-section">
                          <div style={styles.pinnedBannerHeader}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <PinFilled size={13} /> Mensagens Fixadas ({pinnedPublic.length}/3)
                            </span>
                          </div>
                          {pinnedPublic.map((pm, pIdx) => {
                            const pmId = pm.message_id || pm.id || `pub-pin-${pIdx}`;
                            const pmSender = pm.name || pm.sender_name || 'Participante';
                            return (
                              <div key={`pin-banner-${pmId}`} style={styles.pinnedBannerItem}>
                                <span style={styles.pinnedBannerText}>
                                  <strong>{pmSender}:</strong> {decodeChatEntities(pm.content)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={styles.messagesList}>
                        {publicMsgs.length === 0 ? (
                          <div style={styles.noFilesBox}>
                            <p style={styles.noFilesText}>Nenhuma mensagem pública no momento.</p>
                          </div>
                        ) : (
                          publicMsgs.map((m, idx) => {
                            const isSenderStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                            const displayName = m.name || m.sender_name || 'Participante';
                            const studentMatricula = m.student_id ? `(${m.student_id})` : '';
                            const isPinned = m.pinned === true;

                            return (
                              <div
                                key={m.message_id || idx}
                                style={
                                  isPinned
                                    ? { ...styles.messageCard, ...styles.pinnedMessageCard }
                                    : styles.messageCard
                                }
                              >
                                <div style={styles.senderHeader}>
                                  <span style={styles.senderInfo}>
                                    {displayName}{' '}
                                    {studentMatricula && (
                                      <span style={styles.studentIdBadge}>{studentMatricula}</span>
                                    )}
                                    <small style={styles.roleBadge}>
                                      {' '}[{isSenderStudent ? 'aluno' : 'professor'}]
                                    </small>
                                  </span>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    {isPinned && (
                                      <span style={styles.pinnedTag} title="Mensagem fixada pelo professor">
                                        <PinFilled size={11} /> FIXADA
                                      </span>
                                    )}
                                    <span style={styles.publicBadge}>TURMA</span>
                                  </div>
                                </div>
                                <p style={styles.msgContent}>{decodeChatEntities(m.content)}</p>
                              </div>
                            );
                          })
                        )}
                        <div ref={publicMessagesEndRef} />
                      </div>

                      <form onSubmit={handleSendPublicChat} style={styles.chatForm}>
                        {chatNoticeAlert}
                        <div style={styles.chatTargetBannerPublic}>
                          Enviando mensagem pública para <strong>Toda a Turma</strong>
                        </div>
                        <div style={styles.chatInputRow}>
                          <input
                            type="text"
                            value={publicChatInput}
                            onChange={(e) => setPublicChatInput(e.target.value)}
                            placeholder={isChatReady ? 'Mensagem para toda a turma...' : chatConnectingPlaceholder}
                            disabled={!isChatReady}
                            style={styles.chatInput}
                          />
                          <button type="submit" disabled={!isChatReady || !publicChatInput.trim()} style={styles.sendBtn}>
                            Enviar
                          </button>
                        </div>
                      </form>
                    </>
                  );
                })()
              ) : (
                // ── CHAT PRIVADO COM O PROFESSOR ──
                (() => {
                  const privateMsgs = messages.filter((m) => m.is_private === true);
                  const pinnedPrivate = privateMsgs.filter((m) => m.pinned === true);

                  return (
                    <>
                      {pinnedPrivate.length > 0 && (
                        <div style={styles.pinnedBannerBoxPrivate} data-testid="pinned-private-section">
                          <div style={styles.pinnedBannerHeaderPrivate}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <PinFilled size={13} /> Mensagens Privadas Fixadas ({pinnedPrivate.length}/3)
                            </span>
                          </div>
                          {pinnedPrivate.map((pm, pIdx) => {
                            const pmId = pm.message_id || pm.id || `priv-pin-${pIdx}`;
                            const pmSender = pm.name || pm.sender_name || 'Participante';
                            return (
                              <div key={`pin-priv-banner-${pmId}`} style={styles.pinnedBannerItem}>
                                <span style={styles.pinnedBannerText}>
                                  <strong>{pmSender}:</strong> {decodeChatEntities(pm.content)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={styles.messagesList}>
                        {privateMsgs.length === 0 ? (
                          <div style={styles.noFilesBox}>
                            <p style={styles.noFilesText}>Nenhuma dúvida privada com o professor ainda.</p>
                            <p style={{ ...styles.noFilesText, fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                              Envie sua dúvida abaixo. Apenas o professor poderá ler e responder.
                            </p>
                          </div>
                        ) : (
                          privateMsgs.map((m, idx) => {
                            const isSenderStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                            const displayName = m.name || m.sender_name || 'Participante';
                            const studentMatricula = m.student_id ? `(${m.student_id})` : '';
                            const isPinned = m.pinned === true;

                            return (
                              <div
                                key={m.message_id || idx}
                                style={
                                  isPinned
                                    ? {
                                        ...styles.messageCard,
                                        ...styles.privateMessageCard,
                                        ...styles.pinnedPrivateMessageCard,
                                      }
                                    : {
                                        ...styles.messageCard,
                                        ...styles.privateMessageCard,
                                      }
                                }
                              >
                                <div style={styles.senderHeader}>
                                  <span style={styles.senderInfo}>
                                    {displayName}{' '}
                                    {studentMatricula && (
                                      <span style={styles.studentIdBadge}>{studentMatricula}</span>
                                    )}
                                    <small style={styles.roleBadge}>
                                      {' '}[{isSenderStudent ? 'aluno' : 'professor'}]
                                    </small>
                                  </span>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    {isPinned && (
                                      <span style={styles.pinnedPrivateTag} title="Mensagem fixada pelo professor">
                                        <PinFilled size={11} /> FIXADA
                                      </span>
                                    )}
                                    <span style={styles.privateBadge}>
                                      <Locked size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                      PRIVADO
                                    </span>
                                  </div>
                                </div>
                                <p style={styles.msgContent}>{decodeChatEntities(m.content)}</p>
                              </div>
                            );
                          })
                        )}
                        <div ref={privateMessagesEndRef} />
                      </div>

                      <form onSubmit={handleSendPrivateChat} style={styles.chatForm}>
                        {chatNoticeAlert}
                        <div style={styles.chatTargetBanner}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Locked size={14} /> Enviando dúvida privada diretamente ao <strong>Professor</strong>
                          </span>
                        </div>
                        <div style={styles.chatInputRow}>
                          <input
                            type="text"
                            value={privateChatInput}
                            onChange={(e) => setPrivateChatInput(e.target.value)}
                            placeholder={isChatReady ? 'Dúvida privada ao professor...' : chatConnectingPlaceholder}
                            disabled={!isChatReady}
                            style={styles.chatInput}
                          />
                          <button
                            type="submit"
                            disabled={!isChatReady || !privateChatInput.trim()}
                            style={{ ...styles.sendBtn, backgroundColor: 'var(--accent-fill)' }}
                          >
                            Enviar Privado
                          </button>
                        </div>
                      </form>
                    </>
                  );
                })()
              )}
            </>
          )}
        </aside>
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100vh',
    maxHeight: '100dvh',
    width: '100vw',
    maxWidth: '100vw',
    overflow: 'hidden',
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg)',
    color: 'var(--text-1)',
    fontFamily: 'var(--font-ui)',
    touchAction: 'manipulation',
  },
  pseudoFullscreen: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    maxHeight: '100dvh',
    zIndex: 9999,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    minHeight: '56px',
    padding: '0 16px',
    backgroundColor: 'var(--surface-1)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  brandBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  logoImg: {
    width: '40px',
    height: '40px',
    objectFit: 'contain',
  },
  chatSubTabs: {
    display: 'flex',
    gap: '4px',
    padding: '0 12px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  chatSubTab: {
    flex: 1,
    minHeight: '44px',
    padding: '0 8px',
    border: 'none',
    borderBottom: '2px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  },
  chatSubTabActive: {
    flex: 1,
    minHeight: '44px',
    padding: '0 8px',
    border: 'none',
    borderBottom: '2px solid var(--accent)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  },
  chatSubTabActivePrivate: {
    flex: 1,
    minHeight: '44px',
    padding: '0 8px',
    border: 'none',
    borderBottom: '2px solid var(--accent)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  },
  chatTargetBanner: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
  },
  chatTargetBannerPublic: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
  },
  title: {
    fontSize: 'var(--fs-body)',
    lineHeight: 1.25,
    fontWeight: '700',
    color: 'var(--text-1)',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  who: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  whoSub: {
    fontSize: 'var(--fs-caption)',
    lineHeight: 1.25,
    color: 'var(--text-3)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // 043/RF-4301 a RF-4304: linha única para a pílula e o grupo PiP / Tela Cheia. A área vazia deixa o clique
  // passar para o vídeo; os controles reativam o pointer-events.
  videoBottomBar: {
    position: 'absolute',
    left: '16px',
    right: '16px',
    bottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 10,
    pointerEvents: 'none',
  },
  // Mesma largura do grupo (2 × 40 px + 2 px de gap + 2 × 4 px de padding): centraliza a pílula no vídeo. Some até
  // 600 px pela classe .ml-video-bar-spacer (index.css), para a pílula usar todo o espaço à esquerda do grupo.
  videoBottomSpacer: {
    flex: '0 0 90px',
  },
  handSlot: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    justifyContent: 'center',
  },
  // O padding lateral fica na classe .ml-hand-btn (index.css), que o reduz em telas estreitas (043/RF-4303).
  handBtn: {
    minHeight: '52px',
    minWidth: 0,
    maxWidth: '100%',
    borderRadius: 'var(--r-pill)',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    backgroundColor: 'rgba(35, 40, 48, 0.92)',
    color: '#ffffff',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
    whiteSpace: 'nowrap',
    pointerEvents: 'auto',
  },
  handBtnActive: {
    minHeight: '52px',
    minWidth: 0,
    maxWidth: '100%',
    pointerEvents: 'auto',
    borderRadius: 'var(--r-pill)',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  statusLabel: {
    display: 'inline-flex',
    marginRight: '8px',
  },
  headerBtn: {
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerBtnActive: {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  filesBadge: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: '1',
    textAlign: 'center',
  },
  leaveBtn: {
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--danger)',
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
  },
  autoplayBanner: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text-1)',
    borderBottom: '1px solid var(--border-subtle)',
    borderLeft: '3px solid var(--attention)',
    padding: '8px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
  },
  unmuteBtn: {
    minHeight: '36px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  },
  videoSection: {
    flex: 1,
    backgroundColor: 'var(--stage)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: 'var(--stage)',
    imageRendering: '-webkit-optimize-contrast' as any,
  },
  videoOverlayControls: {
    flexShrink: 0,
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '4px',
    borderRadius: 'var(--r-panel)',
    backgroundColor: 'rgba(35, 40, 48, 0.92)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
    zIndex: 10,
  },
  overlayBtn: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#C3C9D2',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtnActive: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: 'var(--r-control)',
    border: '1px solid transparent',
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
  },
  // Aviso de mão levantada (006): largura do conteúdo, limitada à área do vídeo com 16 px de cada lado (C-601).
  handRaisedBanner: {
    position: 'absolute' as const,
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'max-content',
    maxWidth: 'calc(100% - 32px)',
    boxSizing: 'border-box' as const,
    zIndex: 20,
    backgroundColor: 'var(--surface-float)',
    borderRadius: radii.lg,
    padding: '8px 8px 8px 14px',
    boxShadow: 'var(--shadow-float)',
    borderLeft: '3px solid var(--accent)',
  },
  handRaisedBannerContent: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px 14px',
    fontSize: 'var(--fs-small)',
    lineHeight: 1.4,
    color: colors.textPrimary,
    fontWeight: 600,
  },
  handRaisedBannerMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '1 1 200px',
    minWidth: 0,
  },
  handRaisedBannerIcon: {
    display: 'inline-flex',
    flexShrink: 0,
    width: '16px',
    height: '16px',
    color: 'var(--accent)',
  },
  handRaisedLowerBtn: {
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  pausedScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 24px',
    maxWidth: '460px',
    margin: 'auto',
  },
  pausedIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  pausedIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedTitle: {
    fontSize: 'var(--fs-title)',
    lineHeight: 1.2,
    fontWeight: '700',
    color: 'var(--text-1)',
    marginBottom: '8px',
  },
  pausedSub: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-2)',
    lineHeight: '1.5',
    margin: 0,
  },
  waitingStateBox: {
    textAlign: 'center',
    padding: '32px 24px',
    maxWidth: '460px',
  },
  waitingTitle: {
    fontSize: 'var(--fs-title)',
    lineHeight: 1.2,
    fontWeight: '700',
    color: 'var(--text-1)',
    marginBottom: '8px',
  },
  waitingSub: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-2)',
    lineHeight: '1.5',
  },
  chatToggleBtn: {
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  chatToggleBtnActive: {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  unreadBadge: {
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    minWidth: '20px',
    padding: '3px 6px',
    borderRadius: 'var(--r-pill)',
    lineHeight: '1',
    textAlign: 'center',
  },
  waitingChatBtn: {
    marginTop: '20px',
    minHeight: '40px',
    padding: '0 16px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'transparent',
    color: 'var(--text-1)',
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  closeChatBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-2)',
    cursor: 'pointer',
    width: '40px',
    height: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-control)',
    flexShrink: 0,
  },
  mobileBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--scrim)',
    zIndex: 90,
  },
  chatDrawerMobile: {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: '88%',
    maxWidth: '380px',
    backgroundColor: 'var(--surface-1)',
    boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.35)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.25s ease',
  },
  chatSectionDesktop: {
    backgroundColor: 'var(--surface-1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.25s ease, opacity 0.2s ease',
  },
  chatHeader: {
    padding: '8px 8px 8px 16px',
    fontSize: 'var(--fs-lead)',
    fontWeight: '700',
    borderBottom: '1px solid var(--border-subtle)',
    color: 'var(--text-1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagesList: {
    flex: 1,
    padding: '12px 16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
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
    padding: '10px 16px',
    backgroundColor: 'var(--accent-soft)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pinnedBannerBoxPrivate: {
    padding: '10px 16px',
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
  pinnedTag: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--accent)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
  },
  pinnedPrivateTag: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--accent)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
  },
  senderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '2px',
  },
  senderInfo: {
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    color: 'var(--text-1)',
  },
  studentIdBadge: {
    color: 'var(--text-3)',
    fontWeight: 400,
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-caption)',
    marginLeft: '4px',
  },
  roleBadge: {
    color: 'var(--text-3)',
    fontWeight: '400',
    fontSize: 'var(--fs-caption)',
  },
  publicBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '600',
    color: 'var(--text-3)',
  },
  privateBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '600',
    color: 'var(--accent)',
  },
  msgContent: {
    fontSize: 'var(--fs-body)',
    lineHeight: 1.5,
    color: 'var(--text-1)',
    margin: 0,
    wordBreak: 'break-word',
  },
  chatForm: {
    padding: '12px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  chatInputRow: {
    display: 'flex',
    gap: '8px',
  },
  chatInput: {
    flex: 1,
    minWidth: 0,
    minHeight: '44px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-body)',
  },
  sendBtn: {
    minHeight: '44px',
    padding: '0 16px',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'var(--accent-fill)',
    color: '#fff',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    cursor: 'pointer',
  },
  filesDrawer: {
    position: 'absolute',
    top: '12px',
    right: '360px',
    width: '340px',
    maxHeight: '450px',
    backgroundColor: 'var(--surface-float)',
    borderRadius: 'var(--r-panel)',
    boxShadow: 'var(--shadow-float)',
    zIndex: 80,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  drawerHeader: {
    padding: '8px 8px 8px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-subtle)',
  },
  drawerTitle: {
    fontSize: 'var(--fs-body)',
    fontWeight: '700',
    color: 'var(--text-1)',
  },
  closeDrawerBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-2)',
    cursor: 'pointer',
    width: '40px',
    height: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-control)',
    flexShrink: 0,
  },
  filesList: {
    padding: '8px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    maxHeight: '380px',
  },
  noFilesBox: {
    padding: '32px 16px',
    textAlign: 'center',
  },
  noFilesText: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-2)',
    margin: 0,
  },
  fileItemCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '52px',
    padding: '6px 8px',
    borderRadius: 'var(--r-control)',
  },
  fileIconBox: {
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
  fileMeta: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  fileName: {
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    color: 'var(--text-1)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileSize: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-3)',
  },
  downloadBtn: {
    minHeight: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-1)',
    textDecoration: 'none',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    flexShrink: 0,
  },
  headerMobile: {
    padding: '8px 12px',
    paddingTop: 'calc(8px + var(--sat, 0px))',
  },
  brandBoxMobile: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  logoImgMobile: {
    width: '36px',
    height: '36px',
    objectFit: 'contain',
  },
  titleMobile: {
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    color: 'var(--text-1)',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  statusBoxMobile: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
  },
  statusPausedBadge: {
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    padding: '3px 8px',
    borderRadius: 'var(--r-panel)',
  },
  headerBtnMobile: {
    padding: '0 10px',
    minHeight: '40px',
  },
  chatToggleBtnMobile: {
    padding: '0 10px',
    minHeight: '40px',
  },
  leaveBtnMobile: {
    minHeight: '40px',
    padding: '0 10px',
    borderRadius: 'var(--r-control)',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--danger)',
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
  },
  videoSectionMobile: {
    paddingBottom: 'var(--sab, 0px)',
  },
  mobileDrawerHeader: {
    padding: '8px 8px 8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-subtle)',
    paddingTop: 'calc(8px + var(--sat, 0px))',
  },
  mobileTabsRow: {
    display: 'flex',
    gap: '4px',
  },
  mobileTab: {
    minHeight: '40px',
    padding: '0 12px',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  mobileTabActive: {
    minHeight: '40px',
    padding: '0 12px',
    fontSize: 'var(--fs-small)',
    fontWeight: '700',
    borderRadius: 'var(--r-control)',
    border: 'none',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  // Moldura da aba Arquivos do celular: só a lista rola (024, C-2401).
  mobileFilesContent: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '14px',
  },
  // Lista do celular sem o teto de 380px da gaveta do desktop (024, RF-2401).
  mobileFilesList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  fullscreenMenuBtn: {
    position: 'fixed' as const,
    top: '16px',
    right: '16px',
    zIndex: 100,
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: 'rgba(35, 40, 48, 0.92)',
    border: '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#ECEFF3',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
  },
  fullscreenMenuBtnActive: {
    backgroundColor: 'rgba(35, 40, 48, 0.92)',
    color: 'var(--p-blue-300)',
  },
  fullscreenMenuBadge: {
    position: 'absolute' as const,
    top: '-4px',
    right: '-4px',
    backgroundColor: 'var(--accent-fill)',
    color: '#ffffff',
    fontSize: 'var(--fs-caption)',
    fontWeight: '700',
    minWidth: '20px',
    height: '20px',
    borderRadius: 'var(--r-pill)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
  },
  fullscreenSidebarBackdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--scrim)',
    zIndex: 90,
  },
  fullscreenRightSidebar: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: '320px',
    maxWidth: '85vw',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-1)',
    boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.35)',
    zIndex: 95,
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
  },
  fullscreenSidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    // 043/RF-4307: 64 px à direita reservam o canto do gatilho flutuante (16 px + 44 px + folga).
    padding: '12px 64px 12px 16px',
    minHeight: '76px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  fullscreenBrandBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fullscreenSidebarTitle: {
    margin: 0,
    fontSize: 'var(--fs-body)',
    fontWeight: '700',
    color: 'var(--text-1)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
  },
  fullscreenSidebarSubtitle: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-2)',
  },
  fullscreenSidebarContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '14px',
    gap: '12px',
    overflowY: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as const,
  },
  fullscreenStatusCard: {
    padding: '4px 2px 8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  fullscreenActionsGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  fullscreenActionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '56px',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--r-control)',
    color: 'var(--text-1)',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  fullscreenActionButtonActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '56px',
    padding: '8px 12px',
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid transparent',
    borderRadius: 'var(--r-control)',
    color: 'var(--text-1)',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  fullscreenActionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fullscreenActionIcon: {
    display: 'inline-flex',
    color: 'var(--text-2)',
  },
  fullscreenActionMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  fullscreenActionTitle: {
    fontSize: 'var(--fs-small)',
    fontWeight: '600',
    color: 'var(--text-1)',
  },
  fullscreenActionDesc: {
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-2)',
  },
  fullscreenFooterBox: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-subtle)',
  },
  fullscreenLeaveBtn: {
    width: '100%',
    minHeight: '44px',
    padding: '0 12px',
    borderRadius: 'var(--r-control)',
    border: '1px solid transparent',
    backgroundColor: 'var(--danger-soft)',
    color: 'var(--danger)',
    fontWeight: '600',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};
