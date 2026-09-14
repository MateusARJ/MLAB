import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebRTCSubscriber(token: string, roomInfo: { room_id: string; ws_url: string; ice_servers: any[] }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'closed'>('connecting');
  const [messages, setMessages] = useState<any[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);

  const connect = useCallback(() => {
    setConnectionStatus('connecting');

    const ws = new WebSocket(`${roomInfo.ws_url}?token=${token}`);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: roomInfo.ice_servers || [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setStream(event.streams[0]);
      } else {
        const inboundStream = new MediaStream([event.track]);
        setStream(inboundStream);
      }
    };

    // Monitoramento de ICE Connection State (RF-25: ICE Restart em falha)
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('Conexão ICE falhou/desconectou. Tentando ICE Restart...');
        pc.restartIce();
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'chat-message') {
          setMessages((prev) => [...prev, msg.payload]);
        } else if (msg.type === 'session-state') {
          setConnectionStatus(msg.payload.status);
        } else if (msg.type === 'room-closed') {
          setConnectionStatus('closed');
        }
      } catch (err) {
        console.error('Erro ao processar mensagem WS:', err);
      }
    };

    ws.onclose = (evt) => {
      // Trata encerramento por sessão duplicada (RN-04 / erro 4001)
      if (evt.code === 4001) {
        setConnectionStatus('closed');
        return;
      }

      // Reconexão com backoff exponencial: 1s, 2s, 4s, 8s, 16s, 30s (RF-19, RN-14)
      if (connectionStatus !== 'closed') {
        setConnectionStatus('reconnecting');
        const attempts = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
        reconnectAttemptRef.current += 1;

        setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, [token, roomInfo]);

  useEffect(() => {
    connect();
    return () => {
      if (pcRef.current) pcRef.current.close();
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const sendChatMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat-message',
          payload: { content: text },
        })
      );
    }
  }, []);

  return {
    stream,
    autoplayBlocked,
    setAutoplayBlocked,
    connectionStatus,
    messages,
    sendChatMessage,
  };
}
