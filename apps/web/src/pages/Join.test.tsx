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
    expect(screen.getByLabelText(/Matrícula/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /algoritmos turma 04/i })).toBeInTheDocument();
    expect(screen.getByText(/com Prof\. professor carlos/i)).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: '2025116TADS0000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Entrar na aula/i }));

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
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: '2025116TADS0000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Entrar na aula/i }));

    await waitFor(() => {
      expect(apiService.joinRoom).toHaveBeenCalledWith('charlie-delta-7342', {
        name: 'Carlos Silva',
        student_id: '2025116TADS0000',
      });
      expect(handleJoined).toHaveBeenCalled();
    });
  });

  // 046/RF-4601, RF-4603: exatamente 7 números, 4 letras e 4 números.
  it.each([
    ['2024091812', 'apenas números, sem sigla do curso'],
    ['2025116TADS0', '1 número final (issue #134)'],
    ['202511TADS0000', '6 números iniciais'],
    ['2025116ADS0000', '3 letras'],
    ['2025116TADS00000', '5 números finais'],
  ])('deve exibir mensagem de erro e bloquear envio com matricula invalida %s (%s)', async (matricula) => {
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
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: matricula },
    });

    fireEvent.click(screen.getByRole('button', { name: /Entrar na aula/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Matrícula inválida. Use 7 números, 4 letras da sigla do curso e 4 números (ex.: 2025116TADS0000).'
        )
      ).toBeInTheDocument();
      expect(apiService.joinRoom).not.toHaveBeenCalled();
      expect(handleJoined).not.toHaveBeenCalled();
    });
  });

  it('deve enviar a matricula em maiusculas quando digitada em minusculas (046/RF-4602)', async () => {
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
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: ' 2025116tads0000 ' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Entrar na aula/i }));

    await waitFor(() => {
      expect(apiService.joinRoom).toHaveBeenCalledWith('charlie-delta-7342', {
        name: 'Carlos Silva',
        student_id: '2025116TADS0000',
      });
      expect(handleJoined).toHaveBeenCalled();
    });
  });

  it('deve exibir o aviso do 409 quando a matricula ja esta conectada na transmissao (027)', async () => {
    const handleJoined = vi.fn();
    (apiService.joinRoom as any).mockRejectedValueOnce(new Error('Esta matrícula já está conectada nesta transmissão.'));

    render(
      <MemoryRouter initialEntries={['/algoritmos-turma-04/professor-carlos/entrar']}>
        <Routes>
          <Route path="/:roomName/:professorName/entrar" element={<Join onJoined={handleJoined} />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Outro Aluno' } });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), {
      target: { value: '2025116TADS0001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Entrar na aula/i }));

    await waitFor(() => {
      expect(screen.getByText('Esta matrícula já está conectada nesta transmissão.')).toBeInTheDocument();
    });
    expect(handleJoined).not.toHaveBeenCalled();
  });
});
