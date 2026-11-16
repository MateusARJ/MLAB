import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Room } from './Room';

const { mockSendChatMessage, mockToggleHand, mockSubscriberState } = vi.hoisted(() => ({
  mockSendChatMessage: vi.fn(),
  mockToggleHand: vi.fn(),
  mockSubscriberState: {
    connectionStatus: 'connected' as 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'duplicate' | 'student-id-in-use',
    isHandRaised: false,
    chatNotice: null as string | null,
    isChatReady: true,
    messages: [
      { id: 'pub-1', sender_name: 'Professor Girafales', sender_role: 'professor', content: 'Bem-vindos a aula!', is_private: false, pinned: false },
      { id: 'priv-1', sender_name: 'Professor Girafales', sender_role: 'professor', content: 'Sua nota da prova é 10', is_private: true, pinned: false },
    ] as any[],
    sharedFiles: [] as any[],
  },
}));

vi.mock('../hooks/useWebRTCSubscriber', () => ({
  useWebRTCSubscriber: () => ({
    stream: new MediaStream(),
    autoplayBlocked: true,
    setAutoplayBlocked: vi.fn(),
    connectionStatus: mockSubscriberState.connectionStatus,
    isStreamPaused: false,
    sharedFiles: mockSubscriberState.sharedFiles,
    messages: mockSubscriberState.messages,
    sendChatMessage: mockSendChatMessage,
    isHandRaised: mockSubscriberState.isHandRaised,
    toggleHand: mockToggleHand,
    chatNotice: mockSubscriberState.chatNotice,
    dismissChatNotice: vi.fn(),
    isChatReady: mockSubscriberState.isChatReady,
  }),
}));

describe('Room Component (Web Subscriber)', () => {
  afterEach(() => {
    window.innerWidth = 1024;
    mockSubscriberState.connectionStatus = 'connected';
    mockSubscriberState.isHandRaised = false;
    mockSubscriberState.chatNotice = null;
    mockSubscriberState.isChatReady = true;
    mockSubscriberState.messages = [
      { id: 'pub-1', sender_name: 'Professor Girafales', sender_role: 'professor', content: 'Bem-vindos a aula!', is_private: false, pinned: false },
      { id: 'priv-1', sender_name: 'Professor Girafales', sender_role: 'professor', content: 'Sua nota da prova é 10', is_private: true, pinned: false },
    ];
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
    expect(screen.getAllByText('Conectado').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Status:/i)).not.toBeInTheDocument();
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

  it('deve exibir o aviso de limite do chat acima do formulario', () => {
    mockSubscriberState.chatNotice = 'muitas mensagens, aguarde';
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    expect(screen.getAllByText('muitas mensagens, aguarde').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Mensagem para toda a turma/i)).toBeInTheDocument();
  });

  it('deve desabilitar o chat publico e o privado enquanto o WebSocket nao conecta (005/RF-506)', () => {
    mockSubscriberState.isChatReady = false;
    const { rerender } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const publicInput = screen.getByPlaceholderText('Conectando ao chat...');
    expect(publicInput).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Enviar$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Privado com Professor/i }));
    expect(screen.getByPlaceholderText('Conectando ao chat...')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Enviar Privado/i })).toBeDisabled();

    // Ao conectar, o chat volta a aceitar mensagens.
    mockSubscriberState.isChatReady = true;
    rerender(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Dúvida privada ao professor/i)).toBeEnabled();
  });

  it('deve preservar o texto digitado quando o chat e bloqueado e liberado (005/C-506)', () => {
    const { rerender } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Mensagem para toda a turma/i), { target: { value: 'rascunho' } });

    mockSubscriberState.isChatReady = false;
    rerender(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);
    expect(screen.getByPlaceholderText('Conectando ao chat...')).toHaveValue('rascunho');

    mockSubscriberState.isChatReady = true;
    rerender(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Mensagem para toda a turma/i)).toHaveValue('rascunho');
  });

  it('deve informar sessao aberta em outra aba quando a conexao cair com 4001', () => {
    mockSubscriberState.connectionStatus = 'duplicate';
    const mockLeave = vi.fn();
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={mockLeave} />);

    expect(mockLeave).toHaveBeenCalledWith('Sua sessão foi aberta em outra aba ou dispositivo.');
    expect(mockLeave).not.toHaveBeenCalledWith(expect.stringMatching(/encerrada pelo professor/i));
  });

  it('deve informar matricula ja conectada quando a conexao for recusada com 4002 (027)', () => {
    mockSubscriberState.connectionStatus = 'student-id-in-use';
    const mockLeave = vi.fn();
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={mockLeave} />);

    expect(mockLeave).toHaveBeenCalledWith('Esta matrícula já está conectada nesta transmissão.');
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

  it('deve manter o aviso de mao levantada legivel no celular, sem comprimir texto, icone ou botao (006/RF-601, RF-602)', () => {
    window.innerWidth = 360;
    fireEvent(window, new Event('resize'));
    mockSubscriberState.isHandRaised = true;
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const banner = screen.getByTestId('hand-raised-banner');
    expect(banner).toHaveAttribute('role', 'status');
    // Largura do conteúdo limitada à área do vídeo (antes ficava presa a metade dela).
    expect(banner.style.width).toBe('max-content');
    expect(banner.style.maxWidth).toBe('calc(100% - 32px)');

    const icon = screen.getByTestId('hand-raised-banner-icon');
    expect(icon.style.flexShrink).toBe('0');
    expect(icon.style.width).toBe('16px');

    const lowerBtn = screen.getByRole('button', { name: 'Abaixar Mão' });
    expect(lowerBtn.style.whiteSpace).toBe('nowrap');
    expect(banner).toContainElement(lowerBtn);
  });

  it('deve abaixar a mao pelo aviso sem propagar o clique para o video (006/RNF-601)', () => {
    mockSubscriberState.isHandRaised = true;
    mockToggleHand.mockClear();
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const lowerBtn = screen.getByRole('button', { name: 'Abaixar Mão' });
    const clickEvent = createEvent.click(lowerBtn);
    const stopSpy = vi.spyOn(clickEvent, 'stopPropagation');

    fireEvent(lowerBtn, clickEvent);
    expect(mockToggleHand).toHaveBeenCalledWith(false);
    expect(stopSpy).toHaveBeenCalled();
  });

  it('deve exibir banner de mensagens fixadas somente-leitura, decodificar caracteres especiais e nunca exibir botão de fixar para o aluno', () => {
    mockSubscriberState.messages = [
      {
        id: 'pub-pinned-1',
        sender_name: 'Professor Girafales',
        sender_role: 'professor',
        content: 'Prova sobre &lt;html&gt;, &#34;strings&#34; e &#39;chars&#39; &amp; lógica',
        is_private: false,
        pinned: true,
      },
      {
        id: 'pub-normal-2',
        sender_name: 'Chaves',
        sender_role: 'aluno',
        content: 'Entendido professor!',
        is_private: false,
        pinned: false,
      },
    ];

    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    // Deve exibir o banner de mensagens fixadas (1/3) e o selo FIXADA
    expect(screen.getByTestId('pinned-public-section')).toBeInTheDocument();
    expect(screen.getByText(/Mensagens Fixadas \(1\/3\)/i)).toBeInTheDocument();
    expect(screen.getByText('FIXADA')).toBeInTheDocument();

    // Deve decodificar entidades HTML enviadas pelo backend (', ", <>, &)
    expect(
      screen.getAllByText(`Prova sobre <html>, "strings" e 'chars' & lógica`).length
    ).toBeGreaterThanOrEqual(1);

    // O aluno NUNCA deve ver botões de Fixar ou Desafixar mensagem
    expect(screen.queryByRole('button', { name: /Fixar mensagem/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desafixar mensagem/i })).not.toBeInTheDocument();
  });
});

