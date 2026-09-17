import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebRTCSubscriber(token: string, roomInfo: { room_id: string; ws_url: string; ice_servers: any[] }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'closed'>('connecting');
  const [messages, setMessages] = useState<any[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);
  const hasSubscribedRef = useRef(false);
  const isCleanedUpRef = useRef(false);

  const connect = useCallback(() => {
    if (isCleanedUpRef.current) return;
    setConnectionStatus('connecting');

    let finalWsUrl = roomInfo.ws_url;
    if (typeof window !== 'undefined' && window.location && window.location.host) {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      finalWsUrl = `${wsProto}//${window.location.host}/ws/rooms/${roomInfo.room_id}/signal`;
    }

    const ws = new WebSocket(`${finalWsUrl}?token=${token}`);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: roomInfo.ice_servers && roomInfo.ice_servers.length > 0
        ? roomInfo.ice_servers
        : [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;
    hasSubscribedRef.current = false;

    pc.ontrack = (event) => {
      setStream((prev) => {
        if (!prev) {
          return new MediaStream([event.track]);
        }
        if (!prev.getTracks().some((t) => t.id === event.track.id)) {
          prev.addTrack(event.track);
        }
        return prev;
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
      if (ws.readyState === WebSocket.OPEN && !hasSubscribedRef.current) {
        hasSubscribedRef.current = true;
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
        } else if (msg.type === 'session-state') {
          if (msg.payload && msg.payload.status === 'closed') {
            setConnectionStatus('closed');
            setStream(null);
          } else {
            setConnectionStatus(msg.payload.status);
            if (msg.payload.status === 'publishing' && !hasSubscribedRef.current) {
              requestSubscription();
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
      if (connectionStatus !== 'closed') {
        setConnectionStatus('reconnecting');
        const attempts = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
        reconnectAttemptRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, [token, roomInfo]);

  useEffect(() => {
    isCleanedUpRef.current = false;
    connect();
    return () => {
      isCleanedUpRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (pcRef.current) pcRef.current.close();
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
