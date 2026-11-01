import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import * as roomService from '../services/room';

vi.mock('../services/room', () => ({
  createRoom: vi.fn(),
}));

describe('Dashboard Component', () => {
  it('deve renderizar o formulario de criacao de sala com campo focado automaticamente', () => {
    render(<Dashboard onEnterRoom={vi.fn()} onLogout={vi.fn()} />);
    const input = screen.getByLabelText(/Titulo \/ Disciplina/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('deve permitir abrir a sala pressionando Enter quando a sala for criada', async () => {
    const handleEnterRoom = vi.fn();
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-enter',
      slug: 'turma-enter/professor',
      link: 'http://mlab-professor.local:5173',
      mdns_link: 'http://mlab-professor.local:5173',
      ip_link: 'http://192.168.1.50:5173',
      status: 'waiting',
    });

    render(<Dashboard onEnterRoom={handleEnterRoom} onLogout={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Titulo \/ Disciplina/i), {
      target: { value: 'Turma Enter' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Estado: Waiting/i)).toBeInTheDocument();
    });

    // Pressiona Enter globalmente
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(handleEnterRoom).toHaveBeenCalledWith(expect.objectContaining({
      id: 'room-enter',
    }));
  });

  it('deve criar a sala e exibir o link unico com atalho para copiar', async () => {
    const handleEnterRoom = vi.fn();
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-123',
      slug: 'algoritmos-i/professor',
      link: 'http://mlab-professor.local:5173',
      mdns_link: 'http://mlab-professor.local:5173',
      ip_link: 'http://192.168.1.50:5173',
      status: 'waiting',
    });

    render(<Dashboard onEnterRoom={handleEnterRoom} onLogout={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Titulo \/ Disciplina/i), {
      target: { value: 'Algoritmos I' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith('Algoritmos I');
      expect(screen.getByText(/Estado: Waiting/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar Link Fixo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar Link Direto IP/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://mlab-professor.local:5173')).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://192.168.1.50:5173')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Copiar Link Fixo/i }));
    await waitFor(() => {
      expect(screen.getByTitle(/Link Fixo Copiado/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Abrir Sala de Transmissão/i }));
    expect(handleEnterRoom).toHaveBeenCalledWith(expect.objectContaining({
      id: 'room-123',
      slug: 'algoritmos-i/professor',
      link: 'http://mlab-professor.local:5173',
      mdnsLink: 'http://mlab-professor.local:5173',
      ipLink: 'http://192.168.1.50:5173',
    }));
  });

  it('deve exibir o badge de Rede Local (LAN) e Link Direto IP', async () => {
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-lan-1',
      slug: 'redes-locais/professor',
      link: 'http://192.168.1.50:5173',
      mdns_link: 'http://mlab-professor.local:5173',
      ip_link: 'http://192.168.1.50:5173',
      status: 'waiting',
    });

    render(<Dashboard onEnterRoom={vi.fn()} onLogout={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Titulo \/ Disciplina/i), {
      target: { value: 'Redes Locais' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }));

    await waitFor(() => {
      expect(screen.getByText('Rede Local (LAN)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar Link Direto IP/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://192.168.1.50:5173')).toBeInTheDocument();
    });
  });
});
