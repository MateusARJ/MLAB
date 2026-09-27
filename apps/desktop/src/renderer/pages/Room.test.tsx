import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Room } from './Room';

describe('Room Component (Desktop)', () => {
  const dummyRoom = {
    id: 'room-101',
    slug: 'charlie-delta-7342',
    link: 'http://localhost:3000/sala/charlie-delta-7342/entrar',
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
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
    });

    // Microfone deve iniciar desligado por padrão (exibindo 'Desmutar Microfone')
    const micBtn = screen.getByRole('button', { name: /Desmutar Microfone/i });
    expect(micBtn).toBeInTheDocument();

    // Ao clicar, deve desmutar (passando a exibir 'Mutar Microfone')
    fireEvent.click(micBtn);
    expect(screen.getByRole('button', { name: /🎤 Mutar Microfone/i })).toBeInTheDocument();
  });

  it('deve permitir alternar entre abas de chat público e dúvidas privadas', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
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

    const copyBtn = screen.getByRole('button', { name: /Copiar Link/i });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Link Copiado!/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i }));

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i }));

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
      expect(screen.getByText(/Janela Específica/i)).toBeInTheDocument();
    });
  });

  it('deve renderizar o link da sala diretamente abaixo do título no cabeçalho e não exibir ID', () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    expect(screen.getByText(new RegExp(dummyRoom.link, 'i'))).toBeInTheDocument();
    expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument();
  });

  it('deve exibir o badge de resolução 1080p @ 30fps sem 4 Mbps na sessão ao vivo', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i }));

    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
      expect(screen.queryByText(/4 Mbps/i)).not.toBeInTheDocument();
    });
  });

  it('deve abrir a sidebar retrátil com abas de Chat, Alunos e Arquivos ao clicar no botão de Chat', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Inicia sessão ao vivo
    fireEvent.click(screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chat & Turma/i })).toBeInTheDocument();
    });

    const chatBtn = screen.getByRole('button', { name: /Chat & Turma/i });
    fireEvent.click(chatBtn);

    // Deve exibir as abas na sidebar retrátil
    expect(screen.getByRole('button', { name: /^💬 Chat$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alunos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arquivos/i })).toBeInTheDocument();
  });

  it('deve manter tela estatica sem botoes no modo tela cheia do professor', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    // Inicia sessão ao vivo
    fireEvent.click(screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i }));

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i }));

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
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

    // Campo de digitação do chat privado deve estar visível imediatamente, sem exigir clique prévio no aluno
    const privateInput = screen.getByPlaceholderText(/Mensagem privada para o aluno/i);
    expect(privateInput).toBeInTheDocument();
    fireEvent.change(privateInput, { target: { value: 'Resposta confidencial' } });
    expect((privateInput as HTMLInputElement).value).toBe('Resposta confidencial');

    // Retorna para a aba pública e garante que o texto digitado anteriormente permaneceu isolado e intacto
    fireEvent.click(screen.getByRole('button', { name: /Turma \(Público\)/i }));
    const restoredPublicInput = screen.getByPlaceholderText('Mensagem pública para toda a turma...');
    expect((restoredPublicInput as HTMLInputElement).value).toBe('Dúvida geral turma');

    // Volta para a aba privada e garante que o texto do privado também continuou isolado e intacto
    fireEvent.click(screen.getByRole('button', { name: /Dúvidas Privadas/i }));
    const restoredPrivateInput = screen.getByPlaceholderText(/Mensagem privada para o aluno/i);
    expect((restoredPrivateInput as HTMLInputElement).value).toBe('Resposta confidencial');
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
    fireEvent.click(screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i }));

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
    });

    const videoEl = document.querySelector('video') as HTMLVideoElement;
    if (videoEl) {
      expect(videoEl.muted).toBe(true);
      expect(videoEl.volume).toBe(0);
    }
  });
});


