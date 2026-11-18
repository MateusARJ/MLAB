import React, { useRef, useState } from 'react';
import type { UploadEntry } from '../hooks/useRoomFileUploads';
import { hasDraggedFiles } from '../utils/preventFileDropNavigation';

interface FileDropZoneProps {
  /** Recebe os arquivos e pastas soltos, na ordem em que vieram. */
  onFiles: (entries: UploadEntry[]) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Lê os itens soltos. Pastas são identificadas por `webkitGetAsEntry()` e não são enviadas
 * (018, RF-186, C-185). Precisa ser chamado durante o próprio `drop`: depois disso o navegador esvazia
 * o `DataTransfer`.
 */
export function entriesFromDataTransfer(dataTransfer: DataTransfer | null): UploadEntry[] {
  if (!dataTransfer) return [];
  const items = dataTransfer.items ? Array.from(dataTransfer.items).filter((item) => item.kind === 'file') : [];
  if (items.length > 0) {
    const entries: UploadEntry[] = [];
    for (const item of items) {
      const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (entry?.isDirectory) {
        entries.push({ name: entry.name, isDirectory: true });
        continue;
      }
      const file = item.getAsFile();
      if (file) entries.push(file);
    }
    return entries;
  }
  return Array.from(dataTransfer.files ?? []);
}

/**
 * Zona de soltar arquivos da aba Arquivos (018-arquivos-arrastar, RF-181, RF-182).
 * Mostra "Solte para compartilhar" enquanto um arraste com arquivos está sobre a área e entrega os itens
 * soltos em `onFiles`. O `drop` não propaga até o `window`, onde fica o bloqueio global (RF-190).
 */
export const FileDropZone: React.FC<FileDropZoneProps> = ({ onFiles, children, style }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  // Conta entradas e saídas para o destaque não piscar ao passar por elementos filhos.
  const depthRef = useRef(0);

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    depthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    depthRef.current = 0;
    setIsDragActive(false);
    const entries = entriesFromDataTransfer(event.dataTransfer);
    if (entries.length > 0) {
      onFiles(entries);
    }
  };

  return (
    <div
      data-testid="file-drop-zone"
      style={{ ...style, position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragActive && (
        <div data-testid="file-drop-overlay" style={overlayStyle} aria-hidden="true">
          <span style={overlayTextStyle}>Solte para compartilhar</span>
        </div>
      )}
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px dashed var(--accent)',
  borderRadius: 'var(--r-control)',
  backgroundColor: 'var(--surface-float)',
  pointerEvents: 'none',
  zIndex: 5,
};

const overlayTextStyle: React.CSSProperties = {
  color: 'var(--accent)',
  fontSize: 'var(--fs-small)',
  fontWeight: 700,
};
