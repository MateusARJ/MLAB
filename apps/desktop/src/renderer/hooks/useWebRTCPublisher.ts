import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseWebRTCPublisherProps {
  roomId: string;
  stream: MediaStream | null;
  token: string | null;
  wsUrl?: string;
  targetFps?: 30 | 60;
}

/**
 * Injeta diretivas no SDP para cravar a taxa de transmissão em alta qualidade (1080p @ 4 Mbps para 30fps ou 6 Mbps para 60fps)
 * Força o motor Chromium WebRTC a iniciar imediatamente no bitrate pretendido via x-google-start-bitrate e max-fr
 */
export function enforceHighBitrateSDP(
  sdp: string,
  bitrateKbps: number = 4000,
  _maxFramerate: number = 30
): string {
  // Concede headroom de burst dinâmico para cenas complexas com alta variação de cores/partículas
  const burstBitrateKbps = Math.max(bitrateKbps * 1.5, bitrateKbps + 2000);
  let result = sdp.replace(/m=video ([^\r\n]+)\r\n/g, (match) => {
    return `${match}b=AS:${bitrateKbps}\r\nb=TIAS:${bitrateKbps * 1000}\r\n`;
  });

  const rtpmapRegex = /a=rtpmap:(\d+) (VP8|H264|VP9)\/90000/g;
  let match: RegExpExecArray | null;
  while ((match = rtpmapRegex.exec(result)) !== null) {
    const pt = match[1];
    const codec = match[2];
    const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)\r\n`);
    const params = `x-google-min-bitrate=${Math.max(1000, bitrateKbps - 1500)};x-google-start-bitrate=${bitrateKbps};x-google-max-bitrate=${burstBitrateKbps}`;
    if (fmtpRegex.test(result)) {
      result = result.replace(fmtpRegex, `a=fmtp:${pt} $1;${params}\r\n`);
    } else {
      result = result.replace(
        `a=rtpmap:${pt} ${codec}/90000\r\n`,
        `a=rtpmap:${pt} ${codec}/90000\r\na=fmtp:${pt} ${params}\r\n`
      );
    }
  }

  // Otimiza o codec Opus para áudio de voz anti-microfonia:
  // usedtx=1: Desativa transmissão contínua em momentos de silêncio (quebra o loop de microfonia durante pausas)
  // stereo=0 / sprop-stereo=0: Força saída mono para eliminar defasagem estéreo
  const opusRegex = /a=rtpmap:(\d+) opus\/48000\/2/i;
  const opusMatch = opusRegex.exec(result);
  if (opusMatch) {
    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)\r\n`);
    if (fmtpRegex.test(result)) {
      result = result.replace(fmtpRegex, (_m, existing) => {
        let updated = existing;
        if (!updated.includes('usedtx')) updated += ';usedtx=1';
        if (!updated.includes('stereo=')) updated += ';stereo=0;sprop-stereo=0';
        return `a=fmtp:${pt} ${updated}\r\n`;
      });
    } else {
      result = result.replace(
        `a=rtpmap:${pt} opus/48000/2\r\n`,
        `a=rtpmap:${pt} opus/48000/2\r\na=fmtp:${pt} minptime=10;useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0\r\n`
      );
    }
  }

  return result;
}

