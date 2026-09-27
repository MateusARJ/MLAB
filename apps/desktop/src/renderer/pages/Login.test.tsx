import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Login } from './Login';
import * as authService from '../services/auth';

vi.mock('../services/auth', () => ({
  loginProfessor: vi.fn(),
}));

describe('Login Component', () => {
  it('deve renderizar os campos de e-mail e senha', () => {
    render(<Login onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/E-mail Institucional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha de Acesso/i)).toBeInTheDocument();
  });

  it('deve chamar loginProfessor e chamar onSuccess em credenciais validas', async () => {
    const handleSuccess = vi.fn();
    (authService.loginProfessor as any).mockResolvedValueOnce({
      token: 'jwt-dummy-token',
      expires_in: 28800,
    });

    render(<Login onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/E-mail Institucional/i), {
      target: { value: 'professor@instituicao.edu.br' },
    });
    fireEvent.change(screen.getByLabelText(/Senha de Acesso/i), {
      target: { value: 'senha123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Entrar no Sistema/i }));

    await waitFor(() => {
      expect(authService.loginProfessor).toHaveBeenCalledWith({
        email: 'professor@instituicao.edu.br',
        password: 'senha123',
      });
      expect(handleSuccess).toHaveBeenCalled();
    });
  });
});
