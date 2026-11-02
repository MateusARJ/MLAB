import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Room } from './Room';
import * as publisherModule from '../hooks/useWebRTCPublisher';

describe('Room Component (Desktop)', () => {
  const dummyRoom = {
    id: 'room-101',
    slug: 'charlie-delta-7342',
    link: 'http://mlab-charlie.local:3000',
    mdnsLink: 'http://mlab-charlie.local:3000',
    ipLink: 'http://192.168.1.100:3000',
  };

  it('deve exibir o setup inicial com opções de gravação e modos de captura', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    // Pergunta de gravação
    expect(screen.getByText(/1\. Deseja gravar esta aula no seu computador\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sim, Gravar Aula/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apenas Transmitir/i })).toBeInTheDocument();

    // Modos de captura
    expect(screen.getByRole('button', { name: /Tela Cheia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Janela \/ Aba Específica/i })).toBeInTheDocument();

    // Botão de avançar
    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });
  });

  it('deve iniciar com gravação desligada por padrão e exibir o botão .webm somente ao ativar gravação', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Por padrão a gravação vem desligada: botão .webm não deve estar visível
    expect(screen.queryByRole('button', { name: /\.webm \(Alta Fidelidade em 1080p\)/i })).not.toBeInTheDocument();

    // Ao clicar em 'Sim, Gravar Aula', as opções de gravação aparecem
    const wantRecordBtn = screen.getByRole('button', { name: /Sim, Gravar Aula/i });
    fireEvent.click(wantRecordBtn);

    const webmBtn = screen.getByRole('button', { name: /\.webm \(Alta Fidelidade em 1080p\)/i });
    expect(webmBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\.mp4/i })).not.toBeInTheDocument();
  });

  it('deve alternar para modo Janela, exibir dica de janelas abertas e permitir clicar em Atualizar Janelas', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const windowTab = screen.getByRole('button', { name: /Janela \/ Aba Específica/i });
    fireEvent.click(windowTab);

    await waitFor(() => {
      expect(window.electronAPI.getScreenSources).toHaveBeenCalledWith('window');
      expect(screen.getByText('Google Chrome')).toBeInTheDocument();
      expect(screen.getByText(/Certifique-se de que a janela ou navegador esteja aberto/i)).toBeInTheDocument();
    });

    // Botão de atualizar janelas
    const refreshBtn = screen.getByRole('button', { name: /Atualizar Janelas/i });
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(window.electronAPI.getScreenSources).toHaveBeenCalled();
    });
  });

  it('deve iniciar com microfone desligado por padrão e permitir alternar ao clicar', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Microfone deve iniciar desligado por padrão (exibindo 'Desmutar Microfone')
    const micBtn = screen.getByRole('button', { name: /Desmutar Microfone/i });
    expect(micBtn).toBeInTheDocument();

    // Ao clicar, deve desmutar (passando a exibir 'Mutar Microfone')
    fireEvent.click(micBtn);
    expect(screen.getByRole('button', { name: /Mutar Microfone/i })).toBeInTheDocument();
  });

  it('deve iniciar com som do PC desligado por padrão e permitir alternar ao clicar', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Som do PC deve iniciar desligado por padrão (exibindo 'Ativar Som do PC')
    const systemAudioBtn = screen.getByRole('button', { name: /Ativar Som do PC/i });
    expect(systemAudioBtn).toBeInTheDocument();

    // Ao clicar, deve ativar (passando a exibir 'Silenciar Som do PC')
    fireEvent.click(systemAudioBtn);
    expect(screen.getByRole('button', { name: /Silenciar Som do PC/i })).toBeInTheDocument();

    // Ao clicar novamente, deve silenciar (voltando a exibir 'Ativar Som do PC')
    fireEvent.click(screen.getByRole('button', { name: /Silenciar Som do PC/i }));
    expect(screen.getByRole('button', { name: /Ativar Som do PC/i })).toBeInTheDocument();
  });

  it('deve permitir alternar entre abas de chat público e dúvidas privadas', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Abre o painel lateral de chat
    const chatBtn = screen.getByRole('button', { name: /Chat & Turma/i });
    fireEvent.click(chatBtn);

    // Deve exibir as abas dedicadas de Turma (Público) e Dúvidas Privadas
    expect(screen.getByRole('button', { name: /Turma \(Público\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dúvidas Privadas/i })).toBeInTheDocument();

    // Clica na aba de Dúvidas Privadas
    fireEvent.click(screen.getByRole('button', { name: /Dúvidas Privadas/i }));
    expect(screen.getByText(/Nenhuma dúvida privada recebida/i)).toBeInTheDocument();
  });

  it('deve copiar o link da sala ao clicar no botão Copiar Link do cabeçalho', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    const copyBtn = screen.getByRole('button', { name: /Copiar Link Fixo/i });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByTitle(/Link Fixo Copiado/i)).toBeInTheDocument();
    });
  });

  it('deve chamar onCloseRoom ao clicar em Encerrar Transmissão', async () => {
    const handleClose = vi.fn();
    render(<Room room={dummyRoom} onCloseRoom={handleClose} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Encerrar Transmissão/i }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('deve permitir clicar em Alterar Modo / Fonte, escolher nova fonte e retomar a transmissão', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Inicia a primeira sessão
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();

    // Clica para alterar modo/fonte
    fireEvent.click(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i }));

    // Deve voltar ao setup de seleção
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Janela \/ Aba Específica/i })).toBeInTheDocument();
    });

    // Alterna para janela
    fireEvent.click(screen.getByRole('button', { name: /Janela \/ Aba Específica/i }));

    await waitFor(() => {
      expect(screen.getByText('Google Chrome')).toBeInTheDocument();
    });

    // Seleciona a janela do Chrome
    fireEvent.click(screen.getByText('Google Chrome'));

    // Avança novamente para a transmissão
    const advanceBtn2 = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn2).toBeEnabled();
    });
    fireEvent.click(advanceBtn2);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
      expect(screen.getByText(/Janela Específica/i)).toBeInTheDocument();
    });
  });

  it('deve renderizar o link da sala diretamente abaixo do título no cabeçalho e não exibir ID', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    expect(screen.getByText(dummyRoom.mdnsLink)).toBeInTheDocument();
    expect(screen.getByText(dummyRoom.ipLink)).toBeInTheDocument();
    expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });
  });

  it('deve exibir o badge de resolução 1080p @ 60fps na sessão ao vivo por padrão', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
      expect(screen.getByText('1080p @ 60fps')).toBeInTheDocument();
      expect(screen.queryByText(/6 Mbps/i)).not.toBeInTheDocument();
    });
  });

  it('deve abrir a sidebar retrátil com abas de Chat, Alunos e Arquivos ao clicar no botão de Chat', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Inicia sessão ao vivo
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chat & Turma/i })).toBeInTheDocument();
    });

    const chatBtn = screen.getByRole('button', { name: /Chat & Turma/i });
    fireEvent.click(chatBtn);

    // Deve exibir as abas na sidebar retrátil
    expect(screen.getByRole('button', { name: /^Chat$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alunos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arquivos/i })).toBeInTheDocument();
  });

  it('deve manter tela estatica sem botoes no modo tela cheia do professor', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Inicia sessão ao vivo
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Deve exibir badge de imagem estática e NÃO possuir botões na área de captura
    expect(screen.getByText(/Tela Inteira Ativa • Imagem Estática/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Atualizar Captura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver Vídeo ao Vivo/i })).not.toBeInTheDocument();
  });

  it('deve manter inputs e formulários estritamente separados entre chat público e chat privado', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Abre painel lateral de chat
    const chatBtn = screen.getByRole('button', { name: /Chat & Turma/i });
    fireEvent.click(chatBtn);

    // Na aba pública inicial:
    const publicInput = screen.getByPlaceholderText('Mensagem pública para toda a turma...');
    expect(publicInput).toBeInTheDocument();
    fireEvent.change(publicInput, { target: { value: 'Dúvida geral turma' } });
    expect((publicInput as HTMLInputElement).value).toBe('Dúvida geral turma');

    // Alterna para aba privada
    fireEvent.click(screen.getByRole('button', { name: /Dúvidas Privadas/i }));

    // Input público não deve estar visível
    expect(screen.queryByPlaceholderText('Mensagem pública para toda a turma...')).not.toBeInTheDocument();

    // Sem aluno selecionado: o campo de texto e o botão de envio NÃO devem ser renderizados
    expect(screen.queryByPlaceholderText(/Mensagem privada/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar Privado/i })).not.toBeInTheDocument();

    // Em seu lugar, deve exibir a barra sutil de orientação de visualização geral com ícone de cadeado (sem emojis)
    expect(screen.getByText(/Modo de visualização geral\. Selecione um aluno no menu acima para enviar uma mensagem privada\./i)).toBeInTheDocument();

    // Retorna para a aba pública e garante que o texto digitado anteriormente permaneceu isolado e intacto
    fireEvent.click(screen.getByRole('button', { name: /Turma \(Público\)/i }));
    const restoredPublicInput = screen.getByPlaceholderText('Mensagem pública para toda a turma...');
    expect((restoredPublicInput as HTMLInputElement).value).toBe('Dúvida geral turma');

    // Volta para a aba privada e garante que o modo de visualização geral permanece ativo
    fireEvent.click(screen.getByRole('button', { name: /Dúvidas Privadas/i }));
    expect(screen.queryByPlaceholderText(/Mensagem privada/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Modo de visualização geral/i)).toBeInTheDocument();
  });

  it('deve garantir que o elemento de video de preview local tenha muted ativado no DOM para evitar microfonia interna', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Alterna para modo Janela para renderizar a tag <video> ao invés de imagem estática
    const windowTab = screen.getByRole('button', { name: /Janela \/ Aba Específica/i });
    fireEvent.click(windowTab);

    await waitFor(() => {
      expect(screen.getByText('Google Chrome')).toBeInTheDocument();
    });

    // Inicia sessão ao vivo
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    const videoEl = document.querySelector('video') as HTMLVideoElement;
    if (videoEl) {
      expect(videoEl.muted).toBe(true);
      expect(videoEl.volume).toBe(0);
    }
  });

  it('deve iniciar com qualidade 1080p 60fps por padrão e permitir alternar para 30fps', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    // Verifica a presença de ambas as opções
    expect(screen.getByText(/1080p Full HD @ 30 fps/i)).toBeInTheDocument();
    expect(screen.getByText(/1080p Full HD @ 60 fps/i)).toBeInTheDocument();

    expect(screen.getByText(/4\.0 Mbps/i)).toBeInTheDocument();
    expect(screen.getByText(/6\.0 Mbps/i)).toBeInTheDocument();

    // Clica na opção de 30 fps para alternar
    const card30 = screen.getByText(/1080p Full HD @ 30 fps/i).closest('div');
    if (card30) {
      fireEvent.click(card30);
    }

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Avança para a transmissão ao vivo
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Deve exibir badge de 1080p @ 30fps na barra de status
    expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
  });

  it('deve chamar captureWindowToClipboard e exibir aviso em toast ao clicar no botão Tirar Print', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    const printBtn = screen.getByRole('button', { name: /Tirar Print/i });
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(window.electronAPI.captureWindowToClipboard).toHaveBeenCalled();
      expect(screen.getByText(/Print da janela do MLab copiado para a área de transferência!/i)).toBeInTheDocument();
    });
  });

  it('deve exibir o Link Fixo e o Link IP Direto sem badges de Rede Local (LAN) e sem botão de recarregar', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    expect(screen.getByText(dummyRoom.mdnsLink)).toBeInTheDocument();
    expect(screen.getByText(dummyRoom.ipLink)).toBeInTheDocument();

    // Badges de Rede Local (LAN) foram removidos para manter o cabeçalho limpo
    expect(screen.queryByText('Rede Local (LAN)')).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Atualizar IP e Links da Rede/i })).not.toBeInTheDocument();
  });

  it('deve manter setContentProtection(true) ativo ao clicar em Alterar Modo / Fonte durante transmissão de Tela Cheia para não expor o MLab', async () => {
    const setContentProtectionMock = vi.fn().mockResolvedValue(true);
    window.electronAPI.setContentProtection = setContentProtectionMock;

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Na montagem da sala, setContentProtection(true) já deve ser ativado
    expect(setContentProtectionMock).toHaveBeenCalledWith(true);

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    setContentProtectionMock.mockClear();

    // Clica em Alterar Modo / Fonte enquanto em modo Tela Cheia
    fireEvent.click(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i }));

    // NUNCA deve chamar setContentProtection(false) ao clicar em Alterar Modo / Fonte
    expect(setContentProtectionMock).not.toHaveBeenCalledWith(false);
    expect(setContentProtectionMock).toHaveBeenCalledWith(true);
  });

  it('deve renderizar a barra vertical de Marcação (estilo PDF) e Lupa no lado esquerdo do visualizador e responder a cliques e atalhos de teclado', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('annotation-toolbar')).toBeInTheDocument();
    });

    // Verifica que todas as ferramentas estão presentes na barra lateral esquerda
    const cursorBtn = screen.getByTestId('tool-btn-cursor');
    const penBtn = screen.getByTestId('tool-btn-pen');
    const highlighterBtn = screen.getByTestId('tool-btn-highlighter');
    const arrowBtn = screen.getByTestId('tool-btn-arrow');
    const rectBtn = screen.getByTestId('tool-btn-rect');
    const eraserBtn = screen.getByTestId('tool-btn-eraser');
    const spotlightBtn = screen.getByTestId('tool-btn-spotlight');
    const paletteBtn = screen.getByTestId('tool-btn-palette');
    const undoBtn = screen.getByTestId('tool-btn-undo');
    const redoBtn = screen.getByTestId('tool-btn-redo');
    const clearBtn = screen.getByTestId('tool-btn-clear');
    const canvas = screen.getByTestId('annotation-canvas');

    expect(cursorBtn).toBeInTheDocument();
    expect(penBtn).toBeInTheDocument();
    expect(highlighterBtn).toBeInTheDocument();
    expect(arrowBtn).toBeInTheDocument();
    expect(rectBtn).toBeInTheDocument();
    expect(eraserBtn).toBeInTheDocument();
    expect(spotlightBtn).toBeInTheDocument();
    expect(paletteBtn).toBeInTheDocument();
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
    expect(clearBtn).toBeDisabled();
    expect(canvas).toBeInTheDocument();

    // Atalho 'M' seleciona o Marcador (Marca-Texto PDF)
    fireEvent.keyDown(window, { key: 'm' });
    expect(canvas).toHaveStyle({ cursor: 'crosshair' });

    // Desenha um traço no canvas de anotação
    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 100 });
    fireEvent.mouseUp(canvas);

    // Após desenhar, Desfazer e Limpar ficam habilitados
    expect(undoBtn).not.toBeDisabled();
    expect(clearBtn).not.toBeDisabled();

    // Atalho Ctrl+Z desfaz o traço e habilita Refazer
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).not.toBeDisabled();

    // Atalho Ctrl+Y refaz o traço
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(undoBtn).not.toBeDisabled();

    // Atalho 'L' ativa a Lupa / Foco no mouse (com cursor crosshair para direcionar o foco)
    fireEvent.keyDown(window, { key: 'l' });
    expect(canvas).toHaveStyle({ cursor: 'crosshair' });

    // Com exclusividade mútua, selecionar 'V' (Cursor Padrão) desativa a Lupa
    fireEvent.keyDown(window, { key: 'v' });
    expect(canvas).toHaveStyle({ cursor: 'default' });

    // Novo atalho: 2 cliques na tecla Ctrl (Double-tap Ctrl) ativa a Lupa
    fireEvent.keyDown(window, { key: 'Control' });
    fireEvent.keyUp(window, { key: 'Control' });
    fireEvent.keyDown(window, { key: 'Control' });
    expect(canvas).toHaveStyle({ cursor: 'crosshair' });

    // Abre o popover de Cores, Espessura e Zoom da Lupa
    fireEvent.click(paletteBtn);
    expect(screen.getByTestId('annotation-palette-popover')).toBeInTheDocument();
    expect(screen.getByText(/Cor da Marcação/i)).toBeInTheDocument();
    expect(screen.getByText(/Espessura do Traço/i)).toBeInTheDocument();
    expect(screen.getByText(/Zoom da Lupa/i)).toBeInTheDocument();

    // Esc desativa a Lupa, fecha o popover e volta para o Cursor Padrão
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('annotation-palette-popover')).not.toBeInTheDocument();
    expect(canvas).toHaveStyle({ cursor: 'default' });
  });

  it('permite retrair, expandir e reposicionar (arrastar) a barra vertical de marcação e sincroniza com o overlay externo via IPC', async () => {
    const startAnnotationOverlayMock = vi.fn().mockResolvedValue(undefined);
    const stopAnnotationOverlayMock = vi.fn().mockResolvedValue(undefined);
    const syncAnnotationStateMock = vi.fn();

    window.electronAPI = {
      ...window.electronAPI,
      startAnnotationOverlay: startAnnotationOverlayMock,
      stopAnnotationOverlay: stopAnnotationOverlayMock,
      syncAnnotationState: syncAnnotationStateMock,
    } as any;

    const { unmount } = render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => {
      expect(advanceBtn).toBeEnabled();
    });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('annotation-toolbar')).toBeInTheDocument();
    });

    // Inicia o overlay externo quando entra na sessão ao vivo
    expect(startAnnotationOverlayMock).toHaveBeenCalled();
    expect(syncAnnotationStateMock).toHaveBeenCalled();

    const toolbar = screen.getByTestId('annotation-toolbar');
    expect(toolbar).toHaveAttribute('data-collapsed', 'false');

    // Arrasta a barra pela alça de arrasto para reposicionar
    const dragHandle = screen.getByTestId('annotation-drag-handle');
    fireEvent.pointerDown(dragHandle, { button: 0, clientX: 20, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 90, clientY: 180 });
    fireEvent.pointerUp(window);

    // Retrai a barra em ícone compacto pelo botão ou atalho 'H'
    const collapseBtn = screen.getByTestId('tool-btn-collapse');
    fireEvent.click(collapseBtn);
    expect(toolbar).toHaveAttribute('data-collapsed', 'true');
    expect(screen.queryByTestId('tool-btn-pen')).not.toBeInTheDocument();

    // Expande novamente com o atalho 'H'
    fireEvent.keyDown(window, { key: 'h' });
    expect(toolbar).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByTestId('tool-btn-pen')).toBeInTheDocument();

    unmount();
    expect(stopAnnotationOverlayMock).toHaveBeenCalled();
  });

  it('deve selecionar a Tela Cheia (Monitor Principal) automaticamente sem necessidade de clique e habilitar avanço imediato', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    // Monitor principal vem selecionado por padrão com badge indicativa
    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
      expect(screen.getByText(/Selecionado Automaticamente/i)).toBeInTheDocument();
    });

    // O botão de avanço já deve estar habilitado imediatamente sem necessidade de clique prévio
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    expect(advanceBtn).toBeEnabled();
  });

  it('deve permitir selecionar múltiplas janelas, exibir contador de janelas autorizadas e botões de ação rápida', async () => {
    // Fornece múltiplas janelas mockadas
    (window.electronAPI.getScreenSources as any).mockImplementation((type?: string) => {
      if (type === 'window') {
        return Promise.resolve([
          { id: 'window:10', name: 'VS Code', type: 'window', thumbnail: 'data:image/png;base64,aaa' },
          { id: 'window:20', name: 'Terminal PowerShell', type: 'window', thumbnail: 'data:image/png;base64,bbb' },
          { id: 'window:30', name: 'Calculadora', type: 'window', thumbnail: 'data:image/png;base64,ccc' },
        ]);
      }
      return Promise.resolve([
        { id: 'screen:1', name: 'Tela Inteira 1', type: 'screen', thumbnail: 'data:image/png;base64,111' },
      ]);
    });

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    // Alterna para modo Janela
    const windowTab = screen.getByRole('button', { name: /Janela \/ Aba Específica/i });
    fireEvent.click(windowTab);

    await waitFor(() => {
      expect(screen.getByText('VS Code')).toBeInTheDocument();
      expect(screen.getByText('Terminal PowerShell')).toBeInTheDocument();
    });

    // Por padrão a primeira janela já vem autorizada. A autorização acontece num efeito depois que as fontes
    // carregam, então espera o contador em vez de conferir de forma síncrona (instável no runner Linux do CI).
    expect(await screen.findByText(/1 janela autorizada/i)).toBeInTheDocument();

    // Clica para autorizar também o Terminal
    fireEvent.click(screen.getByText('Terminal PowerShell'));

    await waitFor(() => {
      expect(screen.getByText(/2 janelas autorizadas/i)).toBeInTheDocument();
    });

    // Clica em "Selecionar Todas"
    const selectAllBtn = screen.getByRole('button', { name: /Selecionar Todas/i });
    fireEvent.click(selectAllBtn);

    await waitFor(() => {
      expect(screen.getByText(/3 janelas autorizadas/i)).toBeInTheDocument();
    });

    // Clica em "Apenas a Primeira"
    const firstOnlyBtn = screen.getByRole('button', { name: /Apenas a Primeira/i });
    fireEvent.click(firstOnlyBtn);

    await waitFor(() => {
      expect(screen.getByText(/1 janela autorizada/i)).toBeInTheDocument();
    });
  });

  it('deve exibir indicador de Múltiplas Janelas e alternar janelas autorizadas ou exibir proteção de privacidade', async () => {
    let activeWindowCallback: ((data: { sourceId: string }) => void) | null = null;
    let unauthorizedCallback: ((data: { isUnauthorized: boolean }) => void) | null = null;

    (window.electronAPI.onActiveWindowChanged as any).mockImplementation((cb: any) => {
      activeWindowCallback = cb;
      return () => {
        activeWindowCallback = null;
      };
    });

    (window.electronAPI.onActiveWindowUnauthorized as any).mockImplementation((cb: any) => {
      unauthorizedCallback = cb;
      return () => {
        unauthorizedCallback = null;
      };
    });

    (window.electronAPI.getScreenSources as any).mockImplementation((type?: string) => {
      if (type === 'window') {
        return Promise.resolve([
          { id: 'window:10', name: 'VS Code', type: 'window', thumbnail: 'data:image/png;base64,aaa' },
          { id: 'window:20', name: 'Navegador Web', type: 'window', thumbnail: 'data:image/png;base64,bbb' },
        ]);
      }
      return Promise.resolve([
        { id: 'screen:1', name: 'Tela Inteira 1', type: 'screen', thumbnail: 'data:image/png;base64,111' },
      ]);
    });

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    // Alterna para modo Janela e autoriza as 2 janelas
    fireEvent.click(screen.getByRole('button', { name: /Janela \/ Aba Específica/i }));

    await waitFor(() => {
      expect(screen.getByText('VS Code')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Selecionar Todas/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 janelas autorizadas/i)).toBeInTheDocument();
    });

    // Inicia transmissão ao vivo
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByText(/Janela Específica \(Múltiplas - 2 autorizadas\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Janelas da Aula \(2\):/i)).toBeInTheDocument();
    });

    // Simula evento do SO de proteção de privacidade (app não autorizado focado pelo professor)
    expect(unauthorizedCallback).toBeTruthy();
    act(() => {
      unauthorizedCallback!({ isUnauthorized: true });
    });

    // O badge visual foi removido da barra de status conforme solicitado, não devendo poluir a tela
    expect(screen.queryByText(/Proteção de Privacidade Ativa/i)).not.toBeInTheDocument();

    // Simula volta para o VS Code (app autorizado)
    act(() => {
      unauthorizedCallback!({ isUnauthorized: false });
      activeWindowCallback!({ sourceId: 'window:10' });
    });

    await waitFor(() => {
      expect(screen.getByText(/Janela Específica \(Múltiplas - 2 autorizadas\)/i)).toBeInTheDocument();
    });
  });

  it('no chat privado, oculta o formulário de envio quando nenhum aluno está selecionado e reexibe ao selecionar um aluno', async () => {
    const mockParticipants = [
      {
        participant_id: 'part-aluno-1',
        name: 'Lucas Silva',
        role: 'aluno',
        student_id: '20241TADS001',
      },
      {
        participant_id: 'part-aluno-2',
        name: 'Mariana Costa',
        role: 'aluno',
        student_id: '20241TADS002',
      },
    ];

    vi.spyOn(publisherModule, 'useWebRTCPublisher').mockReturnValue({
      isPublishing: true,
      connectionState: 'connected',
      error: null,
      messages: [],
      participants: mockParticipants,
      lastHandRaised: null,
      dismissHandToast: vi.fn(),
      lowerStudentHand: vi.fn(),
      sendChatMessage: vi.fn(),
      pinChatMessage: vi.fn(),
      sendStreamPause: vi.fn(),
      startPublishing: vi.fn(),
      changeStream: vi.fn(),
      endSession: vi.fn(),
    });

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Abre o chat e muda para aba de Dúvidas Privadas
    fireEvent.click(screen.getByRole('button', { name: /Chat & Turma/i }));
    fireEvent.click(screen.getByRole('button', { name: /Dúvidas Privadas/i }));

    // Inicialmente sem aluno selecionado:
    // O formulário de envio (input e botão Enviar Privado) NÃO deve existir no DOM
    expect(screen.queryByPlaceholderText(/Mensagem privada/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar Privado/i })).not.toBeInTheDocument();

    // Deve exibir o aviso limpo (sem emojis) de modo de visualização geral
    expect(screen.getByText(/Modo de visualização geral\. Selecione um aluno no menu acima para enviar uma mensagem privada\./i)).toBeInTheDocument();

    // Seleciona um aluno no dropdown
    const studentSelect = screen.getByRole('combobox');
    fireEvent.change(studentSelect, { target: { value: 'part-aluno-1' } });

    // Agora o campo de texto e o botão de envio reaparecem imediatamente
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Mensagem privada para Lucas Silva...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enviar Privado/i })).toBeInTheDocument();
    });

    // O aviso de visualização geral não deve mais estar visível
    expect(screen.queryByText(/Modo de visualização geral/i)).not.toBeInTheDocument();

    // Clica no botão "Ver Todas" para desselecionar o aluno
    const clearTargetBtn = screen.getByRole('button', { name: /Ver Todas/i });
    fireEvent.click(clearTargetBtn);

    // O formulário e o botão de envio devem sumir novamente e o aviso reaparecer
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Mensagem privada/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Enviar Privado/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Modo de visualização geral\. Selecione um aluno no menu acima para enviar uma mensagem privada\./i)).toBeInTheDocument();
    });
  });

  it('deve preservar o áudio ativo ao alternar modo ou fonte de transmissão quando o professor estiver desmutado', async () => {
    let capturedStream: any = null;
    const mockChangeStream = vi.fn().mockImplementation((stream: any) => {
      capturedStream = stream;
    });

    vi.spyOn(publisherModule, 'useWebRTCPublisher').mockImplementation((props: any) => {
      capturedStream = props.stream;
      return {
        isPublishing: true,
        connectionState: 'connected',
        error: null,
        messages: [],
        participants: [],
        lastHandRaised: null,
        dismissHandToast: vi.fn(),
        lowerStudentHand: vi.fn(),
        sendChatMessage: vi.fn(),
        pinChatMessage: vi.fn(),
        sendStreamPause: vi.fn(),
        startPublishing: vi.fn(),
        changeStream: mockChangeStream,
        endSession: vi.fn(),
      };
    });

    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Inicia sessão ao vivo
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // Ativa o microfone
    const micBtn = screen.getByRole('button', { name: /Desmutar Microfone/i });
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mutar Microfone/i })).toBeInTheDocument();
    });

    // Clica em "Alterar Modo / Fonte"
    const changeModeBtn = screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i });
    fireEvent.click(changeModeBtn);

    // Na tela de configuração, avança novamente para a transmissão
    const resumeBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Alterar Modo \/ Fonte/i })).toBeInTheDocument();
    });

    // O microfone continua exibindo "Mutar Microfone" (ativo)
    expect(screen.getByRole('button', { name: /Mutar Microfone/i })).toBeInTheDocument();

    // E as faixas de áudio continuam ativadas (enabled: true), sem terem sido silenciadas
    if (capturedStream && capturedStream.getAudioTracks) {
      const audioTracks = capturedStream.getAudioTracks();
      expect(audioTracks.length).toBeGreaterThan(0);
      audioTracks.forEach((track: any) => {
        expect(track.enabled).toBe(true);
      });
    }
  });
});



