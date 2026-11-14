import React, { useState } from 'react';
import { startProfessorSession } from '../services/auth';
import { Button, TextInput, Alert, BrandMark, ThemeToggle, colors, typography } from '@mlab/ui';
import { AppInfoFooter } from '../components/AppInfoFooter';

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
      <header style={styles.top}>
        <span className="ml-brand">
          <BrandMark size={32} />
          <span>MLab</span>
        </span>
        <ThemeToggle />
      </header>

      <main style={styles.main}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div>
            <h1 style={styles.title}>Como a turma vai ver seu nome?</h1>
            <p style={styles.subtitle}>Ele aparece no chat e na tela de entrada dos alunos.</p>
          </div>

          {error && <Alert variant="error" message={error} onClose={() => setError(null)} />}

          <TextInput
            id="professorName"
            label="Seu nome"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Prof. Carlos Eduardo"
            autoComplete="name"
            autoFocus
            required
          />

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {loading ? 'Acessando...' : 'Continuar'}
          </Button>
        </form>
      </main>

      <AppInfoFooter />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
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
    padding: '16px 24px',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  form: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  title: {
    fontSize: 'var(--fs-display)',
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: colors.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: 'var(--fs-body)',
    lineHeight: 1.55,
    color: colors.textSecondary,
    margin: '8px 0 0',
  },
};
