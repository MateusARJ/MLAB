import React, { useRef, useEffect, useState } from 'react';
import { useWebRTCSubscriber } from '../hooks/useWebRTCSubscriber';

interface RoomProps {
  token: string;
  roomInfo: { room_id: string; ws_url: string; ice_servers: any[] };
  onLeave: (reason?: string) => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
  } = useWebRTCSubscriber(token, roomInfo);

  // Quando o professor encerra a transmissão (connectionStatus === 'closed'), redireciona de volta para a tela de credenciais
  useEffect(() => {
    if (connectionStatus === 'closed') {
      onLeave('A transmissão foi encerrada pelo professor. Por favor, insira suas credenciais novamente.');
    }
  }, [connectionStatus, onLeave]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState('');
  const [isPrivateChat, setIsPrivateChat] = useState<boolean>(false);
  const [isVideoHovered, setIsVideoHovered] = useState<boolean>(false);
  const [isFilesOpen, setIsFilesOpen] = useState<boolean>(false);

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  const [isChatOpen, setIsChatOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 768;
    }
    return true;
  });

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState<boolean>(false);
  const prevMessagesLength = useRef(messages.length);

  useEffect(() => {
    const handleFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) {
        setIsHeaderHovered(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      videoEl
        .play()
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
    };

    if (videoEl.readyState >= 1) {
      attemptPlay();
    } else {
      videoEl.onloadedmetadata = () => {
        attemptPlay();
      };
    }

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

    videoEl.addEventListener('resize', handleResize);

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
      }
    };
  }, [stream]);

  const handleUnmuteAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
      setAutoplayBlocked(false);
    }
  };

  // RF-22: Suporte a Fullscreen
  const handleToggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim(), isPrivateChat);
    setChatInput('');
  };

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Zona de ativação do cabeçalho retrátil em tela cheia */}
      {isFullscreen && (
        <div
          onMouseEnter={() => setIsHeaderHovered(true)}
          style={styles.fullscreenTriggerZone}
        />
      )}

      <header
        onMouseEnter={() => isFullscreen && setIsHeaderHovered(true)}
        onMouseLeave={() => isFullscreen && setIsHeaderHovered(false)}
        style={{
          ...styles.header,
          ...(isFullscreen
            ? {
                ...styles.headerFullscreen,
                transform: isHeaderHovered ? 'translateY(0)' : 'translateY(-100%)',
              }
            : {}),
        }}
      >
        <div style={styles.brandBox}>
          <img src="/MLAB-logo.png" alt="MLab Logo" style={styles.logoImg} />
          <h2 style={styles.title}>MLab — Aula ao Vivo</h2>
        </div>
        <div style={styles.statusBox}>
          <span style={styles.statusLabel}>Status: {connectionStatus}</span>

          {/* Botão de Arquivos da Aula */}
          <button
            onClick={() => setIsFilesOpen((prev) => !prev)}
            style={{
              ...styles.headerBtn,
              ...(isFilesOpen ? styles.headerBtnActive : {}),
            }}
            title="Arquivos da Aula"
          >
            📁 Arquivos da aula
            {sharedFiles.length > 0 && (
              <span style={styles.filesBadge}>{sharedFiles.length}</span>
            )}
          </button>

          {/* Botão de Chat no Header */}
          <button
            onClick={handleToggleChat}
            style={{
              ...styles.chatToggleBtn,
              ...(isChatOpen ? styles.chatToggleBtnActive : {}),
            }}
            title={isChatOpen ? 'Recolher Chat' : 'Abrir Chat'}
          >
            💬 Chat
            {unreadCount > 0 && (
              <span style={styles.unreadBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          <button onClick={() => onLeave()} style={styles.leaveBtn}>Sair</button>
        </div>
      </header>

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
          style={styles.videoSection}
          onMouseEnter={() => setIsVideoHovered(true)}
          onMouseLeave={() => setIsVideoHovered(false)}
        >
          {/* Tela de Espera quando a aula for pausada pelo professor */}
          {isStreamPaused ? (
            <div style={styles.pausedScreen}>
              <div style={styles.pausedIconWrapper}>
                <span style={styles.pausedIcon}>⏸️</span>
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
              {/* Controles sobre o vídeo com hover transparente */}
              <div style={styles.videoOverlayControls}>
                <button
                  onClick={handleToggleFullscreen}
                  style={{
                    ...styles.minimalOverlayBtn,
                    opacity: isVideoHovered ? 1 : 0,
                    pointerEvents: isVideoHovered ? 'auto' : 'none',
                  }}
                  title="Tela Cheia"
                  aria-label="Tela Cheia"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
                <button
                  onClick={handleTogglePiP}
                  style={{
                    ...styles.minimalOverlayBtn,
                    opacity: isVideoHovered ? 1 : 0,
                    pointerEvents: isVideoHovered ? 'auto' : 'none',
                  }}
                  title="Picture-in-Picture"
                  aria-label="Picture-in-Picture"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" fillOpacity="0.4" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.waitingStateBox}>
              <h3 style={styles.waitingTitle}>Aguardando o professor iniciar a transmissão...</h3>
              <p style={styles.waitingSub}>Você receberá o vídeo e áudio automaticamente assim que a aula começar.</p>
              {!isChatOpen && (
                <button
                  onClick={handleToggleChat}
                  style={styles.waitingChatBtn}
                >
                  💬 Abrir Chat da Aula
                  {unreadCount > 0 && (
                    <span style={styles.unreadBadge}>{unreadCount}</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal/Gaveta de Arquivos da Aula */}
        {isFilesOpen && (
          <div
            style={{
              ...styles.filesDrawer,
              top: isFullscreen ? '65px' : '12px',
              right: isChatOpen ? '360px' : '20px',
            }}
          >
            <div style={styles.drawerHeader}>
              <span style={styles.drawerTitle}>📁 Arquivos da Aula ({sharedFiles.length})</span>
              <button
                onClick={() => setIsFilesOpen(false)}
                style={styles.closeDrawerBtn}
                title="Fechar Arquivos"
              >
                ✕
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
                    <div style={styles.fileIconBox}>📄</div>
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
        )}

        {/* Backdrop para mobile quando a gaveta de chat estiver aberta */}
        {isMobile && isChatOpen && (
          <div style={styles.mobileBackdrop} onClick={handleToggleChat} />
        )}

        {/* Painel do Chat Retrátil (Sidebar no Desktop / Drawer no Mobile) */}
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
          <div style={styles.chatHeader}>
            <span>Chat da Aula</span>
            <button
              onClick={handleToggleChat}
              style={styles.closeChatBtn}
              title="Recolher Chat"
            >
              ✕
            </button>
          </div>
          <div style={styles.messagesList}>
            {messages.map((m, idx) => {
              const isSenderStudent = m.role === 'aluno' || m.sender_role === 'aluno';
              const displayName = m.name || m.sender_name || 'Participante';
              const studentMatricula = m.student_id ? `(${m.student_id})` : '';
              const isPrivate = !!m.is_private;

              return (
                <div
                  key={m.message_id || idx}
                  style={{
                    ...styles.messageCard,
                    ...(isPrivate ? styles.privateMessageCard : {}),
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
                    {isPrivate && <span style={styles.privateBadge}>🔒 PRIVADO</span>}
                  </div>
                  <p style={styles.msgContent}>{m.content}</p>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSendChat} style={styles.chatForm}>
            {/* Seletor de Chat Público / Privado para o Professor */}
            <div style={styles.chatModeSelector}>
              <button
                type="button"
                onClick={() => setIsPrivateChat(false)}
                style={!isPrivateChat ? styles.modeBtnActive : styles.modeBtn}
              >
                🌐 Todos (Público)
              </button>
              <button
                type="button"
                onClick={() => setIsPrivateChat(true)}
                style={isPrivateChat ? styles.modeBtnPrivateActive : styles.modeBtn}
              >
                🔒 Professor (Privado)
              </button>
            </div>

            <div style={styles.chatInputRow}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isPrivateChat ? 'Mensagem privada ao professor...' : 'Mensagem para todos...'}
                style={styles.chatInput}
              />
              <button type="submit" style={styles.sendBtn}>Enviar</button>
            </div>
          </form>
        </aside>
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
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
    width: '28px',
    height: '28px',
    objectFit: 'contain',
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
  minimalOverlayBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    color: '#ffffff',
    cursor: 'pointer',
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
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    border: '2px solid rgba(251, 191, 36, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px',
  },
  pausedIcon: {
    fontSize: '32px',
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
    maxWidth: '360px',
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
    fontSize: '15px',
    cursor: 'pointer',
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
};
