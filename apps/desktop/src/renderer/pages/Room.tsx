import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CaptureSource, CaptureSourceType, RecordingFormat } from '@screenshare/types';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useLocalRecorder } from '../hooks/useLocalRecorder';
import { useWebRTCPublisher } from '../hooks/useWebRTCPublisher';
import { getStoredToken } from '../services/auth';
import mlabLogo from '../assets/MLAB-logo.png';

interface RoomProps {
  room: { id: string; slug: string; link: string };
  onCloseRoom: () => void;
}

export const Room: React.FC<RoomProps> = ({ room, onCloseRoom }) => {
  // Configuração pré-transmissão
  const [wantRecord, setWantRecord] = useState<boolean>(true);
  const [selectedFormat, setSelectedFormat] = useState<RecordingFormat>('webm');
  const [tentativeSource, setTentativeSource] = useState<CaptureSource | null>(null);
  const [isLiveSession, setIsLiveSession] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const {
    captureMode,
    setCaptureMode,
    sources,
    selectedSource,
    stream,
    micMuted,
    videoPaused,
    hasPermissions,
    loadSources,
    selectSource,
    toggleMicMute,
    toggleVideoPause,
    stopCapture,
  } = useScreenCapture('screen');

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
  } = useLocalRecorder({ stream, initialFormat: selectedFormat });

  const token = getStoredToken();
  const {
    isPublishing,
    connectionState,
    error: publisherError,
    startPublishing,
    stopPublishing,
    endSession,
  } = useWebRTCPublisher({
    roomId: room.id,
    stream,
    token,
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Se o usuário selecionou uma fonte nas miniaturas da lista
  useEffect(() => {
    if (sources.length > 0 && !tentativeSource) {
      setTentativeSource(sources[0]);
    }
  }, [sources, tentativeSource]);

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
    if (!tentativeSource) return;

    const activeStream = await selectSource(tentativeSource);
    setIsLiveSession(true);

    // Se optou por gravar, inicia gravação local
    if (wantRecord) {
      startRecording(selectedFormat, activeStream || undefined);
    }

    // Inicia publicação WebRTC para a SFU Pion
    startPublishing(activeStream || undefined);
  }, [tentativeSource, selectSource, wantRecord, selectedFormat, startRecording, startPublishing]);

  const handleEndSession = useCallback(() => {
    if (wantRecord && recordingStatus === 'recording') {
      stopRecording();
    }
    endSession();
    stopCapture();
    onCloseRoom();
  }, [wantRecord, recordingStatus, stopRecording, endSession, stopCapture, onCloseRoom]);

  const handleReconfigure = useCallback(() => {
    setIsLiveSession(false);
  }, []);

  return (
    <div style={styles.container}>
      {/* Cabeçalho */}
      <header style={styles.header}>
        <div style={styles.headerTitleBox}>
          <img src={mlabLogo} alt="MLab Logo" style={styles.logoImg} />
          <div>
            <h2 style={styles.title}>MLab — Sala: {room.slug}</h2>
            <span style={styles.subtitle}>ID: {room.id}</span>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button onClick={handleEndSession} style={styles.closeBtn}>
            Encerrar Transmissão
          </button>
        </div>
      </header>

      {hasPermissions === false && (
        <div style={styles.permissionAlert}>
          <span>Atenção: Permissões de gravação de tela ou microfone não foram detectadas no Sistema Operacional.</span>
          <button
            onClick={() => loadSources(captureMode)}
            style={styles.retryPermBtn}
          >
            🔄 Verificar Novamente
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

      <main style={styles.mainContent}>
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
                  ⏺️ Sim, Gravar Aula
                </button>
                <button
                  type="button"
                  onClick={() => setWantRecord(false)}
                  style={!wantRecord ? styles.choiceBtnActive : styles.choiceBtn}
                >
                  🚫 Apenas Transmitir (Sem Gravação)
                </button>
              </div>

              {wantRecord && (
                <div style={styles.formatSelectBox}>
                  <label style={styles.formatLabel}>Formato do arquivo de vídeo:</label>
                  <div style={styles.buttonGroup}>
                    <button
                      type="button"
                      onClick={() => setSelectedFormat('webm')}
                      style={selectedFormat === 'webm' ? styles.subChoiceBtnActive : styles.subChoiceBtn}
                    >
                      .webm (Padrão Web / Alta Compressão)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFormat('mp4')}
                      style={selectedFormat === 'mp4' ? styles.subChoiceBtnActive : styles.subChoiceBtn}
                    >
                      .mp4 (Alta Compatibilidade)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Modo de Transmissão de Tela */}
            <div style={styles.sectionBox}>
              <h4 style={styles.sectionTitle}>2. Escolha o modo de captura de tela</h4>
              <div style={styles.modeTabs}>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode('screen');
                    setTentativeSource(null);
                  }}
                  style={captureMode === 'screen' ? styles.modeTabActive : styles.modeTab}
                >
                  🖥️ Tela Cheia (Acompanha o SO e Navegação)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode('window');
                    setTentativeSource(null);
                  }}
                  style={captureMode === 'window' ? styles.modeTabActive : styles.modeTab}
                >
                  🗔 Janela / Aba Específica (Isola a Aplicação)
                </button>
              </div>

              <div style={styles.sourceGrid}>
                {sources.length === 0 ? (
                  <p style={styles.noSources}>Nenhuma fonte detectada para este modo.</p>
                ) : (
                  sources.map((src) => {
                    const isSelected = tentativeSource?.id === src.id;
                    return (
                      <div
                        key={src.id}
                        onClick={() => setTentativeSource(src)}
                        style={isSelected ? styles.sourceCardSelected : styles.sourceCard}
                      >
                        <img src={src.thumbnail} alt={src.name} style={styles.thumbnail} />
                        <span style={styles.sourceName}>{src.name}</span>
                        {isSelected && <span style={styles.selectedBadge}>✓ Selecionada</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Qualidade da Transmissão */}
            <div style={styles.sectionBox}>
              <h4 style={styles.sectionTitle}>3. Resolução e Qualidade de Vídeo</h4>
              <div style={styles.qualityInfoBox}>
                <div style={styles.qualityBadgeActive}>
                  📺 1080p Full HD @ 30 fps
                </div>
                <div style={styles.qualityDetails}>
                  <span style={styles.qualityParam}>Bitrate: <strong>4.0 Mbps</strong></span>
                  <span style={styles.qualityParam}>Otimização: <strong>Nitidez para Textos e Código</strong></span>
                  <span style={styles.qualityParam}>Fidelidade: <strong>Resolução Bloqueada</strong> (sem rebaixamento)</span>
                </div>
              </div>
            </div>

            {/* 4. Botão de Avanço */}
            <div style={styles.advanceBar}>
              <button
                type="button"
                onClick={handleStartSession}
                disabled={!tentativeSource}
                style={tentativeSource ? styles.advanceBtn : styles.advanceBtnDisabled}
              >
                Avançar e Iniciar Transmissão {wantRecord ? '(Com Gravação)' : ''} →
              </button>
            </div>
          </div>
        ) : (
          /* ── SESSÃO AO VIVO (TRANSMISSÃO + GRAVAÇÃO ATIVA) ── */
          <div style={styles.liveContainer}>
            {/* Barra de Status */}
            <div style={styles.statusBar}>
              <div style={styles.statusLeft}>
                <span style={styles.liveBadge}>
                  <span style={styles.pulsingDotGreen} /> AO VIVO
                </span>
                <span style={styles.resolutionBadge}>
                  1080p @ 30fps • 4 Mbps
                </span>
                <span style={styles.statusInfo}>
                  Modo: {captureMode === 'screen' ? '🖥️ Tela Cheia' : '🗔 Janela Específica'} (
                  {selectedSource?.name || 'Fonte Ativa'})
                </span>
              </div>

              <div style={styles.statusRight}>
                {wantRecord ? (
                  <div style={styles.recordStatusBox}>
                    {recordingStatus === 'recording' && (
                      <span style={styles.recordingBadge}>
                        <span style={styles.pulsingDotRed} /> REC {formattedDuration} ({selectedFormat})
                      </span>
                    )}
                    {recordingStatus === 'paused' && (
                      <span style={styles.pausedBadge}>⏸️ PAUSADO {formattedDuration}</span>
                    )}
                    {recordingStatus === 'stopped' && (
                      <span style={styles.stoppedBadge}>⏹️ GRAVAÇÃO FINALIZADA</span>
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

            {/* Pré-visualização de Vídeo */}
            <div style={styles.previewArea}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ ...styles.video, opacity: videoPaused ? 0.3 : 1 }}
              />
            </div>

            {/* Barra de Controles de Transmissão */}
            <div style={styles.controlsBar}>
              <button
                type="button"
                onClick={toggleMicMute}
                style={micMuted ? styles.controlBtnActive : styles.controlBtn}
              >
                {micMuted ? '🔇 Desmutar Microfone' : '🎤 Mutar Microfone'}
              </button>
              <button
                type="button"
                onClick={toggleVideoPause}
                style={videoPaused ? styles.controlBtnActive : styles.controlBtn}
              >
                {videoPaused ? '▶️ Retomar Vídeo' : '⏸️ Pausar Vídeo'}
              </button>
              <button type="button" onClick={handleReconfigure} style={styles.controlBtn}>
                ⚙️ Alterar Modo / Fonte
              </button>
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
    padding: '14px 24px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  headerTitleBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerActions: {
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
    fontSize: '17px',
    fontWeight: '700',
    color: '#38bdf8',
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    color: '#94a3b8',
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
  subChoiceBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
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
    gap: '16px',
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    border: '1px solid #1e293b',
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: '4px 10px',
    borderRadius: '6px',
  },
  pulsingDotGreen: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
  },
  resolutionBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  qualityInfoBox: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  qualityBadgeActive: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    gap: '6px',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid #38bdf8',
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: '13px',
    padding: '4px 10px',
    borderRadius: '6px',
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
    fontSize: '13px',
    color: '#cbd5e1',
  },
  statusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  recordStatusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  recordingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#f87171',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: '4px 10px',
    borderRadius: '6px',
  },
  pulsingDotRed: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
  pausedBadge: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    padding: '4px 10px',
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
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    fontSize: '12px',
    cursor: 'pointer',
  },
  recSaveBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#22c55e',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
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
    minHeight: '380px',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  controlsBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '14px',
    padding: '14px',
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    border: '1px solid #1e293b',
  },
  controlBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  controlBtnActive: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
};

