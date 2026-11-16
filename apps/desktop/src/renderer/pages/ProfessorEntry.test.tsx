import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfessorEntry } from './ProfessorEntry';
import * as authService from '../services/auth';

vi.mock('../services/auth', () => ({
  startProfessorSession: vi.fn(),
}));

describe('ProfessorEntry Component (Desktop)', () => {
  const handleSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar a tela com logo, titulo e campo de Nome do Professor', () => {
    render(<ProfessorEntry onSuccess={handleSuccess} />);

    expect(screen.getByText('MLab')).toBeInTheDocument();
    expect(screen.getByText(/Painel do Professor — Identificação/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do Professor/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ir para Criação da Turma/i })).toBeInTheDocument();
  });

  it('deve exibir mensagem de erro ao submeter com o campo vazio', async () => {
    render(<ProfessorEntry onSuccess={handleSuccess} />);

    const form = screen.getByRole('button', { name: /Ir para Criação da Turma/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Por favor, informe seu Nome Completo para prosseguir/i)).toBeInTheDocument();
    });
    expect(authService.startProfessorSession).not.toHaveBeenCalled();
    expect(handleSuccess).not.toHaveBeenCalled();
  });

  it('deve chamar startProfessorSession e invocar onSuccess ao submeter nome valido', async () => {
    (authService.startProfessorSession as any).mockResolvedValueOnce({
      token: 'mock-jwt-token',
      name: 'Prof. Carlos Eduardo',
      expires_at: '2026-09-22T00:00:00Z',
    });

    render(<ProfessorEntry onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nome do Professor/i), {
      target: { value: 'Prof. Carlos Eduardo' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Ir para Criação da Turma/i }));

    await waitFor(() => {
      expect(authService.startProfessorSession).toHaveBeenCalledWith('Prof. Carlos Eduardo');
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('mostra a versão do MLab no rodapé, com acesso ao Sobre (021, RF-2101)', async () => {
    render(<ProfessorEntry onSuccess={handleSuccess} />);

    expect(await screen.findByText('MLab v9.8.7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sobre' })).toBeInTheDocument();
  });
});
