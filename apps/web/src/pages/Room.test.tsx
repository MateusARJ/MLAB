import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Room } from './Room';

const { mockSendChatMessage, mockToggleHand, mockSubscriberState } = vi.hoisted(() => ({
  mockSendChatMessage: vi.fn(),
  mockToggleHand: vi.fn(),
  mockSubscriberState: {
    connectionStatus: 'connected' as 'connecting' | 'connected' | 'reconnecting' | 'closed',
    isHandRaised: false,
  },
}));

vi.mock('../hooks/useWebRTCSubscriber', () => ({
  useWebRTCSubscriber: () => ({
    stream: new MediaStream(),
    autoplayBlocked: true,
    setAutoplayBlocked: vi.fn(),
    connectionStatus: mockSubscriberState.connectionStatus,
    isStreamPaused: false,
    sharedFiles: [],
    messages: [
      { sender_name: 'Professor Girafales', sender_role: 'professor', content: 'Bem-vindos a aula!', is_private: false },
      { sender_name: 'Professor Girafales', sender_role: 'professor', content: 'Sua nota da prova é 10', is_private: true },
    ],
    sendChatMessage: mockSendChatMessage,
    isHandRaised: mockSubscriberState.isHandRaised,
    toggleHand: mockToggleHand,
  }),
}));

