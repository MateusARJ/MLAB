import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Room } from './Room';

describe('Room Component (Desktop)', () => {
  const dummyRoom = {
    id: 'room-101',
    slug: 'charlie-delta-7342',
    link: 'http://localhost:3000/sala/charlie-delta-7342/entrar',
  };

  it('deve listar as fontes de tela retornadas pelo desktopCapturer mock', async () => {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tela Inteira 1')).toBeInTheDocument();
      expect(screen.getByText('Google Chrome')).toBeInTheDocument();
    });
  });

  it('deve chamar onCloseRoom ao clicar em Encerrar Transmissao', () => {
    const handleClose = vi.fn();
    render(<Room room={dummyRoom} onCloseRoom={handleClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Encerrar Transmissão/i }));
    expect(handleClose).toHaveBeenCalled();
  });
});
