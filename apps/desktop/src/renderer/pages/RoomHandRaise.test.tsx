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
      pinChatMessage: vi.fn(),
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
        participant_id: 'part-aluno-1',
        name: 'Lucas Lima',
        timestamp: Date.now(),
      },
      dismissHandToast: mockDismissHandToast,
      lowerStudentHand: mockLowerStudentHand,
      sendChatMessage: vi.fn(),
      pinChatMessage: vi.fn(),
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

  const mockPublisherWithToast = (participants: any[] = []) => {
    vi.spyOn(publisherModule, 'useWebRTCPublisher').mockReturnValue({
      isPublishing: true,
      connectionState: 'connected',
      error: null,
      messages: [],
      participants: participants as any,
      lastHandRaised: {
        participant_id: 'part-aluno-1',
        name: 'Lucas Lima',
        timestamp: Date.now(),
      },
      dismissHandToast: mockDismissHandToast,
      lowerStudentHand: mockLowerStudentHand,
      sendChatMessage: vi.fn(),
      pinChatMessage: vi.fn(),
      sendStreamPause: vi.fn(),
      startPublishing: vi.fn(),
      changeStream: vi.fn(),
      stopPublishing: vi.fn(),
      endSession: vi.fn(),
    });
  };

  const startStreaming = async () => {
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  };

  // 031, RF-3101: fireEvent.click não passa pelo hit-testing do navegador, então a ordem de
  // camadas é verificada pelos zIndex inline: aviso acima do canvas e abaixo da barra.
  it('deve manter o aviso de mão levantada acima do canvas de marcação com qualquer ferramenta ativa', async () => {
    mockPublisherWithToast();
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);
    await startStreaming();

    const tools = ['cursor', 'pen', 'highlighter', 'arrow', 'rect', 'eraser', 'spotlight'];
    for (const tool of tools) {
      fireEvent.click(screen.getByTestId(`tool-btn-${tool}`));

      const toastZ = Number(screen.getByRole('alert').style.zIndex);
      const canvasZ = Number(screen.getByTestId('annotation-canvas').style.zIndex);
      const toolbarZ = Number(screen.getByTestId('annotation-toolbar').style.zIndex);

      expect(toastZ, `ferramenta ${tool}`).toBeGreaterThan(canvasZ);
      expect(toastZ, `ferramenta ${tool}`).toBeLessThan(toolbarZ);
    }
  });

  it('deve abrir a aba de alunos e dispensar o aviso ao clicar em Ver Turma', async () => {
    mockPublisherWithToast([
      {
        participant_id: 'part-aluno-1',
        name: 'Lucas Lima',
        role: 'aluno',
        student_id: '20241TADS0009',
        hand_raised: true,
        hand_raised_at: '2026-10-07T10:00:00Z',
      },
    ]);
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);
    await startStreaming();

    fireEvent.click(screen.getByRole('button', { name: /Ver Turma/i }));

    expect(mockDismissHandToast).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Mãos Levantadas \(1\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('deve exibir botão de fixar ao lado de todas as mensagens (alunos e professor), respeitar o limite de 3 fixadas e decodificar entidades HTML de caracteres especiais', async () => {
    const mockPinChatMessage = vi.fn();

    vi.spyOn(publisherModule, 'useWebRTCPublisher').mockReturnValue({
      isPublishing: true,
      connectionState: 'connected',
      error: null,
      messages: [
        {
          id: 'msg-1',
          sender_id: 'prof-1',
          sender_name: 'Professor',
          sender_role: 'professor',
          content: 'Aviso 1: use &lt;div class=&#34;box&#34;&gt; e &#39;aspas&#39; &amp; tags',
          timestamp: '2026-10-07T10:00:00Z',
          is_private: false,
          pinned: true,
        },
        {
          id: 'msg-2',
          sender_id: 'aluno-1',
          sender_name: 'Maria Silva',
          sender_role: 'aluno',
          content: 'Mensagem fixada 2 do aluno',
          timestamp: '2026-10-07T10:01:00Z',
          is_private: false,
          pinned: true,
        },
        {
          id: 'msg-3',
          sender_id: 'aluno-2',
          sender_name: 'João Santos',
          sender_role: 'aluno',
          content: 'Mensagem fixada 3 do aluno',
          timestamp: '2026-10-07T10:02:00Z',
          is_private: false,
          pinned: true,
        },
        {
          id: 'msg-4',
          sender_id: 'aluno-3',
          sender_name: 'Carlos Oliveira',
          sender_role: 'aluno',
          content: 'Quarta mensagem não fixada',
          timestamp: '2026-10-07T10:03:00Z',
          is_private: false,
          pinned: false,
        },
        {
          id: 'msg-priv-1',
          sender_id: 'aluno-1',
          sender_name: 'Maria Silva',
          sender_role: 'aluno',
          content: 'Dúvida privada sobre &lt;script&gt;',
          timestamp: '2026-10-07T10:04:00Z',
          is_private: true,
          pinned: false,
        },
      ],
      participants: [
        {
          participant_id: 'aluno-1',
          name: 'Maria Silva',
          role: 'aluno',
          student_id: '20241TADS0001',
        },
      ] as any,
      lastHandRaised: null,
      dismissHandToast: mockDismissHandToast,
      lowerStudentHand: mockLowerStudentHand,
      sendChatMessage: vi.fn(),
      pinChatMessage: mockPinChatMessage,
      sendStreamPause: vi.fn(),
      startPublishing: vi.fn(),
      changeStream: vi.fn(),
      stopPublishing: vi.fn(),
      endSession: vi.fn(),
    });

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chat & Turma/i })).toBeInTheDocument();
    });

    // Abre a sidebar de Chat
    fireEvent.click(screen.getByRole('button', { name: /Chat & Turma/i }));

    // Deve exibir o banner de Mensagens Fixadas (3/3)
    expect(screen.getByTestId('pinned-public-section')).toBeInTheDocument();
    expect(screen.getByText(/Mensagens Fixadas \(3\/3\)/i)).toBeInTheDocument();

    // Deve decodificar corretamente ', ", <>, & nas mensagens
    expect(
      screen.getAllByText(`Aviso 1: use <div class="box"> e 'aspas' & tags`).length
    ).toBeGreaterThanOrEqual(1);

    // A 4ª mensagem não fixada deve ter o botão desabilitado pois o limite de 3 foi atingido
    const fourthPinBtn = screen.getByTestId('pin-msg-btn-msg-4');
    expect(fourthPinBtn).toBeDisabled();
    expect(fourthPinBtn).toHaveAttribute('title', expect.stringMatching(/Limite máximo de 3 mensagens fixadas atingido/i));

    // Já as mensagens fixadas continuam podendo ser desafixadas pelo professor
    const firstPinBtn = screen.getByTestId('pin-msg-btn-msg-1');
    expect(firstPinBtn).not.toBeDisabled();
    fireEvent.click(firstPinBtn);
    expect(mockPinChatMessage).toHaveBeenCalledWith('msg-1', false, false);

    // No chat privado, o limite é independente por conversa e o botão de fixar deve estar disponível
    fireEvent.click(screen.getByRole('button', { name: /Dúvidas Privadas/i }));
    expect(screen.getByText('Dúvida privada sobre <script>')).toBeInTheDocument();
    const privPinBtn = screen.getByTestId('pin-msg-btn-msg-priv-1');
    expect(privPinBtn).not.toBeDisabled();
    fireEvent.click(privPinBtn);
    expect(mockPinChatMessage).toHaveBeenCalledWith('msg-priv-1', true, true, 'aluno-1');
  });
});
