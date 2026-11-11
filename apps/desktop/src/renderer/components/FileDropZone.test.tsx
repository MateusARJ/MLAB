import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileDropZone, entriesFromDataTransfer } from './FileDropZone';

function fileItem(file: File) {
  return { kind: 'file', getAsFile: () => file, webkitGetAsEntry: () => ({ isDirectory: false, name: file.name }) };
}

function folderItem(name: string) {
  return { kind: 'file', getAsFile: () => null, webkitGetAsEntry: () => ({ isDirectory: true, name }) };
}

function dataTransfer(items: any[] = [], types: string[] = ['Files']) {
  return { types, items, files: items.map((i) => i.getAsFile()).filter(Boolean), dropEffect: 'none' };
}

function renderZone(onFiles = vi.fn()) {
  render(
    <FileDropZone onFiles={onFiles}>
      <div data-testid="child">
        <span data-testid="grandchild">conteúdo</span>
      </div>
    </FileDropZone>
  );
  return { onFiles, zone: screen.getByTestId('file-drop-zone') };
}

describe('FileDropZone', () => {
  it('mostra "Solte para compartilhar" com arquivos e some ao sair (RF-182)', () => {
    const { zone } = renderZone();
    expect(screen.queryByTestId('file-drop-overlay')).not.toBeInTheDocument();

    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer() });
    expect(screen.getByText('Solte para compartilhar')).toBeInTheDocument();

    fireEvent.dragLeave(zone, { dataTransfer: dataTransfer() });
    expect(screen.queryByTestId('file-drop-overlay')).not.toBeInTheDocument();
  });

  it('não pisca ao passar por elementos filhos', () => {
    const { zone } = renderZone();
    const child = screen.getByTestId('child');
    const grandchild = screen.getByTestId('grandchild');

    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer() });
    fireEvent.dragEnter(child, { dataTransfer: dataTransfer() });
    fireEvent.dragEnter(grandchild, { dataTransfer: dataTransfer() });
    fireEvent.dragLeave(grandchild, { dataTransfer: dataTransfer() });
    fireEvent.dragLeave(child, { dataTransfer: dataTransfer() });
    expect(screen.getByTestId('file-drop-overlay')).toBeInTheDocument();

    fireEvent.dragLeave(zone, { dataTransfer: dataTransfer() });
    expect(screen.queryByTestId('file-drop-overlay')).not.toBeInTheDocument();
  });

  it('ignora arrastes sem arquivos (texto ou link)', () => {
    const { zone, onFiles } = renderZone();

    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([], ['text/plain']) });
    expect(screen.queryByTestId('file-drop-overlay')).not.toBeInTheDocument();

    fireEvent.drop(zone, { dataTransfer: dataTransfer([], ['text/uri-list']) });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('entrega arquivos e pastas soltos, some com o destaque e não propaga o drop (RF-181)', () => {
    const windowDrop = vi.fn();
    window.addEventListener('drop', windowDrop);
    const { zone, onFiles } = renderZone();
    const a = new File(['a'], 'a.pdf');
    const b = new File(['b'], 'b.txt');

    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer() });
    const dropped = fireEvent.drop(zone, {
      dataTransfer: dataTransfer([fileItem(a), folderItem('fotos'), fileItem(b)]),
    });

    expect(dropped).toBe(false); // preventDefault
    expect(onFiles).toHaveBeenCalledWith([a, { name: 'fotos', isDirectory: true }, b]);
    expect(screen.queryByTestId('file-drop-overlay')).not.toBeInTheDocument();
    expect(windowDrop).not.toHaveBeenCalled();
    window.removeEventListener('drop', windowDrop);
  });

  it('cancela o dragover com arquivos para permitir o drop', () => {
    const { zone } = renderZone();
    const notCanceled = fireEvent.dragOver(zone, { dataTransfer: dataTransfer() });
    expect(notCanceled).toBe(false);
  });
});

describe('entriesFromDataTransfer', () => {
  it('usa dataTransfer.files quando não há items', () => {
    const a = new File(['a'], 'a.pdf');
    expect(entriesFromDataTransfer({ files: [a], items: undefined } as any)).toEqual([a]);
    expect(entriesFromDataTransfer(null)).toEqual([]);
  });

  it('ignora items que não são arquivos', () => {
    const a = new File(['a'], 'a.pdf');
    const textItem = { kind: 'string', getAsFile: () => null, webkitGetAsEntry: () => null };
    expect(entriesFromDataTransfer({ items: [textItem, fileItem(a)], files: [a] } as any)).toEqual([a]);
  });
});
