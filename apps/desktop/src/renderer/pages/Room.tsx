import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CaptureSource } from '@mlab/types';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useLocalRecorder } from '../hooks/useLocalRecorder';
import { useWebRTCPublisher } from '../hooks/useWebRTCPublisher';
import { getStoredToken } from '../services/auth';
import mlabLogo from '../assets/MLAB-logo.png';

interface RoomProps {
  room: { id: string; slug: string; link: string };
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
  const [wantRecord, setWantRecord] = useState<boolean>(true);
  const [tentativeSource, setTentativeSource] = useState<CaptureSource | null>(null);
  const [isLiveSession, setIsLiveSession] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  // Estados da Sidebar retrátil, Chat, Alunos e Arquivos
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'students' | 'files'>('chat');
  const [chatInput, setChatInput] = useState<string>('');
  const [targetStudent, setTargetStudent] = useState<{ id: string; name: string; student_id?: string } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  } = useLocalRecorder({ stream });

  const token = getStoredToken();
  const {
    isPublishing,
    connectionState,
    error: publisherError,
    messages = [],
    participants = [],
    sendChatMessage,
    sendStreamPause,
    startPublishing,
    changeStream,
    stopPublishing,
    endSession,
  } = useWebRTCPublisher({
    roomId: room.id,
    stream,
    token,
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
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Se o usuário selecionou uma fonte nas miniaturas da lista
  useEffect(() => {
    if (sources.length > 0 && !tentativeSource) {
      setTentativeSource(sources[0]);
    }
  }, [sources, tentativeSource]);

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
    if (!tentativeSource) return;

    const activeStream = await selectSource(tentativeSource);
    setIsLiveSession(true);

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
  }, [tentativeSource, selectSource, wantRecord, startRecording, isPublishing, connectionState, changeStream, startPublishing]);

  const handleEndSession = useCallback(async () => {
    if (wantRecord && recordingStatus === 'recording') {
      try {
        await stopRecording();
      } catch (err) {
        console.warn('Erro ao aguardar gravação ser salva:', err);
      }
    }
    endSession();
    stopCapture();
    onCloseRoom();
  }, [wantRecord, recordingStatus, stopRecording, endSession, stopCapture, onCloseRoom]);

  const handleReconfigure = useCallback(() => {
    setIsLiveSession(false);
  }, []);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const isPrivate = targetStudent !== null;
    if (typeof sendChatMessage === 'function') {
      sendChatMessage(chatInput.trim(), isPrivate, targetStudent?.id);
    }
    setChatInput('');
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

  return (
    <div style={styles.container}>
      {/* Cabeçalho */}
      <header style={styles.header}>
        <div style={styles.headerTitleBox}>
          <img src={mlabLogo} alt="MLab Logo" style={styles.logoImg} />
          <div>
            <h2 style={styles.title}>MLab — Sala: {room.slug}</h2>
            {/* Link da sala diretamente abaixo do título da sala */}
            <div
              onClick={handleCopyLink}
              style={styles.roomLinkText}
              title="Clique para copiar o link da sala"
            >
              🔗 {room.link}
            </div>
            <span style={styles.subtitle}>ID: {room.id}</span>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={handleCopyLink}
            style={linkCopied ? styles.copyBtnSuccess : styles.copyBtn}
            title={room.link}
          >
            {linkCopied ? '✓ Link Copiado!' : '📋 Copiar Link'}
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
                      1080p @ 30fps • 4 Mbps
                    </span>
                    <span style={styles.studentsBadge}>
                      👥 {studentsOnly.length} {studentsOnly.length === 1 ? 'Aluno' : 'Alunos'}
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
                            <span style={styles.pulsingDotRed} /> REC {formattedDuration} (.webm)
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

                {/* Pré-visualização de Vídeo ou Imagem Estática */}
                <div style={styles.previewArea}>
                  {captureMode === 'screen' ? (
                    <div style={styles.staticPreviewBox}>
                      {selectedSource?.thumbnail || tentativeSource?.thumbnail ? (
                        <img
                          src={selectedSource?.thumbnail || tentativeSource?.thumbnail}
                          alt="Pré-visualização da Tela Cheia"
                          style={{ ...styles.previewMedia, opacity: videoPaused ? 0.3 : 1 }}
                        />
                      ) : (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{ ...styles.previewMedia, opacity: videoPaused ? 0.3 : 1 }}
                        />
                      )}
                      <div style={styles.staticOverlayBadge}>
                        🖥️ Tela Inteira Ativa • Imagem Estática
                      </div>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ ...styles.previewMedia, opacity: videoPaused ? 0.3 : 1 }}
                    />
                  )}
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
                    onClick={handleToggleVideoPause}
                    style={videoPaused ? styles.controlBtnActive : styles.controlBtn}
                  >
                    {videoPaused ? '▶️ Retomar Vídeo' : '⏸️ Pausar Vídeo'}
                  </button>
                  <button type="button" onClick={handleReconfigure} style={styles.controlBtn}>
                    ⚙️ Alterar Modo / Fonte
                  </button>
                  {/* Botão de Chat no Header de Baixo */}
                  <button
                    type="button"
                    onClick={handleToggleSidebar}
                    style={isSidebarOpen ? styles.controlBtnActiveChat : styles.controlBtn}
                  >
                    💬 Chat & Turma
                    {unreadCount > 0 && (
                      <span style={styles.unreadBadge}>{unreadCount}</span>
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
                      💬 Chat
                      {unreadCount > 0 && <span style={styles.tabBadge}>{unreadCount}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('students')}
                      style={sidebarTab === 'students' ? styles.tabBtnActive : styles.tabBtn}
                    >
                      👥 Alunos ({studentsOnly.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('files')}
                      style={sidebarTab === 'files' ? styles.tabBtnActive : styles.tabBtn}
                    >
                      📁 Arquivos ({uploadedFiles.length})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    style={styles.closeSidebarBtn}
                    title="Recolher Painel"
                  >
                    ✕
                  </button>
                </div>

                {/* Aba 1: Chat da Aula com Identificação e Chat Privado */}
                {sidebarTab === 'chat' && (
                  <div style={styles.chatTabContent}>
                    <div style={styles.messagesList}>
                      {messages.length === 0 ? (
                        <div style={styles.emptyMessagesBox}>
                          <p style={styles.emptyText}>Nenhuma mensagem no chat até o momento.</p>
                        </div>
                      ) : (
                        messages.map((m: any, idx: number) => {
                          const isStudent = m.role === 'aluno' || m.sender_role === 'aluno';
                          const displayName = m.name || m.sender_name || 'Participante';
                          const matricula = m.student_id ? `(${m.student_id})` : '';
                          const isPrivate = !!m.is_private;

                          return (
                            <div
                              key={m.message_id || idx}
                              style={{
                                ...styles.messageCard,
                                ...(isPrivate ? styles.privateMessageCard : {}),
                              }}
                            >
                              <div style={styles.messageHeaderRow}>
                                <span style={styles.senderName}>
                                  {displayName} {matricula && <span style={styles.matriculaText}>{matricula}</span>}
                                  <small style={styles.roleTag}> [{isStudent ? 'aluno' : 'professor'}]</small>
                                </span>
                                {isPrivate && <span style={styles.privateTag}>🔒 PRIVADO</span>}
                              </div>
                              <p style={styles.messageBody}>{m.content}</p>

                              {/* Ação rápida para responder privado ao aluno */}
                              {isStudent && isPrivate && (
                                <button
                                  type="button"
                                  onClick={() => setTargetStudent({ id: m.participant_id, name: displayName, student_id: m.student_id })}
                                  style={styles.replyPrivateBtn}
                                >
                                  ↩ Responder em Privado
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form onSubmit={handleSendChat} style={styles.chatForm}>
                      {/* Destinatário (Público ou Privado para Aluno Específico) */}
                      {targetStudent ? (
                        <div style={styles.targetIndicatorBox}>
                          <span style={styles.targetIndicatorText}>
                            🔒 Privado para: <strong>{targetStudent.name}</strong> {targetStudent.student_id && `(${targetStudent.student_id})`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTargetStudent(null)}
                            style={styles.clearTargetBtn}
                            title="Voltar para Chat Público"
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      ) : (
                        <div style={styles.publicIndicatorText}>
                          🌐 Enviando para: <strong>Todos os Alunos (Público)</strong>
                        </div>
                      )}

                      <div style={styles.chatInputRow}>
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={targetStudent ? `Mensagem privada para ${targetStudent.name}...` : 'Mensagem para a turma...'}
                          style={styles.chatInput}
                        />
                        <button type="submit" style={styles.sendBtn}>Enviar</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Aba 2: Lista de Alunos Conectados com Nome e Matrícula */}
                {sidebarTab === 'students' && (
                  <div style={styles.studentsTabContent}>
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
                        studentsOnly.map((s: any) => (
                          <div key={s.participant_id} style={styles.studentCard}>
                            <div style={styles.studentAvatar}>🎓</div>
                            <div style={styles.studentInfoBox}>
                              <span style={styles.studentNameText}>{s.name}</span>
                              <span style={styles.studentMatriculaText}>
                                Matrícula: <strong>{s.student_id || 'Não informada'}</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetStudent({ id: s.participant_id, name: s.name, student_id: s.student_id });
                                setSidebarTab('chat');
                              }}
                              style={styles.startPrivateChatBtn}
                              title="Enviar Mensagem Privada"
                            >
                              🔒 Privado
                            </button>
                          </div>
                        ))
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
                        {isUploading ? 'Enviando Arquivo...' : '📎 Compartilhar Novo Arquivo'}
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
                            <span style={styles.fileIcon}>📄</span>
                            <div style={styles.fileInfoColumn}>
                              <span style={styles.fileItemName} title={file.name}>{file.name}</span>
                              <span style={styles.fileItemSize}>{formatFileSize(file.size)}</span>
                            </div>
                            <span style={styles.fileSharedBadge}>✓ Enviado</span>
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
    padding: '12px 24px',
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
    width: '34px',
    height: '34px',
    objectFit: 'contain',
  },
  title: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  roomLinkText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#38bdf8',
    cursor: 'pointer',
    marginTop: '2px',
    marginBottom: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  subtitle: {
    fontSize: '11px',
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
    color: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
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
    bottom: '8px',
    right: '12px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '500',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(51, 65, 85, 0.6)',
    backdropFilter: 'blur(4px)',
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
};
