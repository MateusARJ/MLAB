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
  wsUrl,
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

  const endSession = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'end-session',
            payload: {},
          })
        );
      } catch (e) {
        console.warn('Erro ao enviar sinal de end-session:', e);
      }
    }
    stopPublishing();
  }, [stopPublishing]);

  const startPublishing = useCallback(async (directStream?: MediaStream) => {
    if (!token) {
      setError('Token de autenticação não encontrado.');
      return;
    }
    const activeStream = directStream || streamRef.current;
    if (!activeStream) {
      setError('Nenhum stream de vídeo/áudio ativo para publicação.');
      return;
    }
    streamRef.current = activeStream;

    stopPublishing();
    setConnectionState('connecting');
    setError(null);

    try {
      const finalWsUrl = wsUrl || `ws://localhost:8080/ws/rooms/${roomId}/signal`;
      const ws = new WebSocket(`${finalWsUrl}?token=${token}`);
      wsRef.current = ws;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      const applyVideoSenderParameters = async () => {
        if (!pcRef.current) return;
        const videoSender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 4000000; // 4 Mbps para 1080p (RF-04, RNF-01)
          params.encodings[0].maxFramerate = 30; // 30 fps
          params.encodings[0].scaleResolutionDownBy = 1.0;
          // @ts-ignore
          params.degradationPreference = 'maintain-resolution';
          try {
            await videoSender.setParameters(params);
            console.log('[WebRTC Publisher] 1080p@30fps 4Mbps maintain-resolution aplicado ao videoSender.');
          } catch (e) {
            console.warn('[WebRTC Publisher] Erro ao aplicar parâmetros no RTCRtpSender:', e);
          }
        }
      };

      // Adiciona tracks de vídeo e áudio do stream ativo
      activeStream.getTracks().forEach((track) => {
        if (track.kind === 'video') {
          // @ts-ignore
          track.contentHint = 'detail';
        }
        pc.addTrack(track, activeStream);
      });

      await applyVideoSenderParameters();

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
            let sdp = offer.sdp;
            if (sdp) {
              // Insere b=AS:4000 (4 Mbps) e b=TIAS:4000000 na seção de vídeo do SDP
              sdp = sdp.replace(/m=video ([^\r\n]+)\r\n/g, (match) => {
                return `${match}b=AS:4000\r\nb=TIAS:4000000\r\n`;
              });
            }
            const modifiedOffer = new RTCSessionDescription({
              type: 'offer',
              sdp: sdp || offer.sdp,
            });
            await pc.setLocalDescription(modifiedOffer);
            await applyVideoSenderParameters();

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'offer',
                  payload: { sdp: modifiedOffer.sdp },
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
  }, [token, roomId, wsUrl, connectionState, stopPublishing]);

  // Atualização dinâmica de tracks ao alterar fonte (RN-12, RN-20)
  useEffect(() => {
    if (!pcRef.current || !stream) return;

    const senders = pcRef.current.getSenders();
    const newVideoTrack = stream.getVideoTracks()[0];
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

    if (videoSender && newVideoTrack && videoSender.track !== newVideoTrack) {
      // @ts-ignore
      newVideoTrack.contentHint = 'detail';
      videoSender
        .replaceTrack(newVideoTrack)
        .then(async () => {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 4000000;
          params.encodings[0].maxFramerate = 30;
          params.encodings[0].scaleResolutionDownBy = 1.0;
          // @ts-ignore
          params.degradationPreference = 'maintain-resolution';
          await videoSender.setParameters(params).catch(() => {});
        })
        .catch((err) => {
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
    endSession,
  };
}
