import React, { useState, useEffect, useCallback } from 'react';
import mlabLogo from '../assets/MLAB-logo.png';

interface PermissionsProps {
  onPermissionsGranted: () => void;
  onLogout: () => void;
}

type PermStatus = 'pending' | 'granted' | 'denied';

export const Permissions: React.FC<PermissionsProps> = ({
  onPermissionsGranted,
  onLogout,
}) => {
  const [micStatus, setMicStatus] = useState<PermStatus>('pending');
  const [screenStatus, setScreenStatus] = useState<PermStatus>('pending');
  const [requesting, setRequesting] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verificação passiva ao carregar o componente
  const checkInitialPermissions = useCallback(async () => {
    try {
      if (window.electronAPI?.checkMediaPermissions) {
        const perms = await window.electronAPI.checkMediaPermissions();
        if (perms.microphone === 'granted') {
          setMicStatus('granted');
        } else if (perms.microphone === 'denied' || perms.microphone === 'restricted') {
          setMicStatus('denied');
        }

        if (perms.screen === 'granted') {
          setScreenStatus('granted');
        } else if (perms.screen === 'denied' || perms.screen === 'restricted') {
          setScreenStatus('denied');
        }
      }

      // Consulta de suporte na API de permissões do navegador se disponível
      if (navigator.permissions && (navigator.permissions as any).query) {
        try {
          const micQuery = await (navigator.permissions as any).query({ name: 'microphone' });
          if (micQuery.state === 'granted') {
            setMicStatus('granted');
          } else if (micQuery.state === 'denied') {
            setMicStatus('denied');
          }
        } catch {
          // navegador não suporta query para microfone
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar permissões passivas:', err);
    }
  }, []);

  useEffect(() => {
    checkInitialPermissions();
  }, [checkInitialPermissions]);

  // Solicitação explícita ao Sistema Operacional
  const handleRequestPermissions = async () => {
    setRequesting(true);
    setErrorMsg(null);

    let micOk = false;
    let screenOk = false;

    // 1. Solicitação de Microfone no SO/Chromium
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      // Fecha o stream de teste imediatamente
      audioStream.getTracks().forEach((track) => track.stop());
      setMicStatus('granted');
      micOk = true;
    } catch (err: any) {
      console.warn('Permissão de microfone negada ou indisponível:', err);
      setMicStatus('denied');
      setErrorMsg('O acesso ao microfone foi recusado ou não há dispositivo disponível.');
    }

    // 2. Solicitação e Teste de Captura de Tela
    try {
      if (window.electronAPI?.getScreenSources) {
        const sources = await window.electronAPI.getScreenSources('screen');
        if (sources && sources.length > 0) {
          setScreenStatus('granted');
          screenOk = true;
        } else {
          // Se não retornou telas, tenta janela
          const winSources = await window.electronAPI.getScreenSources('window');
          if (winSources && winSources.length > 0) {
            setScreenStatus('granted');
            screenOk = true;
          } else {
            setScreenStatus('denied');
          }
        }
      } else {
        // Fallback caso executando no navegador padrão
        setScreenStatus('granted');
        screenOk = true;
      }
    } catch (err: any) {
      console.error('Erro ao testar permissão de tela:', err);
      setScreenStatus('denied');
      setErrorMsg((prev) => (prev ? `${prev} Além disso, a captura de tela foi bloqueada.` : 'A captura de tela foi bloqueada pelo SO.'));
    }

    setRequesting(false);

    if (!micOk || !screenOk) {
      setShowHelp(true);
    }
  };

  const isAllGranted = micStatus === 'granted' && screenStatus === 'granted';

  return (
    <div style={styles.container}>
      <header style={styles.topbar}>
        <div style={styles.logoBox}>
          <img src={mlabLogo} alt="MLab Logo" style={styles.logoImg} />
          <h2 style={styles.logo}>MLab</h2>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>
          Sair
        </button>
      </header>

      <main style={styles.content}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.shieldIcon}>🛡️</div>
            <h1 style={styles.title}>Permissões do Sistema Operacional</h1>
            <p style={styles.subtitle}>
              Para transmitir sua aula em tempo real e habilitar a gravação com alta fidelidade, o MLab necessita de autorização do seu computador para capturar a tela e o microfone.
            </p>
          </div>

          {errorMsg && (
            <div style={styles.alertBox}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Lista de Permissões */}
          <div style={styles.permList}>
            {/* Card Microfone */}
            <div
              style={{
                ...styles.permItem,
                borderColor:
                  micStatus === 'granted'
                    ? '#10b981'
                    : micStatus === 'denied'
                    ? '#ef4444'
                    : '#334155',
              }}
            >
              <div style={styles.permIconBox}>🎙️</div>
              <div style={styles.permInfo}>
                <div style={styles.permHeaderRow}>
                  <h3 style={styles.permTitle}>Acesso ao Microfone</h3>
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor:
                        micStatus === 'granted'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : micStatus === 'denied'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        micStatus === 'granted'
                          ? '#34d399'
                          : micStatus === 'denied'
                          ? '#f87171'
                          : '#fbbf24',
                    }}
                  >
                    {micStatus === 'granted'
                      ? '✓ Concedido'
                      : micStatus === 'denied'
                      ? '✕ Negado no SO'
                      : '⏳ Pendente'}
                  </span>
                </div>
                <p style={styles.permDesc}>
                  Permite aos alunos ouvirem sua explicação ao vivo e grava o áudio da aula com cancelamento de ruído e eco.
                </p>
              </div>
            </div>

            {/* Card Captura de Tela */}
            <div
              style={{
                ...styles.permItem,
                borderColor:
                  screenStatus === 'granted'
                    ? '#10b981'
                    : screenStatus === 'denied'
                    ? '#ef4444'
                    : '#334155',
              }}
            >
              <div style={styles.permIconBox}>🖥️</div>
              <div style={styles.permInfo}>
                <div style={styles.permHeaderRow}>
                  <h3 style={styles.permTitle}>Transmissão e Gravação de Tela</h3>
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor:
                        screenStatus === 'granted'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : screenStatus === 'denied'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        screenStatus === 'granted'
                          ? '#34d399'
                          : screenStatus === 'denied'
                          ? '#f87171'
                          : '#fbbf24',
                    }}
                  >
                    {screenStatus === 'granted'
                      ? '✓ Concedido'
                      : screenStatus === 'denied'
                      ? '✕ Negado no SO'
                      : '⏳ Pendente'}
                  </span>
                </div>
                <p style={styles.permDesc}>
                  Permite transmitir e gravar o monitor completo ou abas/janelas específicas de apresentações e códigos.
                </p>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div style={styles.actions}>
            {!isAllGranted ? (
              <button
                onClick={handleRequestPermissions}
                disabled={requesting}
                style={styles.requestBtn}
              >
                {requesting ? 'Solicitando ao Sistema...' : '🛡️ Conceder Permissões no Sistema'}
              </button>
            ) : (
              <button
                onClick={onPermissionsGranted}
                style={styles.continueBtn}
              >
                Continuar para o Painel de Salas →
              </button>
            )}

            <button
              onClick={() => setShowHelp(!showHelp)}
              style={styles.helpToggleBtn}
            >
              {showHelp ? 'Ocultar orientações do Windows' : '❓ Como habilitar permissões nas Configurações do Windows'}
            </button>
          </div>

          {/* Guia de Configurações do Sistema */}
          {showHelp && (
            <div style={styles.helpBox}>
              <h4 style={styles.helpTitle}>Como liberar o acesso no Windows:</h4>
              <ol style={styles.helpList}>
                <li>Abra as <strong>Configurações do Windows</strong> (atalho <code>Win + I</code>).</li>
                <li>Acesse <strong>Privacidade e Segurança</strong> → <strong>Microfone</strong>.</li>
                <li>Certifique-se de que <strong>"Acesso ao microfone"</strong> está <em>Ativado</em>.</li>
                <li>Ative a opção <strong>"Permitir que os aplicativos da área de trabalho acessem seu microfone"</strong>.</li>
                <li>Após ativar, retorne aqui e clique em <strong>"Conceder Permissões no Sistema"</strong>.</li>
              </ol>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#0f172a',
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImg: {
    width: '36px',
    height: '36px',
    objectFit: 'contain',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#38bdf8',
    margin: 0,
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  content: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    width: '100%',
    maxWidth: '680px',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '36px 32px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  shieldIcon: {
    fontSize: '44px',
    marginBottom: '10px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: '1.6',
  },
  alertBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#fca5a5',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '20px',
  },
  permList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '28px',
  },
  permItem: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #334155',
    transition: 'border-color 0.2s',
  },
  permIconBox: {
    fontSize: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    flexShrink: 0,
  },
  permInfo: {
    flex: 1,
  },
  permHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  permTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#f8fafc',
    margin: 0,
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '600',
  },
  permDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.4',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  requestBtn: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    padding: '14px 20px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  continueBtn: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    padding: '14px 20px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  helpToggleBtn: {
    background: 'none',
    border: 'none',
    color: '#38bdf8',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '6px',
    textAlign: 'center',
  },
  helpBox: {
    marginTop: '16px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '13px',
    color: '#cbd5e1',
  },
  helpTitle: {
    margin: '0 0 10px 0',
    color: '#38bdf8',
    fontSize: '14px',
    fontWeight: '600',
  },
  helpList: {
    margin: 0,
    paddingLeft: '20px',
    lineHeight: '1.7',
  },
};
