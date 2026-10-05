import React, { useState } from 'react';
import { createRoom } from '../services/room';
import mlabLogo from '../assets/MLAB-logo.png';
import {
  Button,
  TextInput,
  StatusBadge,
  Alert,
  Card,
  Copy,
  Checkmark,
  Play,
  Exit,
  colors,
  typography,
} from '@mlab/ui';

interface DashboardProps {
  onEnterRoom: (roomData: { id: string; slug: string; link: string }) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onEnterRoom, onLogout }) => {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<{ id: string; slug: string; link: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return;

    setLoading(true);
    try {
      const resp = await createRoom(title);
      setLoading(false);
      const roomId = resp.room_id || (resp as any).id;
      const roomLink = resp.link || (resp as any).join_url;
      const roomData = {
        id: roomId,
        slug: resp.slug,
        link: roomLink,
      };
      setCurrentRoom(roomData);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Erro ao criar sala.');
    }
  };

  const handleCopyLink = async () => {
    if (!currentRoom?.link) return;
    try {
      if (window.electronAPI && typeof window.electronAPI.copyToClipboard === 'function') {
        await window.electronAPI.copyToClipboard(currentRoom.link);
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentRoom.link);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = currentRoom.link;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  };

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
        <Card
          title="Criar Nova Sala de Aula"
          subtitle="Inicie uma transmissão para sua turma de alunos"
          style={{ width: '100%', maxWidth: '520px' }}
        >
          {error && (
            <div style={{ marginBottom: '20px' }}>
              <Alert variant="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          {!currentRoom ? (
            <form onSubmit={handleCreateRoom} style={styles.form}>
              <TextInput
                id="roomTitle"
                label="Titulo / Disciplina"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Algoritmos - Turma 04"
                required
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                icon={<Play size={18} />}
              >
                {loading ? 'Criando Sala...' : 'Criar Sala e Gerar Link'}
              </Button>
            </form>
          ) : (
            <div style={styles.roomActiveBox}>
              <div>
                <StatusBadge
                  status="waiting"
                  label="Estado: Waiting (Aguardando inicio)"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', color: colors.textSecondary, fontFamily: typography.fontFamily }}>
                  Link de Acesso dos Alunos:
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <TextInput
                    readOnly
                    value={currentRoom.link}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleCopyLink}
                    icon={copied ? <Checkmark size={16} /> : <Copy size={16} />}
                  >
                    {copied ? 'Copiado!' : 'Copiar Link'}
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="success"
                size="lg"
                fullWidth
                onClick={() => onEnterRoom(currentRoom)}
                icon={<Play size={20} />}
                style={{ marginTop: '12px' }}
              >
                Abrir Sala de Transmissão
              </Button>
            </div>
          )}
        </Card>
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
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 32px',
    borderBottom: `1px solid ${colors.surfaceCardSolid}`,
    backgroundColor: colors.surfaceCardSolid,
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
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
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  roomActiveBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
};
