import React, { useState } from 'react';
import { createRoom } from '../services/room';
import mlabLogo from '../assets/MLAB-logo.png';

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
        <button onClick={onLogout} style={styles.logoutBtn}>Sair</button>
      </header>

      <main style={styles.content}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Criar Nova Sala de Aula</h3>
          <p style={styles.cardSubtitle}>Inicie uma transmissao para sua turma de alunos</p>

          {error && <div style={styles.errorAlert}>{error}</div>}

          {!currentRoom ? (
            <form onSubmit={handleCreateRoom} style={styles.form}>
              <div style={styles.inputGroup}>
                <label htmlFor="roomTitle" style={styles.label}>Titulo / Disciplina</label>
                <input
                  id="roomTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Algoritmos - Turma 04"
                  style={styles.input}
                  required
                />
              </div>
              <button type="submit" disabled={loading} style={styles.createBtn}>
                {loading ? 'Criando Sala...' : 'Criar Sala e Gerar Link'}
              </button>
            </form>
          ) : (
            <div style={styles.roomActiveBox}>
              <div style={styles.statusBadge}>
                <span style={styles.statusDot}></span> Estado: Waiting (Aguardando inicio)
              </div>
              <p style={styles.infoLabel}>Link de Acesso dos Alunos:</p>
              <div style={styles.linkBox}>
                <input type="text" readOnly value={currentRoom.link} style={styles.linkInput} />
                <button onClick={handleCopyLink} style={styles.copyBtn}>
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </button>
              </div>

              <button
                onClick={() => onEnterRoom(currentRoom)}
                style={styles.startTransBtn}
              >
                Abrir Sala de Transmissão
              </button>
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
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 32px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#1e293b',
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
    color: '#38bdf8',
    margin: 0,
  },
  logoutBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid #475569',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
  },
  content: {
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '32px',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '6px',
    color: '#f8fafc',
  },
  cardSubtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '24px',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#fca5a5',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    color: '#cbd5e1',
  },
  input: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
  },
  createBtn: {
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  roomActiveBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '20px',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    border: '1px solid #eab308',
    color: '#fde047',
    fontSize: '13px',
    width: 'fit-content',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#eab308',
  },
  infoLabel: {
    fontSize: '13px',
    color: '#cbd5e1',
  },
  linkBox: {
    display: 'flex',
    gap: '10px',
  },
  linkInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '13px',
  },
  copyBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #38bdf8',
    backgroundColor: 'transparent',
    color: '#38bdf8',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
  startTransBtn: {
    marginTop: '12px',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#16a34a',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
