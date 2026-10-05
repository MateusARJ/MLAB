import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { joinRoom, getRoomInfo } from '../services/api';
import { Button, TextInput, Alert, Play, colors, radii, typography } from '@mlab/ui';

interface JoinProps {
  onJoined: (token: string, roomInfo: any) => void;
}

export const Join: React.FC<JoinProps> = ({ onJoined }) => {
  const { roomName, professorName, slug } = useParams<{ roomName?: string; professorName?: string; slug?: string }>();
  const effectiveSlug = roomName && professorName ? `${roomName}/${professorName}` : (slug || '');
  const [roomDetails, setRoomDetails] = useState<{ title?: string; professor_name?: string } | null>(null);

  // Busca os dados da sala no backend para exibir o nome exato digitado pelo professor
  useEffect(() => {
    if (!effectiveSlug) return;
    getRoomInfo(effectiveSlug).then((data) => {
      if (data) {
        setRoomDetails(data);
      }
    });
  }, [effectiveSlug]);

  const cleanProfName = (rawName?: string) => {
    if (!rawName) return '';
    // Remove sufixo hexadecimal aleatório da sala descartável (ex: -e1d7, -4a9b)
    const withoutSuffix = rawName.replace(/-[0-9a-fA-F]{4}$/, '');
    return withoutSuffix
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const profDisplay = roomDetails?.professor_name
    ? roomDetails.professor_name
    : (professorName ? cleanProfName(professorName) : '');
  const roomTitleDisplay = roomDetails?.title
    ? roomDetails.title
    : (roomName ? roomName.replace(/-/g, ' ') : '');

  const displayTitle = profDisplay
    ? `${roomTitleDisplay || 'Aula'} (Prof. ${profDisplay})`
    : (effectiveSlug || '');

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
        professor_name: resp.professor_name || roomDetails?.professor_name || profDisplay,
        room_title: resp.room_title || roomDetails?.title || roomTitleDisplay,
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
          <p style={styles.subtitle}>
            Entrada na Aula — Sala: <strong style={{ color: colors.accent }}>{displayTitle}</strong>
          </p>
        </div>

        {closedMessage && (
          <div style={{ marginBottom: '20px' }}>
            <Alert variant="info" message={closedMessage} />
          </div>
        )}
        {error && (
          <div style={{ marginBottom: '20px' }}>
            <Alert variant="error" message={error} onClose={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <TextInput
            id="studentName"
            label="Nome Completo"
            type="text"
            inputMode="text"
            autoCapitalize="words"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Carlos Eduardo Silva"
            required
          />

          <TextInput
            id="studentId"
            label="Matrícula / Registro Acadêmico"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            value={studentId}
            maxLength={15}
            onChange={(e) => setStudentId(e.target.value.toUpperCase().slice(0, 15))}
            placeholder="Ex: 2025116TADS0000"
            style={{ textTransform: 'uppercase' }}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            icon={<Play size={18} />}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Entrando na Sala...' : 'Assistir à Aula ao Vivo'}
          </Button>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    padding: '16px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: colors.surfaceCard,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radii.lg,
    padding: '28px 20px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logoImg: {
    width: '76px',
    height: '76px',
    objectFit: 'contain',
    marginBottom: '10px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: colors.accent,
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: colors.textMuted,
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
};
