import React, { useState } from 'react';
import { startProfessorSession } from '../services/auth';
import mlabLogo from '../assets/MLAB-logo.png';
import { Button, TextInput, Alert, colors, radii, typography } from '@mlab/ui';

interface ProfessorEntryProps {
  onSuccess: () => void;
}

export const ProfessorEntry: React.FC<ProfessorEntryProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Por favor, informe seu Nome Completo para prosseguir.');
      return;
    }

    setLoading(true);
    try {
      await startProfessorSession(trimmed);
      setLoading(false);
      onSuccess();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Erro ao iniciar sessão do professor.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src={mlabLogo} alt="MLab Logo" style={styles.logoImg} />
          <h1 style={styles.title}>MLab</h1>
          <p style={styles.subtitle}>Painel do Professor — Identificação</p>
        </div>

        {error && (
          <div style={{ marginBottom: '20px' }}>
            <Alert variant="error" message={error} onClose={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <TextInput
            id="professorName"
            label="Nome do Professor"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Prof. Carlos Eduardo"
            autoFocus
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Acessando...' : 'Ir para Criação da Turma'}
          </Button>
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
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
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
  logoImg: {
    width: '96px',
    height: '96px',
    objectFit: 'contain',
    marginBottom: '12px',
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
