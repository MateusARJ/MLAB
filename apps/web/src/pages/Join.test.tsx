import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Join } from './Join';
import * as apiService from '../services/api';

vi.mock('../services/api', () => ({
  joinRoom: vi.fn(),
}));

describe('Join Component (Web)', () => {
  it('deve renderizar os campos Nome Completo e Matricula', () => {
    render(
      <MemoryRouter initialEntries={['/sala/charlie-delta-7342/entrar']}>
        <Routes>
          <Route path="/sala/:slug/entrar" element={<Join onJoined={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Matrícula \/ Registro Acadêmico/i)).toBeInTheDocument();
  });

  it('deve submeter o formulario com sucesso e acionar onJoined', async () => {
    const handleJoined = vi.fn();
    (apiService.joinRoom as any).mockResolvedValueOnce({
      token: 'student-jwt-token',
      room_id: 'room-101',
      ws_url: 'ws://localhost:8080/ws/rooms/room-101/signal',
      ice_servers: [],
    });

    render(
      <MemoryRouter initialEntries={['/sala/charlie-delta-7342/entrar']}>
        <Routes>
          <Route path="/sala/:slug/entrar" element={<Join onJoined={handleJoined} />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Carlos Silva' },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula \/ Registro Acadêmico/i), {
      target: { value: '2024091812' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Assistir à Aula ao Vivo/i }));

    await waitFor(() => {
      expect(apiService.joinRoom).toHaveBeenCalledWith('charlie-delta-7342', {
        name: 'Carlos Silva',
        student_id: '2024091812',
      });
      expect(handleJoined).toHaveBeenCalled();
    });
  });
});
