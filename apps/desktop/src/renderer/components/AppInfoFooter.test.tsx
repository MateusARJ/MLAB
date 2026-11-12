import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AppInfoFooter } from './AppInfoFooter';

const info = {
  name: 'MLab',
  version: '9.8.7',
  description: 'Plataforma de transmissão de tela e interação para aulas ao vivo',
  copyright: 'Copyright © 2026 MLab',
};

describe('AppInfoFooter', () => {
  afterEach(() => {
    vi.mocked(window.electronAPI.getAppInfo).mockReset().mockResolvedValue(info);
  });

  it('mostra a versão no rodapé (RF-2101)', async () => {
    render(<AppInfoFooter />);
    expect(await screen.findByText('MLab v9.8.7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sobre' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre o diálogo Sobre com nome, versão, descrição e copyright (RF-2102, RNF-2104)', async () => {
    render(<AppInfoFooter />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sobre' }));

    const dialog = screen.getByRole('dialog', { name: 'MLab' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Versão 9.8.7')).toBeInTheDocument();
    expect(screen.getByText(info.description)).toBeInTheDocument();
    expect(screen.getByText(info.copyright)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('fecha pelo botão Fechar (RF-2103)', async () => {
    render(<AppInfoFooter />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sobre' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fecha pela tecla Esc (RF-2103)', async () => {
    render(<AppInfoFooter />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sobre' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('não renderiza nada quando o IPC falha (RF-2107)', async () => {
    vi.mocked(window.electronAPI.getAppInfo).mockRejectedValueOnce(new Error('canal indisponível'));
    const { container } = render(<AppInfoFooter />);
    await waitFor(() => expect(window.electronAPI.getAppInfo).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
