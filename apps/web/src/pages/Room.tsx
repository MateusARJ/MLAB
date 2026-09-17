import React, { useRef, useEffect, useState } from 'react';
import { useWebRTCSubscriber } from '../hooks/useWebRTCSubscriber';

interface RoomProps {
  token: string;
  roomInfo: { room_id: string; ws_url: string; ice_servers: any[] };
  onLeave: () => void;
}

export const Room: React.FC<RoomProps> = ({ token, roomInfo, onLeave }) => {
  const {
    stream,
    autoplayBlocked,
    setAutoplayBlocked,
    connectionStatus,
    messages,
    sendChatMessage,
  } = useWebRTCSubscriber(token, roomInfo);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState('');

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
  const prevMessagesLength = useRef(messages.length);

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
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => {
          // RF-21: Tratamento de Autoplay Policy dos navegadores (móveis ou desktop)
          if (err.name === 'NotAllowedError') {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
            setAutoplayBlocked(true);
          }
        });
    }
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
    sendChatMessage(chatInput);
    setChatInput('');
  };

  return (
    <div ref={containerRef} style={styles.container}>
      <header style={styles.header}>
        <div style={styles.brandBox}>
          <img src="/MLAB-logo.png" alt="MLab Logo" style={styles.logoImg} />
          <h2 style={styles.title}>MLab — Aula ao Vivo</h2>
        </div>
        <div style={styles.statusBox}>
          <span style={styles.statusLabel}>Status: {connectionStatus}</span>
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
          <button onClick={onLeave} style={styles.leaveBtn}>Sair</button>
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
        <div style={styles.videoSection}>
          {stream ? (
            <div style={styles.videoWrapper}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={autoplayBlocked}
                style={styles.video}
              />
              <div style={styles.videoOverlayControls}>
                {!isChatOpen && (
                  <button
                    onClick={handleToggleChat}
                    style={styles.floatingChatBtn}
                    title="Abrir Chat"
                  >
                    💬 Chat
                    {unreadCount > 0 && (
                      <span style={styles.unreadBadgeSmall}>{unreadCount}</span>
                    )}
                  </button>
                )}
                <button onClick={handleToggleFullscreen} style={styles.overlayBtn}>Tela Cheia</button>
                <button onClick={handleTogglePiP} style={styles.overlayBtn}>Picture-in-Picture</button>
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
                  width: isChatOpen ? '320px' : '0px',
                  minWidth: isChatOpen ? '320px' : '0px',
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
            {messages.map((m, idx) => (
              <div key={idx} style={styles.messageCard}>
                <span style={styles.senderInfo}>
                  {m.sender_name} <small style={styles.roleBadge}>[{m.sender_role}]</small>
                </span>
                <p style={styles.msgContent}>{m.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} style={styles.chatForm}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              style={styles.chatInput}
            />
            <button type="submit" style={styles.sendBtn}>Enviar</button>
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
    padding: '14px 24px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
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
    gap: '16px',
  },
  statusLabel: {
    fontSize: '13px',
    color: '#94a3b8',
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
  },
  videoOverlayControls: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    display: 'flex',
    gap: '10px',
  },
  overlayBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
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
  unreadBadgeSmall: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 5px',
    borderRadius: '8px',
    lineHeight: '1',
  },
  floatingChatBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
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
  senderInfo: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#38bdf8',
  },
  roleBadge: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  msgContent: {
    fontSize: '13px',
    color: '#f8fafc',
    margin: '4px 0 0 0',
  },
  chatForm: {
    padding: '16px',
    borderTop: '1px solid #334155',
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
};
