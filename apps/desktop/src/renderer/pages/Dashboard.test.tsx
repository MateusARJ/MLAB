import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import * as roomService from '../services/room';

vi.mock('../services/room', () => ({
  createRoom: vi.fn(),
  getRoomLink: vi.fn(),
}));

describe('Dashboard Component', () => {
  it('deve renderizar o formulario de criacao de sala com campo focado automaticamente', () => {
    render(<Dashboard onEnterRoom={vi.fn()} onLogout={vi.fn()} />);
    const input = screen.getByLabelText(/Nome da aula/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('deve permitir abrir a sala pressionando Enter quando a sala for criada', async () => {
    const handleEnterRoom = vi.fn();
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-enter',
      slug: 'turma-enter/professor',
      link: 'http://mlab.local:5173',
      mdns_link: 'http://mlab.local:5173',
      ip_link: 'http://192.168.1.50:5173',
      status: 'waiting',
    });

    render(<Dashboard onEnterRoom={handleEnterRoom} onLogout={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nome da aula/i), {
      target: { value: 'Turma Enter' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Aguardando início/i)).toBeInTheDocument();
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
      link: 'http://mlab.local:5173',
      mdns_link: 'http://mlab.local:5173',
      ip_link: 'http://192.168.1.50:5173',
      status: 'waiting',
    });

    render(<Dashboard onEnterRoom={handleEnterRoom} onLogout={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nome da aula/i), {
      target: { value: 'Algoritmos I' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith('Algoritmos I');
      expect(screen.getByText(/Aguardando início/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar Link Fixo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar Link Direto IP/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://mlab.local:5173')).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://192.168.1.50:5173')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Copiar Link Fixo/i }));
    await waitFor(() => {
      expect(screen.getByTitle(/Link Fixo Copiado/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    expect(handleEnterRoom).toHaveBeenCalledWith(expect.objectContaining({
      id: 'room-123',
      slug: 'algoritmos-i/professor',
      link: 'http://mlab.local:5173',
      mdnsLink: 'http://mlab.local:5173',
      ipLink: 'http://192.168.1.50:5173',
    }));
  });

  it('deve exibir o badge de Rede Local (LAN) e Link Direto IP', async () => {
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-lan-1',
      slug: 'redes-locais/professor',
      link: 'http://192.168.1.50:5173',
      mdns_link: 'http://mlab.local:5173',
      ip_link: 'http://192.168.1.50:5173',
      status: 'waiting',
    });

    render(<Dashboard onEnterRoom={vi.fn()} onLogout={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nome da aula/i), {
      target: { value: 'Redes Locais' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }));

    await waitFor(() => {
      expect(screen.getByText('Link pelo IP')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar Link Direto IP/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://192.168.1.50:5173')).toBeInTheDocument();
    });
  });

  it('deve esconder o Link Fixo quando o backend não anuncia nome mDNS (012, RF-127)', async () => {
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-sem-mdns',
      slug: 'turma/professor',
      link: 'http://192.168.1.50:5173',
      ip_link: 'http://192.168.1.50:5173',
      status: 'waiting',
    });

    render(<Dashboard onEnterRoom={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Nome da aula/i), { target: { value: 'Turma' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://192.168.1.50:5173')).toBeInTheDocument();
    });
    expect(screen.queryByText('Link direto')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copiar Link Fixo/i })).not.toBeInTheDocument();
  });

  it('deve mostrar e copiar o nome anunciado, e avisar quando ele muda (012, RF-127/RF-128)', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    (window as any).electronAPI = { ...(window as any).electronAPI, copyToClipboard: copy };
    const handleEnterRoom = vi.fn();
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-2',
      slug: 'turma/professor',
      link: 'http://mlab.local:8080',
      mdns_link: 'http://mlab.local:8080',
      ip_link: 'http://192.168.1.60:8080',
      status: 'waiting',
    });
    (roomService.getRoomLink as any).mockResolvedValueOnce({
      room_id: 'room-2',
      link: 'http://mlab-2.local:8080',
      mdns_link: 'http://mlab-2.local:8080',
      ip_link: 'http://192.168.1.60:8080',
    });

    render(<Dashboard onEnterRoom={handleEnterRoom} onLogout={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Nome da aula/i), { target: { value: 'Turma' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Sala e Gerar Link/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://mlab-2.local:8080')).toBeInTheDocument();
    });
    expect(roomService.getRoomLink).toHaveBeenCalledWith('room-2');
    expect(screen.getByText('O link fixo da sala mudou para http://mlab-2.local:8080. Reenvie aos alunos.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copiar Link Fixo/i }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith('http://mlab-2.local:8080'));

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    expect(handleEnterRoom).toHaveBeenCalledWith(expect.objectContaining({
      id: 'room-2',
      mdnsLink: 'http://mlab-2.local:8080',
    }));
  });

  it('mostra a versão do MLab no rodapé, com acesso ao Sobre (021, RF-2101)', async () => {
    render(<Dashboard onEnterRoom={vi.fn()} onLogout={vi.fn()} />);

    expect(await screen.findByText('MLab v9.8.7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sobre' })).toBeInTheDocument();
  });
});
