import {
  Chat,
  Folder,
  Popup,
  Maximize,
  Exit,
  Close,
  Locked,
  Attachment,
  Download,
  Renew,
} from '@mlab/ui';
import React, { useRef, useEffect, useState } from 'react';
import { useWebRTCSubscriber } from '../hooks/useWebRTCSubscriber';

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
  } = useWebRTCSubscriber(token, roomInfo);

  // Quando o professor encerra a transmissão (connectionStatus === 'closed'), redireciona de volta para a tela de credenciais
  useEffect(() => {
    if (connectionStatus === 'closed') {
      onLeave('A transmissão foi encerrada pelo professor. Por favor, insira suas credenciais novamente.');
    }
  }, [connectionStatus, onLeave]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [publicChatInput, setPublicChatInput] = useState('');
  const [privateChatInput, setPrivateChatInput] = useState('');
  const [studentChatTab, setStudentChatTab] = useState<'public' | 'private'>('public');
  const [isVideoHovered, setIsVideoHovered] = useState<boolean>(false);
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

  const effectiveFullscreen = isFullscreen || isPseudoFullscreen;

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

      const currentTime = videoEl.currentTime;
      if (currentTime === lastTime && currentTime > 0) {
        freezeCount++;
        // Se a reprodução estagnar por 2 intervalos (1.6s) mesmo sem pausar, solicita Keyframe imediato ao SFU
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
    }, 800);

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
          title={isFullscreenSidebarOpen ? 'Fechar menu' : 'Menu da transmissão'}
          aria-label="Menu da transmissão"
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
          data-testid="fullscreen-right-sidebar"
          style={{
            ...styles.fullscreenRightSidebar,
            transform: isFullscreenSidebarOpen ? 'translateX(0)' : 'translateX(100%)',
            pointerEvents: isFullscreenSidebarOpen ? 'auto' : 'none',
          }}
        >
          <div style={styles.fullscreenSidebarHeader}>
            <div style={styles.fullscreenBrandBox}>
              <img src="/MLAB-logo.png" alt="MLab Logo" style={styles.logoImgMobile} />
              <div>
                <h3 style={styles.fullscreenSidebarTitle}>
                  {roomInfo.professor_name ? `Prof. ${roomInfo.professor_name}` : 'MLab'}
                </h3>
                <span style={styles.fullscreenSidebarSubtitle}>Controles da Transmissão</span>
              </div>
            </div>
            <button
              onClick={() => setIsFullscreenSidebarOpen(false)}
              style={styles.closeDrawerBtn}
              title="Fechar Menu"
              aria-label="Fechar Menu"
            >
              <Close size={16} />
            </button>
          </div>

          <div style={styles.fullscreenSidebarContent}>
            {/* Status da Transmissão idêntico ao do Header */}
            <div style={styles.fullscreenStatusCard}>
              <span style={styles.statusLabel}>
                Status: {isStreamPaused ? 'pausado' : connectionStatus}
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
            <img src="/MLAB-logo.png" alt="MLab Logo" style={isMobile ? styles.logoImgMobile : styles.logoImg} />
            <h2 style={isMobile ? styles.titleMobile : styles.title}>
              {roomInfo.professor_name
                ? (isMobile ? `MLab — Prof. ${roomInfo.professor_name}` : `MLab — Aula ao Vivo (Prof. ${roomInfo.professor_name})`)
                : (isMobile ? 'MLab' : 'MLab — Aula ao Vivo')}
            </h2>
          </div>
          <div style={isMobile ? styles.statusBoxMobile : styles.statusBox}>
            <span style={styles.statusLabel}>
              Status:{' '}
              {isStreamPaused ? (
                <span style={styles.statusPausedBadge}>pausado</span>
              ) : (
                connectionStatus
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
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Folder size={16} /> {isMobile ? '' : 'Arquivos da aula'}</span>
              {sharedFiles.length > 0 && (
                <span style={styles.filesBadge}>{sharedFiles.length}</span>
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
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Chat size={16} /> {isMobile ? '' : 'Chat'}</span>
              {unreadCount > 0 && (
                <span style={styles.unreadBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            <button onClick={() => onLeave()} style={isMobile ? styles.leaveBtnMobile : styles.leaveBtn}>Sair</button>
          </div>
        </header>
      )}

      {/* RF-21: Banner de Autoplay Policy */}
      {autoplayBlocked && (
        <div style={styles.autoplayBanner}>
          <span>O áudio da aula foi pausado pelo navegador.</span>
          <button onClick={handleUnmuteAudio} style={styles.unmuteBtn}>
            Clique para Ativar Som
          </button>
        </div>
      )}

      <main style={styles.mainLayout}>
        <div
          style={{
            ...styles.videoSection,
            ...(isMobile ? styles.videoSectionMobile : {}),
          }}
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
                <span style={styles.pausedIcon}><Renew size={36} /></span>
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
                style={styles.video}
              />
              {/* Controles sobre o vídeo (ocultados em tela cheia) */}
              {!effectiveFullscreen && (
                <div
                  style={{
                    ...styles.videoOverlayControls,
                    opacity: isMobile ? 1 : (isVideoHovered ? 1 : 0),
                    pointerEvents: isMobile ? 'auto' : (isVideoHovered ? 'auto' : 'none'),
                    transition: 'opacity 0.25s ease',
                  }}
                >
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Maximize size={16} /> Tela Cheia
                    </span>
                  </button>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Popup size={16} /> Picture-in-Picture
                    </span>
                  </button>
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
            <div style={styles.filesList}>
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
                      href={file.url}
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
                  pointerEvents: isChatOpen ? 'auto' : 'none',
                }
              : {
                  ...styles.chatSectionDesktop,
                  width: isChatOpen ? '340px' : '0px',
                  minWidth: isChatOpen ? '340px' : '0px',
                  opacity: isChatOpen ? 1 : 0,
                  borderLeft: isChatOpen ? '1px solid #334155' : 'none',
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
            <div style={styles.mobileFilesContent}>
              <div style={styles.filesList}>
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
                        href={file.url}
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
                  Turma (Público)
                </button>
                <button
                  type="button"
                  onClick={() => setStudentChatTab('private')}
                  style={studentChatTab === 'private' ? styles.chatSubTabActivePrivate : styles.chatSubTab}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Locked size={14} /> Privado com Professor</span>
                  {messages.filter((m) => m.is_private).length > 0 && (
                    <span style={styles.tabBadge}>
                      {messages.filter((m) => m.is_private).length}
                    </span>
                  )}
                </button>
              </div>

              {studentChatTab === 'public' ? (
                // ── CHAT PÚBLICO DA TURMA ──
                <>
                  <div style={styles.messagesList}>
                    {messages.filter((m) => m.is_private !== true).length === 0 ? (
                      <div style={styles.noFilesBox}>
                        <p style={styles.noFilesText}>Nenhuma mensagem pública no momento.</p>
                      </div>
                    ) : (
                      messages.filter((m) => m.is_private !== true).map((m, idx) => {
                        const isSenderStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                        const displayName = m.name || m.sender_name || 'Participante';
                        const studentMatricula = m.student_id ? `(${m.student_id})` : '';

                        return (
                          <div key={m.message_id || idx} style={styles.messageCard}>
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
                              <span style={styles.publicBadge}>TURMA</span>
                            </div>
                            <p style={styles.msgContent}>{m.content}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendPublicChat} style={styles.chatForm}>
                    <div style={styles.chatTargetBannerPublic}>
                      Enviando mensagem pública para <strong>Toda a Turma</strong>
                    </div>
                    <div style={styles.chatInputRow}>
                      <input
                        type="text"
                        value={publicChatInput}
                        onChange={(e) => setPublicChatInput(e.target.value)}
                        placeholder="Mensagem para toda a turma..."
                        style={styles.chatInput}
                      />
                      <button type="submit" disabled={!publicChatInput.trim()} style={styles.sendBtn}>
                        Enviar
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                // ── CHAT PRIVADO COM O PROFESSOR ──
                <>
                  <div style={styles.messagesList}>
                    {messages.filter((m) => m.is_private === true).length === 0 ? (
                      <div style={styles.noFilesBox}>
                        <p style={styles.noFilesText}>Nenhuma dúvida privada com o professor ainda.</p>
                        <p style={{ ...styles.noFilesText, fontSize: '11px', color: '#64748b' }}>
                          Envie sua dúvida abaixo. Apenas o professor poderá ler e responder.
                        </p>
                      </div>
                    ) : (
                      messages.filter((m) => m.is_private === true).map((m, idx) => {
                        const isSenderStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                        const displayName = m.name || m.sender_name || 'Participante';
                        const studentMatricula = m.student_id ? `(${m.student_id})` : '';

                        return (
                          <div
                            key={m.message_id || idx}
                            style={{
                              ...styles.messageCard,
                              ...styles.privateMessageCard,
                            }}
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
                              <span style={styles.privateBadge}><Locked size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />PRIVADO</span>
                            </div>
                            <p style={styles.msgContent}>{m.content}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendPrivateChat} style={styles.chatForm}>
                    <div style={styles.chatTargetBanner}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Locked size={14} /> Enviando dúvida privada diretamente ao <strong>Professor</strong></span>
                    </div>
                    <div style={styles.chatInputRow}>
                      <input
                        type="text"
                        value={privateChatInput}
                        onChange={(e) => setPrivateChatInput(e.target.value)}
                        placeholder="Dúvida privada ao professor..."
                        style={styles.chatInput}
                      />
                      <button
                        type="submit"
                        disabled={!privateChatInput.trim()}
                        style={{ ...styles.sendBtn, backgroundColor: '#6366f1' }}
                      >
                        Enviar Privado
                      </button>
                    </div>
                  </form>
                </>
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
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
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
    padding: '12px 24px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  fullscreenTriggerZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '18px',
    zIndex: 60,
  },
  headerFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 55,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  brandBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImg: {
    width: '40px',
    height: '40px',
    objectFit: 'contain',
  },
  chatSubTabs: {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #334155',
  },
  chatSubTab: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  chatSubTabActive: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  chatSubTabActivePrivate: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '6px',
    border: '1px solid #a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    color: '#c084fc',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  chatTargetBanner: {
    padding: '6px 12px',
    fontSize: '11px',
    color: '#c084fc',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    marginBottom: '8px',
    textAlign: 'center',
  },
  chatTargetBannerPublic: {
    padding: '6px 12px',
    fontSize: '11px',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: '6px',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    marginBottom: '8px',
    textAlign: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#38bdf8',
    margin: 0,
  },
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statusLabel: {
    fontSize: '13px',
    color: '#94a3b8',
    marginRight: '4px',
  },
  headerBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #475569',
    backgroundColor: '#334155',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background-color 0.2s',
  },
  headerBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
    color: '#ffffff',
  },
  filesBadge: {
    backgroundColor: '#38bdf8',
    color: '#0f172a',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '10px',
    lineHeight: '1',
  },
  leaveBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid #475569',
    backgroundColor: 'transparent',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '13px',
  },
  autoplayBanner: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    padding: '10px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: '500',
  },
  unmuteBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#0284c7',
    fontWeight: '700',
    cursor: 'pointer',
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  },
  videoSection: {
    flex: 1,
    backgroundColor: '#020617',
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
    backgroundColor: '#000000',
    imageRendering: '-webkit-optimize-contrast' as any,
  },
  videoOverlayControls: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    display: 'flex',
    gap: '10px',
    zIndex: 10,
  },
  overlayBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    transition: 'opacity 0.25s ease, background-color 0.2s',
  },
  pausedScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#0b1120',
    borderRadius: '16px',
    border: '1px solid #1e293b',
    maxWidth: '500px',
    margin: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
  },
  pausedIconWrapper: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px',
    color: '#38bdf8',
  },
  pausedIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'spin 4s linear infinite',
  },
  pausedTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '10px',
  },
  pausedSub: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: '1.5',
    margin: 0,
  },
  waitingStateBox: {
    textAlign: 'center',
    padding: '40px',
  },
  waitingTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: '8px',
  },
  waitingSub: {
    fontSize: '14px',
    color: '#64748b',
  },
  chatToggleBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #475569',
    backgroundColor: '#334155',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background-color 0.2s, border-color 0.2s',
  },
  chatToggleBtnActive: {
    backgroundColor: '#0284c7',
    border: '1px solid #38bdf8',
    color: '#ffffff',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '10px',
    lineHeight: '1',
  },
  waitingChatBtn: {
    marginTop: '16px',
    padding: '10px 18px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  closeChatBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    lineHeight: '1',
  },
  mobileBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 90,
  },
  chatDrawerMobile: {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: '85%',
    maxWidth: '380px',
    backgroundColor: '#1e293b',
    borderLeft: '1px solid #334155',
    boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.6)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.25s ease',
  },
  chatSectionDesktop: {
    backgroundColor: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.25s ease, opacity 0.2s ease',
  },
  chatHeader: {
    padding: '16px',
    fontSize: '15px',
    fontWeight: '700',
    borderBottom: '1px solid #334155',
    color: '#f8fafc',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagesList: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageCard: {
    backgroundColor: '#0f172a',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #334155',
  },
  privateMessageCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.7)',
    border: '1px solid #818cf8',
  },
  senderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  senderInfo: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#38bdf8',
  },
  studentIdBadge: {
    color: '#e2e8f0',
    fontWeight: '500',
    fontSize: '11px',
    marginLeft: '3px',
  },
  roleBadge: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  publicBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid #38bdf8',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  privateBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#a5b4fc',
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    border: '1px solid #6366f1',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  msgContent: {
    fontSize: '13px',
    color: '#f8fafc',
    margin: 0,
    wordBreak: 'break-word',
  },
  chatForm: {
    padding: '12px 16px',
    borderTop: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  chatModeSelector: {
    display: 'flex',
    gap: '6px',
  },
  modeBtn: {
    flex: 1,
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: '500',
    borderRadius: '4px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    cursor: 'pointer',
    textAlign: 'center',
  },
  modeBtnActive: {
    flex: 1,
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '4px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    cursor: 'pointer',
    textAlign: 'center',
  },
  modeBtnPrivateActive: {
    flex: 1,
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '4px',
    border: '1px solid #818cf8',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    color: '#c7d2fe',
    cursor: 'pointer',
    textAlign: 'center',
  },
  chatInputRow: {
    display: 'flex',
    gap: '8px',
  },
  chatInput: {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  sendBtn: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  filesDrawer: {
    position: 'absolute',
    top: '12px',
    right: '360px',
    width: '320px',
    maxHeight: '450px',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
    zIndex: 80,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  drawerHeader: {
    padding: '14px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
    backgroundColor: '#0f172a',
  },
  drawerTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeDrawerBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    lineHeight: '1',
  },
  filesList: {
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '380px',
  },
  noFilesBox: {
    padding: '24px 16px',
    textAlign: 'center',
  },
  noFilesText: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
  },
  fileItemCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
  },
  fileIconBox: {
    fontSize: '20px',
  },
  fileMeta: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  fileName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileSize: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  downloadBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '12px',
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
  },
  logoImgMobile: {
    width: '36px',
    height: '36px',
    objectFit: 'contain',
  },
  titleMobile: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  statusBoxMobile: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusLiveBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  statusPausedBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  headerBtnMobile: {
    padding: '6px 10px',
    fontSize: '12px',
    minHeight: '36px',
  },
  chatToggleBtnMobile: {
    padding: '6px 10px',
    fontSize: '12px',
    minHeight: '36px',
  },
  leaveBtnMobile: {
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  videoSectionMobile: {
    paddingBottom: 'var(--sab, 0px)',
  },
  mobileDrawerHeader: {
    padding: '12px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
    backgroundColor: '#0f172a',
    paddingTop: 'calc(12px + var(--sat, 0px))',
  },
  mobileTabsRow: {
    display: 'flex',
    gap: '8px',
  },
  mobileTab: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  mobileTabActive: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '700',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  mobileFilesContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: '14px',
  },
  fullscreenMenuBtn: {
    position: 'fixed' as const,
    top: '16px',
    right: '16px',
    zIndex: 100,
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.22)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  fullscreenMenuBtnActive: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    border: '1px solid #38bdf8',
    color: '#38bdf8',
  },
  fullscreenMenuBadge: {
    position: 'absolute' as const,
    top: '-4px',
    right: '-4px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    minWidth: '18px',
    height: '18px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    border: '2px solid #0f172a',
  },
  fullscreenSidebarBackdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    zIndex: 90,
  },
  fullscreenRightSidebar: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: '320px',
    maxWidth: '85vw',
    backgroundColor: '#0f172a',
    borderLeft: '1px solid #334155',
    boxShadow: '-8px 0 25px rgba(0, 0, 0, 0.6)',
    zIndex: 95,
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  fullscreenSidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #334155',
    backgroundColor: '#1e293b',
  },
  fullscreenBrandBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fullscreenSidebarTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '700',
    color: '#f8fafc',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
  },
  fullscreenSidebarSubtitle: {
    fontSize: '11px',
    color: '#94a3b8',
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
    padding: '12px 14px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  fullscreenStatusLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  fullscreenStatusValueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  fullscreenRoomTitle: {
    fontSize: '12px',
    color: '#cbd5e1',
    fontWeight: '500',
  },
  statusConnectingBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  fullscreenActionsGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  fullscreenActionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f8fafc',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left' as const,
  },
  fullscreenActionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fullscreenActionIcon: {
    fontSize: '20px',
  },
  fullscreenActionMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  fullscreenActionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  fullscreenActionDesc: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  fullscreenFooterBox: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid #334155',
  },
  fullscreenLeaveBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};
