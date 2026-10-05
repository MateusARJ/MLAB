import React, { useState, useEffect, useCallback } from 'react';
import mlabLogo from '../assets/MLAB-logo.png';
import {
  Button,
  StatusBadge,
  Alert,
  Security,
  Microphone,
  Screen,
  Checkmark,
  Close,
  Renew,
  Exit,
  Idea,
  colors,
  radii,
  typography,
} from '@mlab/ui';

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
        <Button
          variant="danger-ghost"
          size="sm"
          icon={<Exit size={16} />}
          onClick={onLogout}
        >
          Sair
        </Button>
      </header>

      <main style={styles.content}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.shieldIcon}>
              <Security size={44} style={{ color: colors.accent }} />
            </div>
            <h1 style={styles.title}>Permissões do Sistema Operacional</h1>
            <p style={styles.subtitle}>
              Para transmitir sua aula em tempo real e habilitar a gravação com alta fidelidade, o MLab necessita de autorização do seu computador para capturar a tela e o microfone.
            </p>
          </div>

          {errorMsg && (
            <div style={{ marginBottom: '20px' }}>
              <Alert variant="error" message={errorMsg} onClose={() => setErrorMsg(null)} />
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
                    ? colors.success
                    : micStatus === 'denied'
                    ? colors.danger
                    : colors.borderStrong,
              }}
            >
              <div style={styles.permIconBox}>
                <Microphone size={24} style={{ color: colors.accent }} />
              </div>
              <div style={styles.permInfo}>
                <div style={styles.permHeaderRow}>
                  <h3 style={styles.permTitle}>Acesso ao Microfone</h3>
                  <StatusBadge
                    status={micStatus === 'granted' ? 'live' : micStatus === 'denied' ? 'error' : 'waiting'}
                    label={micStatus === 'granted' ? 'Concedido' : micStatus === 'denied' ? 'Negado no SO' : 'Pendente'}
                    icon={micStatus === 'granted' ? <Checkmark size={14} /> : micStatus === 'denied' ? <Close size={14} /> : <Renew size={14} />}
                  />
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
                    ? colors.success
                    : screenStatus === 'denied'
                    ? colors.danger
                    : colors.borderStrong,
              }}
            >
              <div style={styles.permIconBox}>
                <Screen size={24} style={{ color: colors.accent }} />
              </div>
              <div style={styles.permInfo}>
                <div style={styles.permHeaderRow}>
                  <h3 style={styles.permTitle}>Transmissão e Gravação de Tela</h3>
                  <StatusBadge
                    status={screenStatus === 'granted' ? 'live' : screenStatus === 'denied' ? 'error' : 'waiting'}
                    label={screenStatus === 'granted' ? 'Concedido' : screenStatus === 'denied' ? 'Negado no SO' : 'Pendente'}
                    icon={screenStatus === 'granted' ? <Checkmark size={14} /> : screenStatus === 'denied' ? <Close size={14} /> : <Renew size={14} />}
                  />
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
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleRequestPermissions}
                loading={requesting}
                icon={<Security size={18} />}
              >
                {requesting ? 'Solicitando ao Sistema...' : 'Conceder Permissões no Sistema'}
              </Button>
            ) : (
              <Button
                variant="success"
                size="lg"
                fullWidth
                onClick={onPermissionsGranted}
              >
                Continuar para o Painel de Salas →
              </Button>
            )}

            <button
              onClick={() => setShowHelp(!showHelp)}
              style={styles.helpToggleBtn}
            >
              {showHelp ? (
                'Ocultar orientações do Windows'
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Idea size={16} />
                  <span>Como habilitar permissões nas Configurações do Windows</span>
                </span>
              )}
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
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    borderBottom: `1px solid ${colors.surfaceCardSolid}`,
    backgroundColor: colors.bgBase,
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImg: {
    width: '46px',
    height: '46px',
    objectFit: 'contain',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: colors.accent,
    margin: 0,
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
    backgroundColor: colors.surfaceCard,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radii.lg,
    padding: '36px 32px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  shieldIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '10px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: '10px',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: colors.textMuted,
    lineHeight: '1.6',
    margin: 0,
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
    backgroundColor: colors.bgBase,
    borderRadius: '12px',
    border: `1px solid ${colors.borderStrong}`,
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  permIconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    backgroundColor: colors.surfaceCardSolid,
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
    color: colors.textPrimary,
    margin: 0,
  },
  permDesc: {
    fontSize: '13px',
    color: colors.textMuted,
    margin: 0,
    lineHeight: '1.4',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  helpToggleBtn: {
    background: 'none',
    border: 'none',
    color: colors.accent,
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '6px',
    textAlign: 'center',
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpBox: {
    marginTop: '16px',
    backgroundColor: colors.bgBase,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: radii.md,
    padding: '16px',
    fontSize: '13px',
    color: colors.textSecondary,
  },
  helpTitle: {
    margin: '0 0 10px 0',
    color: colors.accent,
    fontSize: '14px',
    fontWeight: '600',
  },
  helpList: {
    margin: 0,
    paddingLeft: '20px',
    lineHeight: '1.7',
  },
};
