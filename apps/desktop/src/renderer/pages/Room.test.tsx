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

  it('deve alternar entre formatos de gravação (.webm e .mp4)', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
    });

    const mp4Btn = screen.getByRole('button', { name: /\.mp4/i });
    fireEvent.click(mp4Btn);
    expect(mp4Btn).toBeInTheDocument();

    const webmBtn = screen.getByRole('button', { name: /\.webm/i });
    fireEvent.click(webmBtn);
    expect(webmBtn).toBeInTheDocument();
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

