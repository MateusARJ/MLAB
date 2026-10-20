import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CaptureSource } from '@mlab/types';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useLocalRecorder } from '../hooks/useLocalRecorder';
import { useWebRTCPublisher } from '../hooks/useWebRTCPublisher';
import { getStoredToken } from '../services/auth';
import { closeRoom } from '../services/room';
import mlabLogo from '../assets/MLAB-logo.png';
import {
  Screen,
  Application,
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
} from '@mlab/ui';


interface RoomProps {
  room: { id: string; slug: string; link: string };
  onCloseRoom: () => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isLanLink(link?: string): boolean {
  if (!link) return false;
  try {
    const url = new URL(link.startsWith('http') ? link : `http://${link}`);
    const host = url.hostname;
    return (
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

export const Room: React.FC<RoomProps> = ({ room, onCloseRoom }) => {
  // Configuração pré-transmissão
  const [wantRecord, setWantRecord] = useState<boolean>(false);
  const [qualityProfile, setQualityProfile] = useState<'1080p_30' | '1080p_60'>('1080p_30');
  const [tentativeSource, setTentativeSource] = useState<CaptureSource | null>(null);
  const [isLiveSession, setIsLiveSession] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

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

  const handleCopyLink = useCallback(async () => {
    if (!room.link) return;
    try {
      if (window.electronAPI && typeof window.electronAPI.copyToClipboard === 'function') {
        await window.electronAPI.copyToClipboard(room.link);
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(room.link);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = room.link;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  }, [room.link]);

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
  const currentSource = tentativeSource || (sources.length > 0 ? sources[0] : null);

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

  useEffect(() => {
    if (!isSidebarOpen && messages.length > prevMessagesLength.current) {
      setUnreadCount((prev) => prev + (messages.length - prevMessagesLength.current));
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isSidebarOpen]);

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

  // Se o usuário selecionou uma fonte nas miniaturas da lista
  useEffect(() => {
    if (sources.length > 0 && !tentativeSource) {
      setTentativeSource(sources[0]);
    }
  }, [sources, tentativeSource]);

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

  useEffect(() => {
    if (!isLiveSession || captureMode !== 'screen') return;

    const handleWindowFocus = () => {
      handleRefreshScreenCapture();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isLiveSession, captureMode, handleRefreshScreenCapture]);

  // Identifica telas/monitores disponíveis para alternância rápida
  const screenSources = sources.filter((s) => s.type === 'screen' || s.id.startsWith('screen'));

  const handleSwitchScreen = useCallback(async (source: CaptureSource) => {
    const fps = qualityProfile === '1080p_60' ? 60 : 30;
    const newStream = await selectSource(source, fps);
    if (source.thumbnail) {
      setCurrentThumbnail(source.thumbnail);
    }
    if (newStream) {
      if (micMuted) {
        newStream.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
      await changeStream(newStream);
    }
  }, [selectSource, micMuted, changeStream, qualityProfile]);

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

    const fps = qualityProfile === '1080p_60' ? 60 : 30;
    const activeStream = await selectSource(sourceToUse, fps);
    setIsLiveSession(true);

    // Quando o professor começa a transmitir a tela, o microfone deve ficar desligado por padrão
    if (activeStream) {
      activeStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
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
  }, [currentSource, selectSource, qualityProfile, wantRecord, startRecording, isPublishing, connectionState, changeStream, startPublishing]);

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
    endSession();
    stopCapture();
    onCloseRoom();
  }, [wantRecord, recordingStatus, stopRecording, endSession, stopCapture, onCloseRoom, room?.id]);

  const handleReconfigure = useCallback(() => {
    setIsLiveSession(false);
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
            <h2 style={styles.title}>{professorName ? `MLab — Prof. ${professorName}` : `MLab — Sala: ${room.slug}`}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={styles.roomLinkStatic}>{room.link}</div>
              {isLanLink(room.link) && (
                <span
                  style={styles.lanBadge}
                  title="Transmissão operando diretamente na rede local (sem necessidade de internet externa)"
                >
                  Rede Local (LAN)
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={handleCopyLink}
            style={linkCopied ? styles.copyBtnSuccess : styles.copyBtn}
            title={room.link}
          >
            {linkCopied ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Checkmark size={14} /> Link Copiado!</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Copy size={14} /> Copiar Link</span>}
          </button>
          <button
            onClick={handleEndSession}
            style={isSaving ? styles.closeBtnDisabled : styles.closeBtn}
            disabled={isSaving}
          >
            {isSaving ? 'Salvando Gravação...' : 'Encerrar Transmissão'}
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
                    setTentativeSource(null);
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
                  }}
                  style={captureMode === 'window' ? styles.modeTabActive : styles.modeTab}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Application size={16} /> Janela / Aba Específica (Isola a Aplicação)</span>
                </button>
              </div>

              {captureMode === 'window' && (
                <div style={styles.windowHintBox}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle', marginRight: '4px' }}><Idea size={16} /></span><strong>Dica:</strong> Certifique-se de que a janela ou navegador esteja aberto na Área de Trabalho (não minimizado na barra de tarefas) para que seja listado.
                </div>
              )}

              <div style={styles.sourceGrid}>
                {sources.length === 0 ? (
                  <p style={styles.noSources}>Nenhuma fonte detectada para este modo.</p>
                ) : (
                  sources.map((src) => {
                    const isSelected = currentSource?.id === src.id;
                    return (
                      <div
                        key={src.id}
                        onClick={() => setTentativeSource(src)}
                        style={isSelected ? styles.sourceCardSelected : styles.sourceCard}
                      >
                        <img src={src.thumbnail} alt={src.name} style={styles.thumbnail} />
                        <span style={styles.sourceName}>{src.name}</span>
                        {isSelected && <span style={styles.selectedBadge}><Checkmark size={12} style={{ marginRight: '4px' }} />Selecionada</span>}
                      </div>
                    );
                  })
                )}
              </div>
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
                    {qualityProfile === '1080p_30' && <span style={styles.selectedBadge}><Checkmark size={12} style={{ marginRight: '4px' }} />Selecionado</span>}
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
                    {qualityProfile === '1080p_60' && <span style={styles.selectedBadge}><Checkmark size={12} style={{ marginRight: '4px' }} />Selecionado</span>}
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
                      Modo: {captureMode === 'screen' ? 'Tela Cheia' : 'Janela Específica'} (
                      {selectedSource?.name || 'Fonte Ativa'})
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

                {/* Pré-visualização Estática no Modo Tela Cheia (Anti-Espelho sem botões) */}
                <div style={styles.previewArea}>
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

                  {/* Notificação Flutuante de Mão Levantada (quando a sidebar estiver recolhida) */}
                  {lastHandRaised && !isSidebarOpen && (
                    <div style={styles.handToastOverlay} role="alert">
                      <div style={styles.handToastContent}>
                        <Touch_1Filled size={18} style={{ color: '#0f62fe', flexShrink: 0 }} />
                        <div style={styles.handToastText}>
                          <span style={styles.handToastStrong}>{lastHandRaised.studentName}</span> levantou a mão.
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
                      <>
                        <div style={styles.messagesList}>
                          {messages.filter((m: any) => m.is_private !== true).length === 0 ? (
                            <div style={styles.emptyMessagesBox}>
                              <p style={styles.emptyText}>Nenhuma mensagem pública no chat até o momento.</p>
                            </div>
                          ) : (
                            messages.filter((m: any) => m.is_private !== true).map((m: any, idx: number) => {
                              const isStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                              const displayName = m.name || m.sender_name || 'Participante';
                              const matricula = m.student_id ? `(${m.student_id})` : '';

                              return (
                                <div key={m.message_id || idx} style={styles.messageCard}>
                                  <div style={styles.messageHeaderRow}>
                                    <span style={styles.senderName}>
                                      {displayName} {matricula && <span style={styles.matriculaText}>{matricula}</span>}
                                      <small style={styles.roleTag}> [{isStudent ? 'aluno' : 'professor'}]</small>
                                    </span>
                                    <span style={styles.publicTag}>TURMA</span>
                                  </div>
                                  <p style={styles.messageBody}>{m.content}</p>
                                </div>
                              );
                            })
                          )}
                        </div>

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

                        <div style={styles.messagesList}>
                          {targetStudent ? (
                            // Conversa privada filtrada para o aluno selecionado
                            (() => {
                              const studentMsgs = messages.filter((m: any) =>
                                m.is_private === true &&
                                (m.participant_id === targetStudent.id || m.target_id === targetStudent.id)
                              );

                              return studentMsgs.length === 0 ? (
                                <div style={styles.emptyMessagesBox}>
                                  <p style={styles.emptyText}>
                                    Nenhuma mensagem trocada ainda com <strong>{targetStudent.name}</strong>.
                                  </p>
                                  <p style={{ ...styles.emptyText, fontSize: '11px', color: '#64748b' }}>
                                    Envie uma mensagem abaixo para iniciar a conversa privada.
                                  </p>
                                </div>
                              ) : (
                                studentMsgs.map((m: any, idx: number) => {
                                  const isStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                                  const displayName = m.name || m.sender_name || 'Participante';
                                  const matricula = m.student_id ? `(${m.student_id})` : '';

                                  return (
                                    <div
                                      key={m.message_id || idx}
                                      style={{ ...styles.messageCard, ...styles.privateMessageCard }}
                                    >
                                      <div style={styles.messageHeaderRow}>
                                        <span style={styles.senderName}>
                                          {displayName} {matricula && <span style={styles.matriculaText}>{matricula}</span>}
                                          <small style={styles.roleTag}> [{isStudent ? 'aluno' : 'professor'}]</small>
                                        </span>
                                        <span style={styles.privateTag}><Locked size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />PRIVADO</span>
                                      </div>
                                      <p style={styles.messageBody}>{m.content}</p>
                                    </div>
                                  );
                                })
                              );
                            })()
                          ) : (
                            // Visão geral de todas as dúvidas privadas recebidas dos alunos
                            (() => {
                              const allPrivate = messages.filter((m: any) => m.is_private === true);

                              return allPrivate.length === 0 ? (
                                <div style={styles.emptyMessagesBox}>
                                  <p style={styles.emptyText}>Nenhuma dúvida privada recebida até o momento.</p>
                                  <p style={{ ...styles.emptyText, fontSize: '11px', color: '#64748b' }}>
                                    Selecione um aluno no menu acima para iniciar uma conversa.
                                  </p>
                                </div>
                              ) : (
                                allPrivate.map((m: any, idx: number) => {
                                  const isStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                                  const displayName = m.name || m.sender_name || 'Participante';
                                  const matricula = m.student_id ? `(${m.student_id})` : '';

                                  return (
                                    <div
                                      key={m.message_id || idx}
                                      style={{ ...styles.messageCard, ...styles.privateMessageCard }}
                                    >
                                      <div style={styles.messageHeaderRow}>
                                        <span style={styles.senderName}>
                                          {displayName} {matricula && <span style={styles.matriculaText}>{matricula}</span>}
                                          <small style={styles.roleTag}> [{isStudent ? 'aluno' : 'professor'}]</small>
                                        </span>
                                        <span style={styles.privateTag}><Locked size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />PRIVADO</span>
                                      </div>
                                      <p style={styles.messageBody}>{m.content}</p>
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
                              );
                            })()
                          )}
                        </div>

                        {/* Formulário exclusivo do Chat Privado — Sempre visível sem exigir clique prévio no aluno */}
                        <form onSubmit={handleSendPrivateChat} style={styles.chatForm}>
                          {targetStudent ? (
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
                          ) : (
                            <div style={styles.targetIndicatorBoxMuted}>
                              <span style={styles.targetIndicatorTextMuted}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Locked size={14} /> Chat Privado: {studentsOnly.length === 1 ? `Mensagem direta para ${studentsOnly[0].name}` : 'Selecione um aluno acima ou digite para responder'}</span>
                              </span>
                            </div>
                          )}

                          <div style={styles.chatInputRow}>
                            <input
                              type="text"
                              value={privateChatInput}
                              onChange={(e) => setPrivateChatInput(e.target.value)}
                              placeholder={
                                targetStudent
                                  ? `Mensagem privada para ${targetStudent.name}...`
                                  : studentsOnly.length === 1
                                  ? `Mensagem privada para ${studentsOnly[0].name}...`
                                  : 'Mensagem privada para o aluno...'
                              }
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
    width: '46px',
    height: '46px',
    objectFit: 'contain',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  roomLinkStatic: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '3px',
    userSelect: 'text',
    cursor: 'default',
  },
  lanBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: 'rgba(15, 98, 254, 0.15)',
    color: '#4589ff',
    fontWeight: '600',
    border: '1px solid rgba(15, 98, 254, 0.3)',
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'default',
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
  copyBtn: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  copyBtnSuccess: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#4ade80',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
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
  refreshCaptureBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  toggleLiveVideoBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #64748b',
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    fontSize: '11px',
    cursor: 'pointer',
  },
  liveMirrorWarningBadge: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.90)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '600',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.9)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  shieldActivateBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
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
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
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
  privatePromptNotice: {
    padding: '12px',
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center',
    backgroundColor: '#111c30',
    borderTop: '1px solid #1e293b',
  },
  targetIndicatorBoxMuted: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px dashed rgba(99, 102, 241, 0.3)',
  },
  targetIndicatorTextMuted: {
    fontSize: '11px',
    color: '#a5b4fc',
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
  // Privacy Shield Styles
  privacyConfigBox: {
    backgroundColor: '#0d1526',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '14px',
  },
  privacyConfigHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  privacyTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  privacyConfigureBtn: {
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  privacySubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '0 0 10px 0',
  },
  privacyChipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  privacyChip: {
    backgroundColor: '#172033',
    color: '#94a3b8',
    border: '1px solid #1e293b',
    borderRadius: '16px',
    padding: '4px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  privacyChipActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: '1px solid #ef4444',
    borderRadius: '16px',
    padding: '4px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  controlBtnActivePrivacy: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  privacyAlertBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    color: '#ffffff',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
  },
  privacyAlertText: {
    flex: 1,
  },
  privacyBannerResumeBtn: {
    backgroundColor: '#ffffff',
    color: '#dc2626',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
};

