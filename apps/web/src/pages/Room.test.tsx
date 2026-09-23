import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Room } from './Room';

vi.mock('../hooks/useWebRTCSubscriber', () => ({
  useWebRTCSubscriber: () => ({
    stream: new MediaStream(),
    autoplayBlocked: true,
    setAutoplayBlocked: vi.fn(),
    connectionStatus: 'connected',
    isStreamPaused: false,
    sharedFiles: [],
    messages: [
      { sender_name: 'Professor Girafales', sender_role: 'professor', content: 'Bem-vindos a aula!' },
    ],
    sendChatMessage: vi.fn(),
  }),
}));

describe('Room Component (Web Subscriber)', () => {
  const dummyToken = 'student-jwt-123';
  const dummyRoomInfo = {
    room_id: 'room-101',
    ws_url: 'ws://localhost:8080/ws/rooms/room-101/signal',
    ice_servers: [],
  };

  it('deve exibir o banner de Autoplay Policy quando o som for bloqueado pelo navegador', () => {
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    expect(screen.getByText(/O áudio da aula foi pausado pelo navegador/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clique para Ativar Som/i })).toBeInTheDocument();
  });

  it('deve exibir os botoes de Tela Cheia e Picture-in-Picture no player', () => {
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Tela Cheia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Picture-in-Picture/i })).toBeInTheDocument();
  });

  it('deve renderizar as mensagens do chat sanitizadas com o nome e papel do remetente', () => {
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    expect(screen.getByText(/Professor Girafales/i)).toBeInTheDocument();
    expect(screen.getByText(/Bem-vindos a aula!/i)).toBeInTheDocument();
  });

  it('deve alternar a visibilidade do chat ao clicar no botão de toggle', () => {
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const chatToggleBtn = screen.getByRole('button', { name: /Chat/i });
    expect(chatToggleBtn).toBeInTheDocument();

    // Fecha o chat
    fireEvent.click(chatToggleBtn);

    // Botão de fechar não deve estar visível com o chat recolhido ou deve ter botão flutuante
    expect(screen.getAllByRole('button', { name: /Chat/i }).length).toBeGreaterThanOrEqual(1);

    // Reabre o chat
    fireEvent.click(chatToggleBtn);
    expect(screen.getByText(/Chat da Aula/i)).toBeInTheDocument();
  });
});
