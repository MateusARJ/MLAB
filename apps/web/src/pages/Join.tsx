import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { joinRoom, getRoomInfo } from '../services/api';
import { Button, TextInput, Alert, BrandMark, ThemeToggle, colors, typography } from '@mlab/ui';

// Validação de matrícula: 7 números, 4 letras da sigla do curso e 4 números, ex.: 2025116TADS0000 (046/RF-4601).
// Igual à studentIDRegex do backend, que repete a validação.
const STUDENT_ID_REGEX = /^[0-9]{7}[A-Za-z]{4}[0-9]{4}$/;
const STUDENT_ID_ERROR =
  'Matrícula inválida. Use 7 números, 4 letras da sigla do curso e 4 números (ex.: 2025116TADS0000).';

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

    // A sigla pode ser digitada em minúsculas; a matrícula segue em maiúsculas (046/RF-4602).
    const normalizedStudentId = studentId.trim().toUpperCase();
    if (!STUDENT_ID_REGEX.test(normalizedStudentId)) {
      setError(STUDENT_ID_ERROR);
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
        student_id: normalizedStudentId,
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
      <header style={styles.top}>
        <span className="ml-brand">
          <BrandMark size={32} />
          <span>MLab</span>
        </span>
        <ThemeToggle />
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>{profDisplay ? (roomTitleDisplay || 'Aula') : displayTitle}</h1>
            {profDisplay && <p style={styles.subtitle}>com Prof. {profDisplay}</p>}
          </div>

          {closedMessage && (
            <div style={{ marginBottom: '24px' }}>
              <Alert variant="info" message={closedMessage} />
            </div>
          )}
          {error && (
            <div style={{ marginBottom: '24px' }}>
              <Alert variant="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <TextInput
              id="studentName"
              label="Nome completo"
              type="text"
              inputMode="text"
              autoCapitalize="words"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva"
              required
            />

            <TextInput
              id="studentId"
              label="Matrícula"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              value={studentId}
              maxLength={15}
              onChange={(e) => setStudentId(e.target.value.toUpperCase().slice(0, 15))}
              placeholder="Ex: 2025116TADS0000"
              helperText="7 números, 4 letras da sigla do curso e 4 números, como 2025116TADS0031."
              style={{ textTransform: 'uppercase', fontFamily: typography.fontMono }}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              >
              {loading ? 'Entrando...' : 'Entrar na aula'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    boxSizing: 'border-box',
  },
  top: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'calc(12px + var(--sat, 0px)) 20px 12px',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 20px 64px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    boxSizing: 'border-box',
  },
  header: {
    paddingBottom: '24px',
    marginBottom: '24px',
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  title: {
    fontSize: 'var(--fs-title)',
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: colors.textPrimary,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  subtitle: {
    fontSize: 'var(--fs-body)',
    color: colors.textSecondary,
    margin: '8px 0 0 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
};