describe('Room Component (Web Subscriber)', () => {
  afterEach(() => {
    window.innerWidth = 1024;
    mockSubscriberState.connectionStatus = 'connected';
    mockSubscriberState.isHandRaised = false;
    fireEvent(window, new Event('resize'));
    try {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: null,
      });
    } catch {}
  });

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

    const chatToggleBtn = screen.getByRole('button', { name: /^Chat$/i });
    expect(chatToggleBtn).toBeInTheDocument();

    // Fecha o chat
    fireEvent.click(chatToggleBtn);

    // Botão de fechar não deve estar visível com o chat recolhido ou deve ter botão flutuante
    expect(screen.getAllByRole('button', { name: /Chat/i }).length).toBeGreaterThanOrEqual(1);

    // Reabre o chat
    fireEvent.click(chatToggleBtn);
    expect(screen.getByText(/Chat da Aula/i)).toBeInTheDocument();
  });

  it('deve alternar entre as abas Chat e Arquivos na gaveta em visualização mobile', () => {
    // Simula viewport mobile
    window.innerWidth = 400;
    fireEvent(window, new Event('resize'));

    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    // Na visualização mobile com chat aberto, devem existir as abas Chat e Arquivos
    expect(screen.getByRole('button', { name: /^Chat$/i })).toBeInTheDocument();
    const filesTab = screen.getByRole('button', { name: /^Arquivos$/i });
    expect(filesTab).toBeInTheDocument();

    // Clicar na aba de Arquivos
    fireEvent.click(filesTab);

    // Deve exibir o estado de lista de arquivos
    expect(screen.getByText(/Nenhum arquivo compartilhado pelo professor/i)).toBeInTheDocument();
  });

  it('deve isolar mensagens e formulários entre chat público e chat privado do aluno', () => {
    mockSendChatMessage.mockClear();
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    // Na aba pública inicial:
    // Mensagem pública deve estar visível
    expect(screen.getByText(/Bem-vindos a aula!/i)).toBeInTheDocument();
    // Mensagem privada NÃO deve estar visível na aba pública
    expect(screen.queryByText(/Sua nota da prova é 10/i)).not.toBeInTheDocument();

    // Enviar mensagem no chat público
    const publicInput = screen.getByPlaceholderText(/Mensagem para toda a turma.../i);
    fireEvent.change(publicInput, { target: { value: 'Dúvida pública aluno' } });
    fireEvent.click(screen.getByRole('button', { name: /^Enviar$/i }));

    expect(mockSendChatMessage).toHaveBeenCalledWith('Dúvida pública aluno', false);

    // Alternar para a aba privada com o professor
    const privateTab = screen.getByRole('button', { name: /Privado com Professor/i });
    fireEvent.click(privateTab);

    // Mensagem privada deve estar visível agora
    expect(screen.getByText(/Sua nota da prova é 10/i)).toBeInTheDocument();
    // Mensagem pública NÃO deve estar visível na aba privada
    expect(screen.queryByText(/Bem-vindos a aula!/i)).not.toBeInTheDocument();

    // Enviar mensagem no chat privado
    const privateInput = screen.getByPlaceholderText(/Dúvida privada ao professor.../i);
    fireEvent.change(privateInput, { target: { value: 'Dúvida confidencial' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar Privado/i }));

    expect(mockSendChatMessage).toHaveBeenCalledWith('Dúvida confidencial', true);
  });

  it('deve manter tela estatica no mobile fora de tela cheia sem sumir botoes ou cabecalho ao clicar no video', () => {
    window.innerWidth = 400;
    fireEvent(window, new Event('resize'));

    const { container } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();

    // Botão de tela cheia visível
    const fsBtn = screen.getByRole('button', { name: /Tela Cheia/i });
    expect(fsBtn).toBeInTheDocument();

    // Clica no vídeo
    const video = container.querySelector('video')!;
    fireEvent.click(video);

    // Header continua presente normalmente (tela estática)
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tela Cheia/i })).toBeInTheDocument();
  });

  it('deve ocultar header tradicional e exibir sidebar retratil na lateral direita com botao meio transparente em tela cheia', () => {
    window.innerWidth = 400;
    fireEvent(window, new Event('resize'));

    const mockLeave = vi.fn();
    const { container } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={mockLeave} />);

    // Simula entrada em tela cheia
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: container,
    });
    fireEvent(document, new Event('fullscreenchange'));

    // Em tela cheia, o header superior tradicional NÃO deve ser renderizado
    expect(container.querySelector('header')).not.toBeInTheDocument();

    // Deve exibir o botão flutuante meio transparente no canto superior direito
    const triggerBtn = screen.getByTestId('fullscreen-menu-trigger');
    expect(triggerBtn).toBeInTheDocument();

    // Deve renderizar a sidebar retrátil na lateral direita
    const sidebar = screen.getByTestId('fullscreen-right-sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveStyle({ transform: 'translateX(100%)' });

    // Clica no botão meio transparente para abrir a sidebar retrátil
    fireEvent.click(triggerBtn);
    expect(sidebar).toHaveStyle({ transform: 'translateX(0)' });

    // Verifica que os controles estão presentes na sidebar
    expect(screen.getByText(/Controles da Transmissão/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: connected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat da Turma/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arquivos da Aula/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Picture-in-Picture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sair da Tela Cheia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sair da Sala/i })).toBeInTheDocument();

    // Os botões sobrepostos de tela cheia no player devem estar ocultados
    expect(screen.queryByRole('button', { name: /^Tela Cheia$/i })).not.toBeInTheDocument();

    // Tocar no backdrop fecha a sidebar
    const backdrop = screen.getByTestId('fullscreen-sidebar-backdrop');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop);

    expect(sidebar).toHaveStyle({ transform: 'translateX(100%)' });
  });

  it('deve esconder o chat ao clicar na area de video quando o chat estiver aberto', () => {
    const { container } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    // No desktop inicial, chat começa aberto
    expect(screen.getByText(/Chat da Aula/i)).toBeInTheDocument();

    // Clica no vídeo
    const video = container.querySelector('video')!;
    fireEvent.click(video);

    // Chat deve ser recolhido
    const aside = container.querySelector('aside');
    expect(aside).toHaveStyle({ width: '0px', opacity: 0 });
  });

  it('deve chamar onLeave e retornar ao inicio quando a aula for encerrada pelo professor', () => {
    mockSubscriberState.connectionStatus = 'closed';
    const mockLeave = vi.fn();
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={mockLeave} />);

    expect(mockLeave).toHaveBeenCalledWith(
      expect.stringMatching(/A transmissão foi encerrada pelo professor/i)
    );
  });

  it('deve ocultar o botao de menu da sidebar retratil quando arquivos estiver aberto em tela cheia e exibir o botao de x', () => {
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));

    const { container } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    // Simula entrada em tela cheia
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: container,
    });
    fireEvent(document, new Event('fullscreenchange'));

    // Fecha o chat primeiro para liberar o botão flutuante da sidebar
    const video = container.querySelector('video')!;
    fireEvent.click(video);

    // O botão flutuante de menu da sidebar deve estar visível
    const triggerBtn = screen.getByTestId('fullscreen-menu-trigger');
    expect(triggerBtn).toBeInTheDocument();

    // Abre a sidebar retrátil
    fireEvent.click(triggerBtn);

    // Clica no botão "Arquivos da Aula"
    const filesBtn = screen.getByRole('button', { name: /Arquivos da Aula/i });
    fireEvent.click(filesBtn);

    // O botão da sidebar retrátil deve sumir (igual ao comportamento do chat)
    expect(screen.queryByTestId('fullscreen-menu-trigger')).not.toBeInTheDocument();

    // O botão de fechar (x) de arquivos deve estar visível e desobstruído
    const closeFilesBtn = screen.getByTestId('close-files-btn');
    expect(closeFilesBtn).toBeInTheDocument();

    // Ao clicar em fechar arquivos, o botão da sidebar retrátil volta a aparecer
    fireEvent.click(closeFilesBtn);
    expect(screen.getByTestId('fullscreen-menu-trigger')).toBeInTheDocument();
  });

  it('deve abrir a gaveta mobile com abas de Chat e Arquivos a partir da sidebar retratil em landscape mobile', () => {
    // Simula smartphone em orientação paisagem (landscape: 844x390, típico de iPhone/Galaxy)
    window.innerWidth = 844;
    window.innerHeight = 390;
    fireEvent(window, new Event('resize'));

    const { container } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    // Simula fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: container,
    });
    fireEvent(document, new Event('fullscreenchange'));

    // Botão flutuante de menu da sidebar deve estar visível
    const triggerBtn = screen.getByTestId('fullscreen-menu-trigger');
    expect(triggerBtn).toBeInTheDocument();

    // Abre a sidebar retrátil
    fireEvent.click(triggerBtn);

    // Clica no botão "Chat da Turma" na sidebar retrátil
    const chatBtn = screen.getByRole('button', { name: /Chat da Turma/i });
    fireEvent.click(chatBtn);

    // Deve abrir a gaveta mobile com as abas de alternância
    expect(screen.getByRole('button', { name: /^Chat$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Arquivos$/i })).toBeInTheDocument();
  });

  it('deve acionar pseudo-fullscreen visual quando a Fullscreen API nativa não for suportada (ex: iOS Safari)', () => {
    window.innerWidth = 390;
    window.innerHeight = 844;
    fireEvent(window, new Event('resize'));

    const { container } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    // Garante que o header tradicional está visível no início
    expect(container.querySelector('header')).toBeInTheDocument();

    // Clica no botão de tela cheia no player (sem suporte nativo a requestFullscreen)
    const fsBtn = screen.getByRole('button', { name: /Tela Cheia/i });
    fireEvent.click(fsBtn);

    // O header deve ser ocultado no pseudo-fullscreen
    expect(container.querySelector('header')).not.toBeInTheDocument();

    // O botão flutuante de menu da sidebar deve aparecer
    const triggerBtn = screen.getByTestId('fullscreen-menu-trigger');
    expect(triggerBtn).toBeInTheDocument();

    // Abre a sidebar e clica em Sair da Tela Cheia
    fireEvent.click(triggerBtn);
    const exitFsBtn = screen.getByRole('button', { name: /Sair da Tela Cheia/i });
    fireEvent.click(exitFsBtn);

    // O header tradicional deve voltar a ser exibido
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('deve exibir o botão de Levantar Mão no player e chamar toggleHand ao clicar', () => {
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const raiseBtn = screen.getByRole('button', { name: /Levantar Mão/i });
    expect(raiseBtn).toBeInTheDocument();

    fireEvent.click(raiseBtn);
    expect(mockToggleHand).toHaveBeenCalled();
  });

  it('deve exibir banner avisando que a mão está levantada quando isHandRaised for true', () => {
    mockSubscriberState.isHandRaised = true;
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    expect(screen.getByText(/Sua mão está levantada\. O professor foi notificado\./i)).toBeInTheDocument();
    const lowerBtns = screen.getAllByRole('button', { name: /Abaixar Mão/i });
    expect(lowerBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(lowerBtns[0]);
    expect(mockToggleHand).toHaveBeenCalledWith(false);
  });
});