describe('Room — rolagem automática da lista de arquivos (018/RF-191)', () => {
  const token = 'student-jwt-123';
  const roomInfo = { room_id: 'room-101', ws_url: 'ws://localhost:8080/ws/rooms/room-101/signal', ice_servers: [] };
  let scrolled: Element[];
  const original = (Element.prototype as any).scrollIntoView;

  function sharedFile(n: number) {
    return { id: `f${n}`, name: `material-${n}.pdf`, size: 1024, url: `/rooms/room-101/files/f${n}/download` };
  }

  beforeEach(() => {
    scrolled = [];
    (Element.prototype as any).scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    mockSubscriberState.sharedFiles = [sharedFile(1)];
  });

  afterEach(() => {
    (Element.prototype as any).scrollIntoView = original;
    mockSubscriberState.sharedFiles = [];
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));
  });

  function scrolledToFilesEnd() {
    return scrolled.filter((el) => el === screen.queryByTestId('files-end')).length;
  }

  it('rola a gaveta Arquivos da Aula até o último arquivo ao abrir e quando chega um arquivo novo', () => {
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));
    const { rerender } = render(<Room token={token} roomInfo={roomInfo} onLeave={vi.fn()} />);

    fireEvent.click(screen.getAllByTitle('Arquivos da Aula')[0]);
    const end = screen.getByTestId('files-end');
    expect(scrolledToFilesEnd()).toBeGreaterThan(0);

    const before = scrolledToFilesEnd();
    mockSubscriberState.sharedFiles = [sharedFile(1), sharedFile(2)];
    rerender(<Room token={token} roomInfo={roomInfo} onLeave={vi.fn()} />);

    expect(scrolledToFilesEnd()).toBeGreaterThan(before);
    const last = screen.getByText('material-2.pdf');
    expect(last.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('rola a aba Arquivos do celular até o último arquivo quando chega um arquivo novo', () => {
    window.innerWidth = 400;
    fireEvent(window, new Event('resize'));
    const { rerender } = render(<Room token={token} roomInfo={roomInfo} onLeave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Arquivos/i }));
    expect(screen.getByTestId('files-end')).toBeInTheDocument();
    const before = scrolledToFilesEnd();
    expect(before).toBeGreaterThan(0);

    mockSubscriberState.sharedFiles = [sharedFile(1), sharedFile(2)];
    rerender(<Room token={token} roomInfo={roomInfo} onLeave={vi.fn()} />);

    expect(scrolledToFilesEnd()).toBeGreaterThan(before);
  });
});

