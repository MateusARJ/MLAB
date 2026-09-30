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
  const isClosedRef = useRef(false);
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  const roomId = roomInfo?.room_id;
  const wsUrl = roomInfo?.ws_url;
  const iceServers = roomInfo?.ice_servers;

  const connect = useCallback(() => {
    if (isCleanedUpRef.current || isClosedRef.current) return;

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

    const setupPeerConnectionAndSubscribe = (targetWs: WebSocket) => {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }
      setStream(null);

      const pc = new RTCPeerConnection({
        iceServers: iceServers && iceServers.length > 0
          ? iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;
      hasSubscribedStateRef.current = true;

      pc.ontrack = (event) => {
        setStream((prev) => {
          const activePrevTracks = prev ? prev.getTracks().filter((t) => t.readyState === 'live') : [];
          if (activePrevTracks.some((t) => t.id === event.track.id)) {
            return prev;
          }
          // Retorna nova instância de MediaStream contendo apenas faixas ativas para atualizar o elemento <video>
          return new MediaStream([...activePrevTracks, event.track]);
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(
            JSON.stringify({
              type: 'ice-candidate',
              payload: { candidate: JSON.stringify(event.candidate) },
            })
          );
        }
      };

      const requestKeyframeImmediate = () => {
        if (targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({ type: 'request-keyframe', payload: {} }));
        }
      };

      // Dispara solicitação de Keyframe assim que a conexão de rede WebRTC for estabelecida
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
          requestKeyframeImmediate();
          setTimeout(requestKeyframeImmediate, 300);
        }
      };

      // Monitoramento de ICE Connection State (RF-25: ICE Restart em falha)
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setConnectionStatus('connected');
          requestKeyframeImmediate();
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          console.warn('Conexão ICE falhou/desconectou. Tentando ICE Restart...');
          try {
            pc.restartIce();
          } catch (e) {
            console.warn('Falha no restartIce:', e);
          }
        }
      };

      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(
          JSON.stringify({
            type: 'subscribe-request',
            payload: {},
          })
        );
      }
    };

    ws.onopen = () => {
      // Solicita a transmissão ao abrir a conexão WebSocket
      setupPeerConnectionAndSubscribe(ws);
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'chat-message') {
          setMessages((prev) => [...prev, msg.payload]);
        } else if (msg.type === 'chat-history') {
          if (msg.payload && Array.isArray(msg.payload.messages)) {
            setMessages(msg.payload.messages);
          }
        } else if (msg.type === 'stream-paused') {
          setIsStreamPaused(!!msg.payload?.paused);
        } else if (msg.type === 'file-shared') {
          if (msg.payload) {
            setSharedFiles((prev) => {
              if (prev.some((f) => f.id === msg.payload.id)) return prev;
              return [...prev, msg.payload];
            });
          }
        } else if (msg.type === 'files-history') {
          if (msg.payload && Array.isArray(msg.payload.files)) {
            setSharedFiles(msg.payload.files);
          }
        } else if (msg.type === 'stream-started') {
          // O professor iniciou a transmissão com vídeo pronto: reinicializa PeerConnection e conecta sem F5
          setConnectionStatus('publishing');
          setupPeerConnectionAndSubscribe(ws);
        } else if (msg.type === 'session-state') {
          if (msg.payload && msg.payload.status === 'closed') {
            isClosedRef.current = true;
            connectionStatusRef.current = 'closed';
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
              wsRef.current.onclose = null;
              wsRef.current.close(1000, 'Session closed');
              wsRef.current = null;
            }
          } else {
            setConnectionStatus(msg.payload.status);
            if (msg.payload.status === 'publishing') {
              if (!hasSubscribedStateRef.current || !pcRef.current) {
                setupPeerConnectionAndSubscribe(ws);
              }
            } else if (msg.payload.status === 'waiting' || msg.payload.status === 'reconnecting') {
              hasSubscribedStateRef.current = false;
            }
          }
        } else if (msg.type === 'room-closed') {
          isClosedRef.current = true;
          connectionStatusRef.current = 'closed';
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
            wsRef.current.onclose = null;
            wsRef.current.close(1000, 'Room closed');
            wsRef.current = null;
          }
        } else if (msg.type === 'offer') {
          const currentPc = pcRef.current;
          if (currentPc && msg.payload && msg.payload.sdp) {
            if (currentPc.signalingState !== 'stable' && currentPc.signalingState !== 'have-local-offer') {
              console.warn('Ignorando offer fora de estado estável:', currentPc.signalingState);
              return;
            }
            await currentPc.setRemoteDescription(
              new RTCSessionDescription({
                type: 'offer',
                sdp: msg.payload.sdp,
              })
            );
            const answer = await currentPc.createAnswer();
            await currentPc.setLocalDescription(answer);
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
          const currentPc = pcRef.current;
          if (currentPc && msg.payload && msg.payload.candidate) {
            try {
              const candInit = JSON.parse(msg.payload.candidate);
              await currentPc.addIceCandidate(new RTCIceCandidate(candInit));
            } catch {
              await currentPc.addIceCandidate(new RTCIceCandidate({ candidate: msg.payload.candidate }));
            }
          }
        } else if (msg.type === 'ice-servers') {
          const currentPc = pcRef.current;
          if (currentPc && msg.payload && msg.payload.ice_servers) {
            currentPc.setConfiguration({ iceServers: msg.payload.ice_servers });
          }
        }
      } catch (err) {
        console.error('Erro ao processar mensagem WS:', err);
      }
    };

    ws.onclose = (evt) => {
      if (isCleanedUpRef.current) return;

      // Trata encerramento intencional da sala pelo professor ou sessão duplicada (RN-04 / erro 4001 / 4004 / 1000)
      if (
        isClosedRef.current ||
        connectionStatusRef.current === 'closed' ||
        evt.code === 1000 ||
        evt.code === 4001 ||
        evt.code === 4004
      ) {
        isClosedRef.current = true;
        connectionStatusRef.current = 'closed';
        setConnectionStatus('closed');
        return;
      }

      // Reconexão com backoff exponencial: 1s, 2s, 4s, 8s, 16s, 30s (RF-19, RN-14)
      if (reconnectAttemptRef.current >= 4) {
        // Se o servidor/app do professor foi fechado e não responde após 4 tentativas (~15s), encerra a sessão
        isClosedRef.current = true;
        connectionStatusRef.current = 'closed';
        setConnectionStatus('closed');
        return;
      }

      setConnectionStatus('reconnecting');
      const attempts = reconnectAttemptRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      reconnectAttemptRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
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
          setSharedFiles((prev) => {
            const map = new Map();
            prev.forEach((f) => map.set(f.id, f));
            data.forEach((f) => map.set(f.id, f));
            return Array.from(map.values());
          });
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

  const requestKeyframe = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request-keyframe', payload: {} }));
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
    requestKeyframe,
  };
}
