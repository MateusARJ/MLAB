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

  it('deve exibir o botão de formato .webm em Alta Fidelidade em 1080p e não conter .mp4', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const webmBtn = screen.getByRole('button', { name: /\.webm \(Alta Fidelidade em 1080p\)/i });
    expect(webmBtn).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /\.mp4/i })).not.toBeInTheDocument();
  });

  it('deve alternar para modo Janela e carregar fontes filtradas', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const windowTab = screen.getByRole('button', { name: /Janela \/ Aba Específica/i });
    fireEvent.click(windowTab);

    await waitFor(() => {
      expect(window.electronAPI.getScreenSources).toHaveBeenCalledWith('window');
      expect(screen.getByText('Google Chrome')).toBeInTheDocument();
    });
  });

  it('deve avançar para a sessão ao vivo e exibir controles ao clicar em Iniciar Transmissão', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mutar Microfone/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pausar Vídeo/i })).toBeInTheDocument();
      expect(screen.getByAltText(/Pré-visualização da Tela Cheia/i)).toBeInTheDocument();
    });
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
});

