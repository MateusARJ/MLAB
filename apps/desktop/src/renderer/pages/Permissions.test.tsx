import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Permissions } from './Permissions';

describe('Permissions Component (Desktop)', () => {
  const handleGranted = vi.fn();
  const handleLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar a tela de permissões com cards de Microfone e Tela', async () => {
    render(<Permissions onPermissionsGranted={handleGranted} onLogout={handleLogout} />);

    await waitFor(() => {
      expect(screen.getByText(/Permissões do Sistema Operacional/i)).toBeInTheDocument();
      expect(screen.getByText('Acesso ao Microfone')).toBeInTheDocument();
      expect(screen.getByText('Transmissão e Gravação de Tela')).toBeInTheDocument();
    });
  });

  it('deve solicitar permissões no SO e permitir avançar após concessão', async () => {
    render(<Permissions onPermissionsGranted={handleGranted} onLogout={handleLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continuar para o Painel de Salas →/i })).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole('button', { name: /Continuar para o Painel de Salas →/i });
    fireEvent.click(continueBtn);
    expect(handleGranted).toHaveBeenCalledTimes(1);
  });

  it('deve alternar a exibição de ajuda das configurações do Windows', async () => {
    render(<Permissions onPermissionsGranted={handleGranted} onLogout={handleLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Como habilitar permissões nas Configurações do Windows/i })).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /Como habilitar permissões nas Configurações do Windows/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Como liberar o acesso no Windows:/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacidade e Segurança/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ocultar orientações do Windows/i }));
    expect(screen.queryByText(/Como liberar o acesso no Windows:/i)).not.toBeInTheDocument();
  });

  it('deve chamar onLogout ao clicar em Sair', async () => {
    render(<Permissions onPermissionsGranted={handleGranted} onLogout={handleLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    });

    const logoutBtn = screen.getByRole('button', { name: 'Sair' });
    fireEvent.click(logoutBtn);
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});
