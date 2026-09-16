import React, { useRef, useEffect } from 'react';
import { useScreenCapture, Source } from '../hooks/useScreenCapture';
import mlabLogo from '../assets/MLAB-logo.png';

interface RoomProps {
  room: { id: string; slug: string; link: string };
  onCloseRoom: () => void;
}

export const Room: React.FC<RoomProps> = ({ room, onCloseRoom }) => {
  const {
    sources,
    selectedSource,
    stream,
    micMuted,
    videoPaused,
    hasPermissions,
    selectSource,
    toggleMicMute,
    toggleVideoPause,
    stopCapture,
  } = useScreenCapture();

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerTitleBox}>
          <img src={mlabLogo} alt="MLab Logo" style={styles.logoImg} />
          <div>
            <h2 style={styles.title}>MLab — Sala: {room.slug}</h2>
            <span style={styles.subtitle}>ID: {room.id}</span>
          </div>
        </div>
        <button onClick={() => { stopCapture(); onCloseRoom(); }} style={styles.closeBtn}>
          Encerrar Transmissão
        </button>
      </header>

      {hasPermissions === false && (
        <div style={styles.permissionAlert}>
          Atenção: Permissões de gravação de tela ou microfone não foram concedidas no Sistema Operacional.
        </div>
      )}

      <main style={styles.mainContent}>
        <div style={styles.previewArea}>
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ ...styles.video, opacity: videoPaused ? 0.3 : 1 }}
            />
          ) : (
            <div style={styles.placeholderBox}>
              <h3 style={styles.selectPrompt}>Selecione uma Tela ou Janela para Compartilhar</h3>
              <div style={styles.grid}>
                {sources.map((src) => (
                  <div
                    key={src.id}
                    onClick={() => selectSource(src)}
                    style={styles.sourceCard}
                  >
                    <img src={src.thumbnail} alt={src.name} style={styles.thumbnail} />
                    <span style={styles.sourceName}>{src.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {stream && (
          <div style={styles.controlsBar}>
            <button onClick={toggleMicMute} style={micMuted ? styles.controlBtnActive : styles.controlBtn}>
              {micMuted ? 'Microfone Mutado' : 'Mutar Microfone'}
            </button>
            <button onClick={toggleVideoPause} style={videoPaused ? styles.controlBtnActive : styles.controlBtn}>
              {videoPaused ? 'Vídeo Pausado' : 'Pausar Vídeo'}
            </button>
            <button onClick={() => selectSource(sources[0])} style={styles.controlBtn}>
              Alterar Fonte de Captura
            </button>
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
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  headerTitleBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImg: {
    width: '32px',
    height: '32px',
    objectFit: 'contain',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#38bdf8',
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  closeBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  permissionAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    padding: '12px 24px',
    fontSize: '13px',
    borderBottom: '1px solid #ef4444',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '20px',
  },
  previewArea: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholderBox: {
    textAlign: 'center',
    padding: '20px',
  },
  selectPrompt: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '24px',
    color: '#cbd5e1',
  },
  grid: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  sourceCard: {
    width: '180px',
    padding: '12px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  thumbnail: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
    borderRadius: '6px',
  },
  sourceName: {
    fontSize: '13px',
    color: '#f8fafc',
    textAlign: 'center',
  },
  controlsBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
  },
  controlBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  controlBtnActive: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
};