export function useWebRTCPublisher({
  roomId,
  stream,
  token,
  wsUrl,
  targetFps = 30,
}: UseWebRTCPublisherProps) {
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<
    'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [lastHandRaised, setLastHandRaised] = useState<{
    participant_id: string;
    name: string;
    student_id?: string;
    timestamp: number;
  } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(stream);
  streamRef.current = stream;

  const targetFpsRef = useRef<30 | 60>(targetFps);
  targetFpsRef.current = targetFps;

  const currentBitrateKbps = targetFps === 60 ? 8000 : 5000;
  const currentFramerate = targetFps === 60 ? 60 : 30;

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
    setTimeout(() => {
      stopPublishing();
    }, 100);
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
        iceServers: [],
      });
      pcRef.current = pc;

      const applyVideoSenderParameters = async (overrideFps?: number) => {
        if (!pcRef.current) return;
        const videoSender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          const fps = overrideFps || targetFpsRef.current || 30;
          const bitrate = fps === 60 ? 8000000 : 5000000;
          params.encodings[0].maxBitrate = bitrate;
          params.encodings[0].maxFramerate = fps;
          params.encodings[0].scaleResolutionDownBy = 1.0;
          // @ts-ignore
          params.encodings[0].networkPriority = 'high';
          // @ts-ignore
          params.encodings[0].priority = 'high';
          // @ts-ignore
          params.degradationPreference = 'balanced';
          try {
            await videoSender.setParameters(params);
            console.log(`[WebRTC Publisher] 1080p@${fps}fps ${bitrate / 1000000}Mbps balanced aplicado ao videoSender.`);
          } catch (e) {
            console.warn('[WebRTC Publisher] Erro ao aplicar parâmetros no RTCRtpSender:', e);
          }
        }
      };

      // Adiciona tracks de vídeo e áudio do stream ativo
      activeStream.getTracks().forEach((track) => {
        if (track.kind === 'video') {
          // @ts-ignore
          track.contentHint = 'motion';
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
            // Cria a oferta SDP após aprovação do hub com diretivas estritas de alta taxa
            const offer = await pc.createOffer();
            const sdp = offer.sdp
              ? enforceHighBitrateSDP(offer.sdp, currentBitrateKbps, currentFramerate)
              : offer.sdp;
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
              const answerSdp = enforceHighBitrateSDP(
                msg.payload.sdp,
                currentBitrateKbps,
                currentFramerate
              );
              await pc.setRemoteDescription({
                type: 'answer',
                sdp: answerSdp,
              });
              await applyVideoSenderParameters();
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
          } else if (msg.type === 'chat-message') {
            setMessages((prev) => [...prev, msg.payload]);
          } else if (msg.type === 'chat-message-pinned') {
            const pinUpdate = msg.payload;
            if (pinUpdate && pinUpdate.message_id) {
              setMessages((prev) =>
                prev.map((m) =>
                  (m.message_id || m.id) === pinUpdate.message_id
                    ? { ...m, pinned: !!pinUpdate.pinned }
                    : m
                )
              );
            }
          } else if (msg.type === 'chat-history') {
            if (msg.payload && Array.isArray(msg.payload.messages)) {
              setMessages(msg.payload.messages);
            }
          } else if (msg.type === 'participants-update') {
            if (msg.payload && Array.isArray(msg.payload.participants)) {
              setParticipants(msg.payload.participants);
            }
          } else if (msg.type === 'hand-updated') {
            const update = msg.payload;
            if (update && update.participant_id) {
              setParticipants((prev) =>
                prev.map((p) =>
                  p.participant_id === update.participant_id
                    ? {
                        ...p,
                        hand_raised: update.raised,
                        hand_raised_at: update.raised_at || (update.raised ? new Date().toISOString() : undefined),
                      }
                    : p
                )
              );
              if (update.raised) {
                setLastHandRaised({
                  participant_id: update.participant_id,
                  name: update.name || 'Aluno',
                  student_id: update.student_id,
                  timestamp: Date.now(),
                });
              }
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

  const changeStream = useCallback(async (newStream: MediaStream): Promise<boolean> => {
    streamRef.current = newStream;
    if (!pcRef.current) return false;

    const senders = pcRef.current.getSenders();
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0];
    let videoReplaced = false;

    if (newVideoTrack) {
      // @ts-ignore
      newVideoTrack.contentHint = 'detail';
      const videoSender = senders.find(
        (s) => (s.track && s.track.kind === 'video') ||
               (!s.track && pcRef.current?.getTransceivers().find((t) => t.sender === s)?.receiver.track?.kind === 'video')
      ) || senders[0];

      if (videoSender) {
        try {
          const oldTrack = videoSender.track;
          await videoSender.replaceTrack(newVideoTrack);
          if (oldTrack && oldTrack !== newVideoTrack) {
            oldTrack.stop();
          }

          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          const fps = targetFpsRef.current || 30;
          const bitrate = fps === 60 ? 8000000 : 5000000;
          params.encodings[0].maxBitrate = bitrate;
          params.encodings[0].maxFramerate = fps;
          params.encodings[0].scaleResolutionDownBy = 1.0;
          // @ts-ignore
          params.encodings[0].networkPriority = 'high';
          // @ts-ignore
          params.encodings[0].priority = 'high';
          // @ts-ignore
          params.degradationPreference = 'balanced';
          await videoSender.setParameters(params).catch(() => {});
          videoReplaced = true;
          console.log(`[WebRTC Publisher] Track de vídeo substituído com sucesso via changeStream (1080p@${fps}fps ${bitrate / 1000000}Mbps balanced).`);

          // Solicita Keyframe imediato ao SFU para propagação instantânea aos alunos sem F5
          const requestKeyFrame = () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'request-keyframe', payload: {} }));
            }
          };
          requestKeyFrame();
          setTimeout(requestKeyFrame, 150);
          setTimeout(requestKeyFrame, 400);
        } catch (err) {
          console.warn('[WebRTC Publisher] Falha no replaceTrack de vídeo:', err);
        }
      }
    }

    if (newAudioTrack) {
      const audioSender = senders.find(
        (s) => (s.track && s.track.kind === 'audio') ||
               (!s.track && pcRef.current?.getTransceivers().find((t) => t.sender === s)?.receiver.track?.kind === 'audio')
      );
      if (audioSender) {
        const oldAudio = audioSender.track;
        await audioSender.replaceTrack(newAudioTrack).then(() => {
          if (oldAudio && oldAudio !== newAudioTrack) {
            oldAudio.stop();
          }
        }).catch((err) => {
          console.warn('[WebRTC Publisher] Falha no replaceTrack de áudio:', err);
        });
      }
    }

    return videoReplaced;
  }, []);

  // Atualização dinâmica de tracks ao alterar fonte (RN-12, RN-20)
  useEffect(() => {
    if (!pcRef.current || !stream) return;

    const senders = pcRef.current.getSenders();
    const newVideoTrack = stream.getVideoTracks()[0];
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

    if (videoSender && newVideoTrack && videoSender.track !== newVideoTrack) {
      // @ts-ignore
      newVideoTrack.contentHint = 'motion';
      videoSender
        .replaceTrack(newVideoTrack)
        .then(async () => {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          const fps = targetFpsRef.current || 30;
          const bitrate = fps === 60 ? 8000000 : 5000000;
          params.encodings[0].maxBitrate = bitrate;
          params.encodings[0].maxFramerate = fps;
          params.encodings[0].scaleResolutionDownBy = 1.0;
          // @ts-ignore
          params.encodings[0].networkPriority = 'high';
          // @ts-ignore
          params.encodings[0].priority = 'high';
          // @ts-ignore
          params.degradationPreference = 'balanced';
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

  // Atualização dinâmica de bitrate e framerate caso o targetFps mude durante a sessão
  useEffect(() => {
    if (!pcRef.current) return;
    const videoSender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (videoSender) {
      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      const fps = targetFps;
      const bitrate = fps === 60 ? 8000000 : 5000000;
      params.encodings[0].maxBitrate = bitrate;
      params.encodings[0].maxFramerate = fps;
      params.encodings[0].scaleResolutionDownBy = 1.0;
      // @ts-ignore
      params.encodings[0].networkPriority = 'high';
      // @ts-ignore
      params.encodings[0].priority = 'high';
      // @ts-ignore
      params.degradationPreference = 'balanced';
      videoSender.setParameters(params).catch((err) => {
        console.warn('[WebRTC Publisher] Erro ao atualizar parâmetros de vídeo para targetFps:', err);
      });
    }
  }, [targetFps]);

  useEffect(() => {
    return () => {
      stopPublishing();
    };
  }, [stopPublishing]);

  const sendChatMessage = useCallback((content: string, isPrivate: boolean = false, targetId?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat-message',
          payload: { content, is_private: isPrivate, target_id: targetId },
        })
      );
    }
  }, []);

  const pinChatMessage = useCallback(
    (messageId: string, pinned: boolean, isPrivate: boolean = false, targetId?: string) => {
      if (!messageId) return;
      setMessages((prev) => {
        if (pinned) {
          const currentPinnedCount = prev.filter((m) => {
            if (!m.pinned) return false;
            if ((m.message_id || m.id) === messageId) return false;
            if (!isPrivate) return m.is_private !== true;
            return (
              m.is_private === true &&
              (!targetId || m.participant_id === targetId || m.target_id === targetId)
            );
          }).length;
          if (currentPinnedCount >= 3) {
            return prev;
          }
        }
        return prev.map((m) =>
          (m.message_id || m.id) === messageId ? { ...m, pinned } : m
        );
      });

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'pin-message',
            payload: {
              message_id: messageId,
              pinned,
              is_private: isPrivate,
              target_id: targetId,
            },
          })
        );
      }
    },
    []
  );

  const sendStreamPause = useCallback((paused: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'stream-pause',
          payload: { paused },
        })
      );
    }
  }, []);

  const lowerStudentHand = useCallback((participantId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'lower-hand',
            payload: { participant_id: participantId },
          })
        );
        setParticipants((prev) =>
          prev.map((p) =>
            p.participant_id === participantId ? { ...p, hand_raised: false } : p
          )
        );
      } catch (err) {
        console.warn('Erro ao enviar sinal de lower-hand:', err);
      }
    }
  }, []);

  const dismissHandToast = useCallback(() => {
    setLastHandRaised(null);
  }, []);

  return {
    isPublishing,
    connectionState,
    error,
    messages,
    participants,
    lastHandRaised,
    dismissHandToast,
    lowerStudentHand,
    sendChatMessage,
    pinChatMessage,
    sendStreamPause,
    startPublishing,
    changeStream,
    stopPublishing,
    endSession,
  };
}
