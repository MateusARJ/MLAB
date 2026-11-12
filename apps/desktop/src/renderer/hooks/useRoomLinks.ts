import { useCallback, useEffect, useRef, useState } from 'react';
import { getRoomLink } from '../services/room';

/** Links de acesso dos alunos como o app os usa (camelCase). */
export interface RoomLinks {
  link: string;
  ipLink: string;
  mdnsLink: string;
  shortIpLink: string;
  shortMdnsLink: string;
}

/** Sala com os links recebidos na criação. */
export interface RoomWithLinks {
  id: string;
  link: string;
  ipLink?: string;
  mdnsLink?: string;
  shortIpLink?: string;
  shortMdnsLink?: string;
}

/** Intervalo de releitura dos links (012, RF-128). */
export const ROOM_LINKS_POLL_MS = 10_000;

const EMPTY_LINKS: RoomLinks = { link: '', ipLink: '', mdnsLink: '', shortIpLink: '', shortMdnsLink: '' };

function fromRoom(room: RoomWithLinks | null): RoomLinks {
  if (!room) return EMPTY_LINKS;
  return {
    link: room.link,
    ipLink: room.ipLink || room.link,
    mdnsLink: room.mdnsLink || '',
    shortIpLink: room.shortIpLink || '',
    shortMdnsLink: room.shortMdnsLink || '',
  };
}

/** Texto do aviso quando o link fixo (mDNS) muda durante a sessão. */
export function linkChangeNotice(mdnsLink: string): string {
  return mdnsLink
    ? `O link fixo da sala mudou para ${mdnsLink}. Reenvie aos alunos.`
    : 'O link fixo da sala não está mais disponível. Use o link por IP.';
}

/**
 * Mantém os links da sala atualizados com o nome mDNS que o backend anuncia de fato (012, RF-127/RF-128):
 * relê `GET /rooms/{id}/link` ao abrir e a cada 10 s, e gera um aviso quando o `mdns_link` muda.
 */
export function useRoomLinks(room: RoomWithLinks | null) {
  const roomId = room?.id || '';
  const [links, setLinks] = useState<RoomLinks>(() => fromRoom(room));
  const [notice, setNotice] = useState<string | null>(null);
  const shownMdns = useRef(room?.mdnsLink || '');
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    const current = roomRef.current;
    setLinks(fromRoom(current));
    setNotice(null);
    shownMdns.current = current?.mdnsLink || '';
    if (!roomId) return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const resp = await getRoomLink(roomId);
        if (cancelled || !resp) return;
        const fallback = roomRef.current?.link || '';
        const next: RoomLinks = {
          link: resp.link || fallback,
          ipLink: resp.ip_link || resp.link || fallback,
          mdnsLink: resp.mdns_link || '',
          shortIpLink: resp.short_ip_link || '',
          shortMdnsLink: resp.short_mdns_link || '',
        };
        if (next.mdnsLink !== shownMdns.current) {
          shownMdns.current = next.mdnsLink;
          setNotice(linkChangeNotice(next.mdnsLink));
        }
        setLinks(next);
      } catch {
        // Backend indisponível: mantém os links mostrados e tenta de novo no próximo ciclo.
      }
    };

    refresh();
    const timer = setInterval(refresh, ROOM_LINKS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomId]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { links, notice, dismissNotice };
}
