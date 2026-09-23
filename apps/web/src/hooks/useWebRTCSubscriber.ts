import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebRTCSubscriber(token: string, roomInfo: { room_id: string; ws_url: string; ice_servers: any[] }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'closed'>('connecting');
  const [isStreamPaused, setIsStreamPaused] = useState<boolean>(false);
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);
  const hasSubscribedStateRef = useRef(false);
  const isCleanedUpRef = useRef(false);
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  const roomId = roomInfo?.room_id;
  const wsUrl = roomInfo?.ws_url;
  const iceServers = roomInfo?.ice_servers;

  const connect = useCallback(() => {
    if (isCleanedUpRef.current) return;

    // Evita conexões duplicadas se o WebSocket atual já estiver aberto ou conectando
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus('connecting');

    let finalWsUrl = wsUrl;
    if (typeof window !== 'undefined' && window.location && window.location.host) {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      finalWsUrl = `${wsProto}//${window.location.host}/ws/rooms/${roomId}/signal`;
    }

    const ws = new WebSocket(`${finalWsUrl}?token=${token}`);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: iceServers && iceServers.length > 0
        ? iceServers
        : [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;
    hasSubscribedStateRef.current = false;

    pc.ontrack = (event) => {
      setStream((prev) => {
        if (!prev) {
          return new MediaStream([event.track]);
        }
        if (prev.getTracks().some((t) => t.id === event.track.id)) {
          return prev;
        }
        // Retorna nova instância de MediaStream para forçar re-render e atualizar o elemento <video>
        return new MediaStream([...prev.getTracks(), event.track]);
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'ice-candidate',
            payload: { candidate: JSON.stringify(event.candidate) },
          })
        );
      }
    };

    // Monitoramento de ICE Connection State (RF-25: ICE Restart em falha)
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('connected');
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('Conexão ICE falhou/desconectou. Tentando ICE Restart...');
        try {
          pc.restartIce();
        } catch (e) {
          console.warn('Falha no restartIce:', e);
        }
      }
    };

    const requestSubscription = () => {
      if (ws.readyState === WebSocket.OPEN && !hasSubscribedStateRef.current) {
        hasSubscribedStateRef.current = true;
        ws.send(
          JSON.stringify({
            type: 'subscribe-request',
            payload: {},
          })
        );
      }
    };

    ws.onopen = () => {
      // Aguarda recebimento do session-state antes de enviar subscribe-request
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'chat-message') {
          setMessages((prev) => [...prev, msg.payload]);
        } else if (msg.type === 'stream-paused') {
          setIsStreamPaused(!!msg.payload?.paused);
        } else if (msg.type === 'file-shared') {
          if (msg.payload) {
            setSharedFiles((prev) => {
              if (prev.some((f) => f.id === msg.payload.id)) return prev;
              return [...prev, msg.payload];
            });
          }
        } else if (msg.type === 'session-state') {
          if (msg.payload && msg.payload.status === 'closed') {
            setConnectionStatus('closed');
            setStream(null);
          } else {
            setConnectionStatus(msg.payload.status);
            if (msg.payload.status === 'publishing') {
              if (!hasSubscribedStateRef.current) {
                requestSubscription();
              }
            } else if (msg.payload.status === 'waiting' || msg.payload.status === 'reconnecting') {
              hasSubscribedStateRef.current = false;
            }
          }
        } else if (msg.type === 'room-closed') {
          setConnectionStatus('closed');
          setStream(null);
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        } else if (msg.type === 'offer') {
          if (msg.payload && msg.payload.sdp) {
            if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
              console.warn('Ignorando offer fora de estado estável:', pc.signalingState);
              return;
            }
            await pc.setRemoteDescription(
              new RTCSessionDescription({
                type: 'offer',
                sdp: msg.payload.sdp,
              })
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'answer',
                  payload: { sdp: answer.sdp },
                })
              );
            }
          }
        } else if (msg.type === 'ice-candidate') {
          if (msg.payload && msg.payload.candidate) {
            try {
              const candInit = JSON.parse(msg.payload.candidate);
              await pc.addIceCandidate(new RTCIceCandidate(candInit));
            } catch {
              await pc.addIceCandidate(new RTCIceCandidate({ candidate: msg.payload.candidate }));
            }
          }
        } else if (msg.type === 'ice-servers') {
          if (msg.payload && msg.payload.ice_servers) {
            pc.setConfiguration({ iceServers: msg.payload.ice_servers });
          }
        }
      } catch (err) {
        console.error('Erro ao processar mensagem WS:', err);
      }
    };

    ws.onclose = (evt) => {
      if (isCleanedUpRef.current) return;

      // Trata encerramento por sessão duplicada (RN-04 / erro 4001)
      if (evt.code === 4001) {
        setConnectionStatus('closed');
        return;
      }

      // Reconexão com backoff exponencial: 1s, 2s, 4s, 8s, 16s, 30s (RF-19, RN-14)
      if (connectionStatusRef.current !== 'closed') {
        setConnectionStatus('reconnecting');
        const attempts = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
        reconnectAttemptRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, [token, roomId, wsUrl, iceServers]);

  useEffect(() => {
    isCleanedUpRef.current = false;
    connect();
    return () => {
      isCleanedUpRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [connect]);

  // Carrega lista inicial de arquivos compartilhados
  useEffect(() => {
    if (!roomId) return;
    fetch(`/rooms/${roomId}/files`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setSharedFiles(data);
        }
      })
      .catch((err) => console.warn('Erro ao carregar arquivos da sala:', err));
  }, [roomId]);

  const sendChatMessage = useCallback((text: string, isPrivate: boolean = false) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat-message',
          payload: { content: text, is_private: isPrivate },
        })
      );
    }
  }, []);

  return {
    stream,
    autoplayBlocked,
    setAutoplayBlocked,
    connectionStatus,
    isStreamPaused,
    sharedFiles,
    messages,
    sendChatMessage,
  };
}
