import { useCallback, useEffect, useRef, useState } from 'react';
import {
  uploadRoomFile,
  isBlockedFileName,
  MAX_FILE_BYTES,
  FILE_TOO_LARGE_MSG,
  BLOCKED_TYPE_MSG,
  UPLOAD_ERROR_MSG,
  type RoomFile,
} from '../services/files';

/** Estado de um item da fila de envio (018, RF-184). */
export type UploadStatus = 'aguardando' | 'enviando' | 'enviado' | 'erro';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  error?: string;
}

/** Pasta solta na zona: não é enviada (018, RF-186, C-185). */
export interface DroppedFolder {
  name: string;
  isDirectory: true;
}

export type UploadEntry = File | DroppedFolder;

export const FOLDER_NOT_SUPPORTED_MSG = 'pastas não são suportadas';

/** Tempo até o item enviado sair da lista de envio (mesmo tempo do antigo banner de sucesso). */
export const UPLOAD_SUCCESS_TTL_MS = 5000;

interface UseRoomFileUploadsOptions {
  roomId: string;
  token: string;
  onUploaded: (file: RoomFile) => void;
}

function isFolder(entry: UploadEntry): entry is DroppedFolder {
  return (entry as DroppedFolder).isDirectory === true;
}

/**
 * Fila de envio de arquivos da sala (018-arquivos-arrastar, RF-183 a RF-187):
 * - envia um arquivo por vez, na ordem recebida;
 * - pastas e arquivos acima de 50 MB viram erro sem requisição;
 * - o erro de um item não interrompe a fila;
 * - itens enfileirados durante o envio entram no fim;
 * - itens enviados saem após 5 s; erros ficam até `dismiss` ou até o próximo lote.
 */
export function useRoomFileUploads({ roomId, token, onUploaded }: UseRoomFileUploadsOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const queueRef = useRef<Array<{ id: string; file: File }>>([]);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const nextIdRef = useRef(0);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latestRef = useRef({ roomId, token, onUploaded });
  latestRef.current = { roomId, token, onUploaded };

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      queueRef.current = [];
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    if (!mountedRef.current) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    if (!mountedRef.current) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (mountedRef.current && queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        updateItem(next.id, { status: 'enviando' });
        const { roomId: currentRoomId, token: currentToken } = latestRef.current;
        try {
          const uploaded = await uploadRoomFile(currentRoomId, next.file, currentToken);
          if (!mountedRef.current) break;
          updateItem(next.id, { status: 'enviado' });
          latestRef.current.onUploaded(uploaded);
          timersRef.current.set(
            next.id,
            setTimeout(() => removeItem(next.id), UPLOAD_SUCCESS_TTL_MS)
          );
        } catch (err) {
          const message = err instanceof Error && err.message ? err.message : UPLOAD_ERROR_MSG;
          updateItem(next.id, { status: 'erro', error: message });
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [removeItem, updateItem]);

  const enqueue = useCallback(
    (entries: UploadEntry[]) => {
      if (!entries || entries.length === 0) return;
      // Fila parada: um lote novo começa e os erros do lote anterior saem (C-188).
      const startsNewBatch = !processingRef.current && queueRef.current.length === 0;

      const newItems: UploadItem[] = entries.map((entry) => {
        const id = `upload-${++nextIdRef.current}`;
        if (isFolder(entry)) {
          return { id, name: entry.name, size: 0, status: 'erro', error: FOLDER_NOT_SUPPORTED_MSG };
        }
        // Executável ou instalador: recusado sem envio, com a mensagem do servidor (022, RF-2206).
        if (isBlockedFileName(entry.name)) {
          return { id, name: entry.name, size: entry.size, status: 'erro', error: BLOCKED_TYPE_MSG };
        }
        if (entry.size > MAX_FILE_BYTES) {
          return { id, name: entry.name, size: entry.size, status: 'erro', error: FILE_TOO_LARGE_MSG };
        }
        queueRef.current.push({ id, file: entry });
        return { id, name: entry.name, size: entry.size, status: 'aguardando' };
      });

      setItems((prev) => [...(startsNewBatch ? prev.filter((item) => item.status !== 'erro') : prev), ...newItems]);
      void processQueue();
    },
    [processQueue]
  );

  const dismiss = useCallback((id: string) => removeItem(id), [removeItem]);

  const isUploading = items.some((item) => item.status === 'enviando');

  return { items, enqueue, dismiss, isUploading };
}
