import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Room } from './Room';
import * as publisherModule from '../hooks/useWebRTCPublisher';

const UPLOAD_URL = 'http://localhost:8080/rooms/room-files-101/files';

function created(name: string) {
  return {
    ok: true,
    status: 201,
    json: () =>
      Promise.resolve({
        id: `id-${name}`,
        room_id: 'room-files-101',
        name,
        size: 2048,
        content_type: 'application/pdf',
        url: `/rooms/room-files-101/files/id-${name}/download`,
        uploaded_at: '2026-11-10T20:00:00Z',
      }),
  };
}

function okEmpty() {
  return { ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('') };
}

function fileItem(file: File) {
  return { kind: 'file', getAsFile: () => file, webkitGetAsEntry: () => ({ isDirectory: false, name: file.name }) };
}

function dropData(files: File[]) {
  return { types: ['Files'], items: files.map(fileItem), files, dropEffect: 'none' };
}

describe('Room — arrastar arquivos para a aba Arquivos (018)', () => {
  const dummyRoom = {
    id: 'room-files-101',
    slug: 'arquivos-101',
    link: 'http://localhost:3000/sala/arquivos-101/entrar',
  };

  let uploadResponses: Array<() => Promise<any>>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let publisherSpy: { mockRestore: () => void };

  beforeEach(() => {
    uploadResponses = [];
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === UPLOAD_URL && init?.method === 'POST') {
        const next = uploadResponses.shift();
        return next ? next() : Promise.resolve(okEmpty());
      }
      return Promise.resolve(okEmpty());
    });
    vi.stubGlobal('fetch', fetchMock);

    publisherSpy = vi.spyOn(publisherModule, 'useWebRTCPublisher').mockReturnValue({
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
      changeStream: vi.fn(),
      stopPublishing: vi.fn(),
      endSession: vi.fn(),
    } as any);
  });

  afterEach(() => {
    publisherSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  async function openFilesTab() {
    render(<Room room={dummyRoom} onCloseRoom={vi.fn()} />);
    const advanceBtn = screen.getByRole('button', { name: /Avançar e Iniciar Transmissão/i });
    await waitFor(() => expect(advanceBtn).toBeEnabled());
    fireEvent.click(advanceBtn);
    await waitFor(() => expect(screen.getByRole('button', { name: /Chat & Turma/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Chat & Turma/i }));
    fireEvent.click(screen.getByRole('button', { name: /Arquivos \(\d+\)/i }));
    return screen.getByTestId('file-drop-zone');
  }

  function uploadPosts() {
    return fetchMock.mock.calls.filter(([url, init]) => url === UPLOAD_URL && (init as RequestInit)?.method === 'POST');
  }

  function sharedList() {
    return screen.getByText('Arquivos Compartilhados Nesta Aula').parentElement as HTMLElement;
  }

  it('mostra o destaque ao arrastar arquivos sobre a aba (RF-181, RF-182)', async () => {
    const zone = await openFilesTab();

    fireEvent.dragEnter(zone, { dataTransfer: dropData([]) });
    expect(screen.getByText('Solte para compartilhar')).toBeInTheDocument();

    fireEvent.dragLeave(zone, { dataTransfer: dropData([]) });
    expect(screen.queryByText('Solte para compartilhar')).not.toBeInTheDocument();
  });

  it('envia um arquivo solto e o adiciona à lista da aula (RF-183, RF-189)', async () => {
    uploadResponses.push(() => Promise.resolve(created('aula.pdf')));
    const zone = await openFilesTab();

    fireEvent.drop(zone, { dataTransfer: dropData([new File(['%PDF'], 'aula.pdf')]) });

    await waitFor(() => expect(within(sharedList()).getByText('aula.pdf')).toBeInTheDocument());
    expect(screen.getByRole('status', { name: /Envio de arquivos/i })).toHaveTextContent('Enviado');
    expect(screen.getByRole('button', { name: /Arquivos \(1\)/i })).toBeInTheDocument();
    expect(uploadPosts()).toHaveLength(1);
  });

  it('envia vários arquivos em sequência com estado por arquivo e mostra o erro 413 (RF-184, RF-185)', async () => {
    let releaseFirst!: () => void;
    uploadResponses.push(
      () => new Promise((resolve) => { releaseFirst = () => resolve(created('a.pdf')); }),
      () =>
        Promise.resolve({
          ok: false,
          status: 413,
          json: () => Promise.resolve({ error: 'limite de arquivos da sala atingido' }),
        }),
      () => Promise.resolve(created('c.pdf'))
    );
    const zone = await openFilesTab();

    fireEvent.drop(zone, {
      dataTransfer: dropData([new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf'), new File(['c'], 'c.pdf')]),
    });

    const statuses = () => screen.getAllByTestId('upload-item').map((li) => li.getAttribute('data-status'));
    expect(statuses()).toEqual(['enviando', 'aguardando', 'aguardando']);
    expect(screen.getByRole('button', { name: /Enviando Arquivo/i })).toBeDisabled();
    expect(uploadPosts()).toHaveLength(1);

    releaseFirst();

    await waitFor(() => expect(statuses()).toEqual(['enviado', 'erro', 'enviado']));
    expect(screen.getByText('limite de arquivos da sala atingido')).toBeInTheDocument();
    expect(within(sharedList()).getByText('a.pdf')).toBeInTheDocument();
    expect(within(sharedList()).getByText('c.pdf')).toBeInTheDocument();
    expect(within(sharedList()).queryByText('b.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compartilhar Novo Arquivo/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Dispensar b.pdf' }));
    expect(screen.queryByText('limite de arquivos da sala atingido')).not.toBeInTheDocument();
  });

  it('o botão aceita vários arquivos e usa a mesma fila (RF-188)', async () => {
    uploadResponses.push(
      () => Promise.resolve(created('x.pdf')),
      () => Promise.resolve(created('y.pdf'))
    );
    await openFilesTab();

    const input = screen.getByTestId('room-file-input') as HTMLInputElement;
    expect(input).toHaveAttribute('multiple');
    expect(screen.getByRole('button', { name: /Compartilhar Novo Arquivo/i })).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [new File(['x'], 'x.pdf'), new File(['y'], 'y.pdf')] } });

    await waitFor(() => expect(within(sharedList()).getByText('y.pdf')).toBeInTheDocument());
    expect(within(sharedList()).getByText('x.pdf')).toBeInTheDocument();
    expect(uploadPosts()).toHaveLength(2);
  });

  it('rola a lista da aula até o último arquivo enviado, como o chat (RF-191)', async () => {
    const scrolled: Element[] = [];
    const original = (Element.prototype as any).scrollIntoView;
    (Element.prototype as any).scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      uploadResponses.push(() => Promise.resolve(created('aula.pdf')));
      const zone = await openFilesTab();
      const end = screen.getByTestId('uploaded-files-end');
      const before = scrolled.filter((el) => el === end).length;

      fireEvent.drop(zone, { dataTransfer: dropData([new File(['%PDF'], 'aula.pdf')]) });

      await waitFor(() => expect(within(sharedList()).getByText('aula.pdf')).toBeInTheDocument());
      expect(scrolled.filter((el) => el === end).length).toBeGreaterThan(before);
      const last = within(sharedList()).getByText('aula.pdf');
      expect(last.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      (Element.prototype as any).scrollIntoView = original;
    }
  });
});
