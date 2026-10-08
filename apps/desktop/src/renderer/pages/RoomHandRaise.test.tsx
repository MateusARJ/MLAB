import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Room } from './Room';
import * as publisherModule from '../hooks/useWebRTCPublisher';

describe('Room Component - Feature Levantar a Mão (Desktop)', () => {
  const dummyRoom = {
    id: 'room-hand-101',
    slug: 'charlie-delta-hand',
    link: 'http://localhost:3000/sala/charlie-delta-hand/entrar',
  };

  const mockLowerStudentHand = vi.fn();
  const mockDismissHandToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve exibir a fila de mãos levantadas na aba Alunos e permitir ao professor abaixar a mão', async () => {
    const mockParticipants = [
      {
        participant_id: 'part-aluno-1',
        name: 'Maria Silva',
        role: 'aluno',
        student_id: '20241TADS0001',
        hand_raised: true,
        hand_raised_at: '2026-10-07T10:00:00Z',
      },
      {
        participant_id: 'part-aluno-2',
        name: 'João Santos',
        role: 'aluno',
        student_id: '20241TADS0002',
        hand_raised: true,
        hand_raised_at: '2026-10-07T10:01:00Z',
      },
      {
        participant_id: 'part-aluno-3',
        name: 'Carlos Oliveira',
        role: 'aluno',
        student_id: '20241TADS0003',
        hand_raised: false,
      },
    ];

    vi.spyOn(publisherModule, 'useWebRTCPublisher').mockReturnValue({
      isPublishing: true,
      connectionState: 'connected',
      error: null,
      messages: [],
      participants: mockParticipants as any,
      lastHandRaised: null,
      dismissHandToast: mockDismissHandToast,
      lowerStudentHand: mockLowerStudentHand,
      sendChatMessage: vi.fn(),
      sendStreamPause: vi.fn(),
      startPublishing: vi.fn(),
      changeStream: vi.fn(),
      stopPublishing: vi.fn(),
      endSession: vi.fn(),
    });

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    // Inicia transmissão para liberar os controles ao vivo
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chat & Turma/i })).toBeInTheDocument();
    });

    // Abre a sidebar retrátil
    const chatTurmaBtn = screen.getByRole('button', { name: /Chat & Turma/i });
    fireEvent.click(chatTurmaBtn);

    // Navega para a aba Alunos
    const studentsTabBtn = screen.getByRole('button', { name: /Alunos/i });
    fireEvent.click(studentsTabBtn);

    // Deve exibir a seção de Mãos Levantadas com contagem (2)
    expect(screen.getByText(/Mãos Levantadas \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Ordem de chamada/i)).toBeInTheDocument();

    // Maria Silva (#1) e João Santos (#2)
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getAllByText('Maria Silva').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('João Santos').length).toBeGreaterThanOrEqual(1);

    // Botão de Abaixar Mão de Maria Silva
    const lowerButtons = screen.getAllByRole('button', { name: /Abaixar Mão/i });
    expect(lowerButtons.length).toBeGreaterThanOrEqual(1);

    // Ao clicar em abaixar a mão do primeiro aluno
    fireEvent.click(lowerButtons[0]);
    expect(mockLowerStudentHand).toHaveBeenCalledWith('part-aluno-1');
  });

  it('deve exibir notificação flutuante toast quando aluno levantar a mão com a sidebar fechada', async () => {
    vi.spyOn(publisherModule, 'useWebRTCPublisher').mockReturnValue({
      isPublishing: true,
      connectionState: 'connected',
      error: null,
      messages: [],
      participants: [],
      lastHandRaised: {
        studentId: 'part-aluno-1',
        studentName: 'Lucas Lima',
        raisedAt: '2026-10-07T10:05:00Z',
      },
      dismissHandToast: mockDismissHandToast,
      lowerStudentHand: mockLowerStudentHand,
      sendChatMessage: vi.fn(),
      sendStreamPause: vi.fn(),
      startPublishing: vi.fn(),
      changeStream: vi.fn(),
      stopPublishing: vi.fn(),
      endSession: vi.fn(),
    });

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    // Inicia transmissão
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // O toast flutuante deve indicar que Lucas Lima levantou a mão
    expect(screen.getByText('Lucas Lima')).toBeInTheDocument();
    expect(screen.getByText(/levantou a mão/i)).toBeInTheDocument();

    // Botão de dispensar aviso
    const dismissBtn = screen.getByTitle(/Dispensar aviso/i);
    fireEvent.click(dismissBtn);
    expect(mockDismissHandToast).toHaveBeenCalledTimes(1);
  });
});
