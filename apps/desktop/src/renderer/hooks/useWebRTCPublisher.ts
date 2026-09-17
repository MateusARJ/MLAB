import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseWebRTCPublisherProps {
  roomId: string;
  stream: MediaStream | null;
  token: string | null;
  wsUrl?: string;
}

export function useWebRTCPublisher({
  roomId,
  stream,
  token,
  wsUrl = 'ws://localhost:8080/ws/signaling',
}: UseWebRTCPublisherProps) {
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<
    'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed'
  >('idle');
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(stream);
  streamRef.current = stream;

  const stopPublishing = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsPublishing(false);
    setConnectionState('idle');
  }, []);

  const startPublishing = useCallback(async () => {
    if (!token) {
      setError('Token de autenticação não encontrado.');
      return;
    }
    if (!streamRef.current) {
      setError('Nenhum stream de vídeo/áudio ativo para publicação.');
      return;
    }

    stopPublishing();
    setConnectionState('connecting');
    setError(null);

    try {
      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      wsRef.current = ws;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Adiciona tracks de vídeo e áudio do stream ativo
      streamRef.current.getTracks().forEach((track) => {
        if (streamRef.current) {
          pc.addTrack(track, streamRef.current);
        }
      });

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

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setConnectionState('connected');
          setIsPublishing(true);
        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          setConnectionState('reconnecting');
          try {
            pc.restartIce();
          } catch (e) {
            console.warn('Falha ao acionar ICE restart:', e);
          }
        } else if (pc.iceConnectionState === 'closed') {
          setConnectionState('closed');
          setIsPublishing(false);
        }
      };

      ws.onopen = () => {
        // Envia requisição para publicar na sala
        ws.send(
          JSON.stringify({
            type: 'publish-request',
            payload: {},
          })
        );
      };

      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);

          if (msg.type === 'publish-approved') {
            // Cria a oferta SDP após aprovação do hub
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'offer',
                  payload: { sdp: offer.sdp },
                })
              );
            }
          } else if (msg.type === 'answer') {
            if (msg.payload && msg.payload.sdp) {
              await pc.setRemoteDescription({
                type: 'answer',
                sdp: msg.payload.sdp,
              });
            }
          } else if (msg.type === 'ice-candidate') {
            if (msg.payload && msg.payload.candidate) {
              try {
                const candidateInit = JSON.parse(msg.payload.candidate);
                await pc.addIceCandidate(candidateInit);
              } catch {
                await pc.addIceCandidate({ candidate: msg.payload.candidate });
              }
            }
          } else if (msg.type === 'ice-servers') {
            // Atualiza servidores ICE dinâmicos (TURN/STUN) se recebidos
            if (msg.payload && msg.payload.ice_servers) {
              pc.setConfiguration({ iceServers: msg.payload.ice_servers });
            }
          } else if (msg.type === 'error') {
            setError(msg.payload.message || 'Erro de sinalização.');
          }
        } catch (err: any) {
          console.error('Erro ao processar mensagem de sinalização:', err);
        }
      };

      ws.onerror = (evt) => {
        console.error('Erro no WebSocket de sinalização:', evt);
        setError('Falha de conexão com o servidor de sinalização.');
        setConnectionState('failed');
      };

      ws.onclose = () => {
        if (connectionState !== 'closed') {
          setConnectionState('closed');
          setIsPublishing(false);
        }
      };
    } catch (err: any) {
      console.error('Erro ao iniciar publicação WebRTC:', err);
      setError(err.message || 'Falha ao iniciar publicação');
      setConnectionState('failed');
    }
  }, [token, wsUrl, connectionState, stopPublishing]);

  // Atualização dinâmica de tracks ao alterar fonte (RN-12, RN-20)
  useEffect(() => {
    if (!pcRef.current || !stream) return;

    const senders = pcRef.current.getSenders();
    const newVideoTrack = stream.getVideoTracks()[0];
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

    if (videoSender && newVideoTrack && videoSender.track !== newVideoTrack) {
      videoSender.replaceTrack(newVideoTrack).catch((err) => {
        console.warn('Erro ao substituir track de vídeo dinamicamente:', err);
      });
    }

    const newAudioTrack = stream.getAudioTracks()[0];
    const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
    if (audioSender && newAudioTrack && audioSender.track !== newAudioTrack) {
      audioSender.replaceTrack(newAudioTrack).catch((err) => {
        console.warn('Erro ao substituir track de áudio dinamicamente:', err);
      });
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stopPublishing();
    };
  }, [stopPublishing]);

  return {
    isPublishing,
    connectionState,
    error,
    startPublishing,
    stopPublishing,
  };
}
