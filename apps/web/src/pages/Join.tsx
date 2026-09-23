import React, { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { joinRoom } from '../services/api';

interface JoinProps {
  onJoined: (token: string, roomInfo: any) => void;
}

export const Join: React.FC<JoinProps> = ({ onJoined }) => {
  const { roomName, professorName, slug } = useParams<{ roomName?: string; professorName?: string; slug?: string }>();
  const effectiveSlug = roomName && professorName ? `${roomName}/${professorName}` : (slug || '');
  const displayTitle = roomName && professorName
    ? `${roomName.replace(/-/g, ' ')} (Prof. ${professorName.replace(/-/g, ' ')})`
    : (slug || '');

  const location = useLocation();
  const closedMessage = (location.state as any)?.closedMessage;
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // RF-11: Nome Completo e Matrícula obrigatórios
    if (!name.trim() || !studentId.trim()) {
      setError('Por favor, informe seu Nome Completo e sua Matrícula.');
      return;
    }

    if (!effectiveSlug) {
      setError('Identificador de sala inválido.');
      return;
    }

    setLoading(true);
    try {
      const resp = await joinRoom(effectiveSlug, {
        name: name.trim(),
        student_id: studentId.trim(),
      });
      setLoading(false);
      onJoined(resp.token, {
        room_id: resp.room_id,
        ws_url: resp.ws_url,
        ice_servers: resp.ice_servers,
      });
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Erro ao tentar ingressar na aula.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src="/MLAB-logo.png" alt="MLab Logo" style={styles.logoImg} />
          <h1 style={styles.title}>MLab</h1>
          <p style={styles.subtitle}>Entrada na Aula — Sala: <strong style={{ color: '#38bdf8' }}>{displayTitle}</strong></p>
        </div>

        {closedMessage && <div style={styles.infoAlert}>{closedMessage}</div>}
        {error && <div style={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="studentName" style={styles.label}>Nome Completo</label>
            <input
              id="studentName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="studentId" style={styles.label}>Matrícula / Registro Acadêmico</label>
            <input
              id="studentId"
              type="text"
              value={studentId}
              maxLength={15}
              onChange={(e) => setStudentId(e.target.value.toUpperCase().slice(0, 15))}
              placeholder="Ex: 2025116TADS0000"
              style={{ ...styles.input, textTransform: 'uppercase' }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Entrando na Sala...' : 'Assistir à Aula ao Vivo'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '36px 32px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoImg: {
    width: '96px',
    height: '96px',
    objectFit: 'contain',
    marginBottom: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  infoAlert: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    border: '1px solid #0284c7',
    color: '#7dd3fc',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '20px',
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
    fontWeight: '500',
    color: '#cbd5e1',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    marginTop: '8px',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
