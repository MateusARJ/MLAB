import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Join } from './Join';
import * as apiService from '../services/api';

vi.mock('../services/api', () => ({
  joinRoom: vi.fn(),
  getRoomInfo: vi.fn().mockResolvedValue(null),
}));

describe('Join Component (Web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('deve renderizar os campos Nome Completo e Matricula com novo padrao de rota', () => {
    render(
      <MemoryRouter initialEntries={['/algoritmos-turma-04/professor-carlos/entrar']}>
        <Routes>
          <Route path="/:roomName/:professorName/entrar" element={<Join onJoined={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Matrícula \/ Registro Acadêmico/i)).toBeInTheDocument();
    expect(screen.getByText(/algoritmos turma 04 \(Prof\. professor carlos\)/i)).toBeInTheDocument();
  });

  it('deve submeter o formulario com sucesso com rota /:roomName/:professorName/entrar e acionar onJoined', async () => {
    const handleJoined = vi.fn();
    (apiService.joinRoom as any).mockResolvedValueOnce({
      token: 'student-jwt-token',
      room_id: 'room-101',
      ws_url: 'ws://localhost:8080/ws/rooms/room-101/signal',
      ice_servers: [],
    });

    render(
      <MemoryRouter initialEntries={['/algoritmos-turma-04/professor-carlos/entrar']}>
        <Routes>
          <Route path="/:roomName/:professorName/entrar" element={<Join onJoined={handleJoined} />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Carlos Silva' },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula \/ Registro Acadêmico/i), {
      target: { value: '2025116TADS0000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Assistir à Aula ao Vivo/i }));

    await waitFor(() => {
      expect(apiService.joinRoom).toHaveBeenCalledWith('algoritmos-turma-04/professor-carlos', {
        name: 'Carlos Silva',
        student_id: '2025116TADS0000',
      });
      expect(handleJoined).toHaveBeenCalled();
    });
  });

  it('deve manter compatibilidade com rota legado /sala/:slug/entrar', async () => {
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
      target: { value: '2025116TADS0000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Assistir à Aula ao Vivo/i }));

    await waitFor(() => {
      expect(apiService.joinRoom).toHaveBeenCalledWith('charlie-delta-7342', {
        name: 'Carlos Silva',
        student_id: '2025116TADS0000',
      });
      expect(handleJoined).toHaveBeenCalled();
    });
  });

  it('deve exibir mensagem de erro e bloquear envio com formato de matricula invalido', async () => {
    const handleJoined = vi.fn();

    render(
      <MemoryRouter initialEntries={['/algoritmos-turma-04/professor-carlos/entrar']}>
        <Routes>
          <Route path="/:roomName/:professorName/entrar" element={<Join onJoined={handleJoined} />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Carlos Silva' },
    });
    fireEvent.change(screen.getByLabelText(/Matrícula \/ Registro Acadêmico/i), {
      target: { value: '2024091812' }, // apenas números, sem sigla do curso
    });

    fireEvent.click(screen.getByRole('button', { name: /Assistir à Aula ao Vivo/i }));

    await waitFor(() => {
      expect(screen.getByText(/Matrícula inválida/i)).toBeInTheDocument();
      expect(apiService.joinRoom).not.toHaveBeenCalled();
      expect(handleJoined).not.toHaveBeenCalled();
    });
  });
});