describe('Room — altura da lista de arquivos (024)', () => {
  const token = 'student-jwt-123';
  const roomInfo = { room_id: 'room-101', ws_url: 'ws://localhost:8080/ws/rooms/room-101/signal', ice_servers: [] };

  beforeEach(() => {
    mockSubscriberState.sharedFiles = [
      { id: 'f1', name: 'material-1.pdf', size: 1024, url: '/rooms/room-101/files/f1/download' },
    ];
  });

  afterEach(() => {
    mockSubscriberState.sharedFiles = [];
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));
  });

  it('no celular, a lista da aba Arquivos ocupa a altura da gaveta e é o único contêiner que rola (RF-2401)', () => {
    window.innerWidth = 400;
    fireEvent(window, new Event('resize'));
    render(<Room token={token} roomInfo={roomInfo} onLeave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Arquivos/i }));
    const list = screen.getByTestId('mobile-files-list');
    expect(list).toHaveStyle({ flex: '1', overflowY: 'auto' });
    expect(list.style.maxHeight).toBe('');
    expect(list).toContainElement(screen.getByTestId('files-end'));
    expect(screen.getByTestId('mobile-files-content').style.overflowY).toBe('');
  });

  it('no desktop, a gaveta Arquivos da Aula mantém a altura máxima de 380px (RF-2402)', () => {
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));
    render(<Room token={token} roomInfo={roomInfo} onLeave={vi.fn()} />);

    fireEvent.click(screen.getAllByTitle('Arquivos da Aula')[0]);
    expect(screen.getByTestId('files-list')).toHaveStyle({ maxHeight: '380px' });
  });
});

describe('Room — controles do aluno no celular (043)', () => {
  const dummyToken = 'student-jwt-123';
  const dummyRoomInfo = { room_id: 'room-101', ws_url: 'ws://localhost:8080/ws/rooms/room-101/signal', ice_servers: [] };

  afterEach(() => {
    mockSubscriberState.isHandRaised = false;
    window.innerWidth = 1024;
    window.innerHeight = 768;
    fireEvent(window, new Event('resize'));
    try {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    } catch {}
  });

  it('pílula de levantar mão e grupo PiP / Tela Cheia ficam na mesma linha flexível, com espaço entre eles (RF-4301)', () => {
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const bar = screen.getByTestId('video-bottom-bar');
    expect(bar).toHaveStyle({ display: 'flex', gap: '8px', pointerEvents: 'none' });

    const handBtn = screen.getByRole('button', { name: 'Levantar mão' });
    const toolbar = screen.getByRole('toolbar', { name: 'Visualização' });
    expect(bar).toContainElement(handBtn);
    expect(bar).toContainElement(toolbar);
    expect(toolbar).toHaveStyle({ flexShrink: '0', pointerEvents: 'auto' });
    expect(toolbar).not.toHaveStyle({ position: 'absolute' });
    expect(handBtn).toHaveStyle({ minWidth: '0', maxWidth: '100%', pointerEvents: 'auto' });
    expect(handBtn).toHaveClass('ml-hand-btn');
  });

  it('pílula ativa tem rótulo completo e curto, com o mesmo nome acessível (RF-4303)', () => {
    mockSubscriberState.isHandRaised = true;
    render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);

    const handBtn = screen.getByRole('button', { name: 'Abaixar mão', pressed: true });
    expect(handBtn.querySelector('.ml-hand-label')).toHaveTextContent('Mão levantada (abaixar)');
    expect(handBtn.querySelector('.ml-hand-label-short')).toHaveTextContent('Abaixar mão');
  });

  it('menu em tela cheia tem um único X e o gatilho informa o estado (RF-4305, RF-4306)', () => {
    window.innerWidth = 844;
    window.innerHeight = 390;
    fireEvent(window, new Event('resize'));
    const { container } = render(<Room token={dummyToken} roomInfo={dummyRoomInfo} onLeave={vi.fn()} />);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: container });
    fireEvent(document, new Event('fullscreenchange'));

    const trigger = screen.getByTestId('fullscreen-menu-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'fullscreen-right-sidebar');
    expect(trigger).toHaveAccessibleName('Abrir menu da transmissão');
    expect(screen.getByTestId('fullscreen-right-sidebar')).toHaveAttribute('id', 'fullscreen-right-sidebar');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAccessibleName('Fechar menu da transmissão');
    expect(screen.getAllByRole('button', { name: /fechar menu/i })).toEqual([trigger]);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('fullscreen-right-sidebar')).toHaveStyle({ transform: 'translateX(100%)' });
  });
});
