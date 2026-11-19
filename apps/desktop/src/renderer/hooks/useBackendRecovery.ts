import { useEffect, useRef, useState } from 'react';
import type { CreateRoomResponse } from '@mlab/types';
import { startProfessorSession } from '../services/auth';
import { createRoom } from '../services/room';

// Retomada da aula depois de um reinício do backend embarcado (053/RF-5305, RF-5307; contrato
// ipc-backend-status.md). O backend novo não conhece o token nem a sala anteriores (ADR 0005/0006): renova a sessão
// com o nome guardado e, se havia sala, recria a sala com o mesmo título (mesmo slug, mesmo link fixo).

export type RecoveryState = 'idle' | 'reconnecting' | 'recovered' | 'failed';

/** Sala como o App a guarda, com o título usado para recriá-la. */
export interface RecoverableRoom {
  id: string;
  slug: string;
  link: string;
  title: string;
  ipLink?: string;
  mdnsLink?: string;
  shortIpLink?: string;
  shortMdnsLink?: string;
}

/** Tempo do aviso "Aula retomada" (RF-5307). */
export const RECOVERED_NOTICE_MS = 10_000;

/** Converte a resposta de criação da sala no formato do App (o mesmo do Dashboard). */
export function roomFromCreateResponse(resp: CreateRoomResponse, title: string): RecoverableRoom {
  return {
    id: resp.room_id || resp.id || '',
    slug: resp.slug,
    link: resp.link || resp.join_url || '',
    title,
    ipLink: resp.ip_link,
    mdnsLink: resp.mdns_link,
    shortIpLink: resp.short_ip_link,
    shortMdnsLink: resp.short_mdns_link,
  };
}

interface UseBackendRecoveryProps {
  /** Sala atual; null fora da sala (dashboard). */
  room: RecoverableRoom | null;
  /** Chamado com a sala recriada no backend novo. */
  onRoomRecreated: (room: RecoverableRoom) => void;
}

export function useBackendRecovery({ room, onRoomRecreated }: UseBackendRecoveryProps): RecoveryState {
  const [state, setState] = useState<RecoveryState>('idle');
  const roomRef = useRef(room);
  roomRef.current = room;
  const onRoomRecreatedRef = useRef(onRoomRecreated);
  onRoomRecreatedRef.current = onRoomRecreated;

  useEffect(() => {
    const subscribe = window.electronAPI?.onBackendStatus;
    if (typeof subscribe !== 'function') return;

    let disposed = false;
    let wasDown = false;
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    const set = (next: RecoveryState): void => {
      if (!disposed) setState(next);
    };
    const clearNotice = (): void => {
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = null;
    };

    const resume = async (): Promise<void> => {
      try {
        const name = sessionStorage.getItem('professor_name') || '';
        const session = await startProfessorSession(name);
        const current = roomRef.current;
        if (!current) {
          set('idle');
          return;
        }
        const resp = await createRoom(current.title, session.name || name);
        if (disposed) return;
        const recreated = roomFromCreateResponse(resp, current.title);
        if (!recreated.id) throw new Error('resposta de criação da sala sem id');
        onRoomRecreatedRef.current(recreated);
        set('recovered');
        clearNotice();
        noticeTimer = setTimeout(() => set('idle'), RECOVERED_NOTICE_MS);
      } catch (err) {
        console.warn('[MLab] Não foi possível retomar a aula depois do reinício do backend:', err);
        set('failed');
      }
    };

    const unsubscribe = subscribe((status) => {
      if (status === 'down' || status === 'restarting') {
        wasDown = true;
        clearNotice();
        set('reconnecting');
      } else if (status === 'failed') {
        wasDown = false;
        clearNotice();
        set('failed');
      } else if (status === 'up' && wasDown) {
        wasDown = false;
        void resume();
      }
    });

    return () => {
      disposed = true;
      clearNotice();
      unsubscribe();
    };
  }, []);

  return state;
}
