import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import * as roomService from '../services/room';

vi.mock('../services/room', () => ({
  createRoom: vi.fn(),
}));

describe('Dashboard Component', () => {
  it('deve renderizar o formulario de criacao de sala', () => {
    render(<Dashboard onEnterRoom={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByLabelText(/Titulo \/ Disciplina/i)).toBeInTheDocument();
  });

  it('deve criar a sala e exibir o link unico com atalho para copiar', async () => {
    const handleEnterRoom = vi.fn();
    (roomService.createRoom as any).mockResolvedValueOnce({
      room_id: 'room-123',
      slug: 'charlie-delta-7342',
      link: 'http://localhost:3000/sala/charlie-delta-7342/entrar',
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
      expect(screen.getByRole('button', { name: /Copiar Link/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://localhost:3000/sala/charlie-delta-7342/entrar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Abrir Sala de Transmissão/i }));
    expect(handleEnterRoom).toHaveBeenCalledWith({
      id: 'room-123',
      slug: 'charlie-delta-7342',
      link: 'http://localhost:3000/sala/charlie-delta-7342/entrar',
    });
  });
});
