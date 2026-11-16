import { useState, useEffect, useCallback, useRef } from 'react';
import type { CaptureSource, CaptureSourceType } from '@mlab/types';
import { createCursorMaskedTrack, type MaskedVideoTrackResult } from '../media/createCursorMaskedTrack';

export type Source = CaptureSource;

export function useScreenCapture(initialMode: CaptureSourceType = 'screen', initialFps: 30 | 60 = 30) {
  const [captureMode, setCaptureMode] = useState<CaptureSourceType>(initialMode);
  const [targetFps, setTargetFps] = useState<30 | 60>(initialFps);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(true);
  const [systemAudioMuted, setSystemAudioMuted] = useState(true);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const rawAudioStreamRef = useRef<MediaStream | null>(null);
  const systemAudioStreamRef = useRef<MediaStream | null>(null);
  const systemGainNodeRef = useRef<GainNode | null>(null);
  const mixerDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const maskedTracksRef = useRef<MaskedVideoTrackResult[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  const loadSources = useCallback(async (mode: CaptureSourceType) => {
    if (window.electronAPI && window.electronAPI.getScreenSources) {
      try {
        const srcs = await window.electronAPI.getScreenSources(mode);
        // O main process já exclui a janela própria do MLab via selfMediaSourceId.
        // Aceita todas as fontes válidas retornadas sem descartar janelas ou abas com a palavra mlab.
        const validSources = srcs.filter((s) => s.id && s.name && s.name.trim().length > 0);
        setSources(validSources);
        setHasPermissions(true);
      } catch (err) {
        console.error('Erro ao buscar fontes de captura:', err);
        setHasPermissions(false);
      }
    } else {
      console.warn('window.electronAPI não encontrado. A API nativa do Electron não está disponível no renderer.');
      setHasPermissions(false);
    }
  }, []);

  const refreshSources = useCallback(() => {
    loadSources(captureMode);
  }, [captureMode, loadSources]);

  useEffect(() => {
    loadSources(captureMode);

    // Quando o usuário volta do navegador ou outra aplicação para o MLab,
    // atualiza as fontes automaticamente para reconhecer abas ou janelas recém-abertas
    const handleFocus = () => {
      if (streamRef.current) return;
      loadSources(captureMode);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [captureMode, loadSources]);

  const changeCaptureMode = useCallback((mode: CaptureSourceType) => {
    setCaptureMode(mode);
    setSelectedSource(null);
  }, []);

  const selectSource = useCallback(async (source: CaptureSource, fps?: 30 | 60, allowedSourceIds?: string[]): Promise<MediaStream | null> => {
    setSelectedSource(source);
    const effectiveFps = fps || targetFps;
    if (fps && fps !== targetFps) {
      setTargetFps(fps);
    }

    try {
      let mediaStream: MediaStream;
      const minFps = effectiveFps === 60 ? 30 : 25;
      try {
        // Tenta capturar Full HD com a taxa de quadros configurada (30fps ou 60fps) e áudio interno do sistema
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
            },
          },
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxWidth: 1920,
              maxHeight: 1080,
              minFrameRate: minFps,
              maxFrameRate: effectiveFps,
            },
          },
        });
      } catch {
        try {
          // Fallback flexível para dimensões especiais com áudio interno do sistema
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'desktop',
              },
            },
            video: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                maxWidth: 1920,
                maxHeight: 1080,
                maxFrameRate: effectiveFps,
              },
            },
          });
        } catch {
          // Fallback resiliente: caso o SO ou driver rejeite áudio do sistema, garante captura de vídeo sem interrupções
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                // @ts-ignore
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: source.id,
                  maxWidth: 1920,
                  maxHeight: 1080,
                  minFrameRate: minFps,
                  maxFrameRate: effectiveFps,
                },
              },
            });
          } catch {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                // @ts-ignore
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: source.id,
                  maxWidth: 1920,
                  maxHeight: 1080,
                  maxFrameRate: effectiveFps,
                },
              },
            });
          }
        }
      }

      // Crava contentHint='detail' para priorizar nitidez de código/texto
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        // @ts-ignore
        videoTrack.contentHint = 'motion';
        const settings = videoTrack.getSettings();
        console.log(`[Capture] Resolução capturada: ${settings.width}x${settings.height} @ ${settings.frameRate}fps (alvo: ${effectiveFps}fps)`);
      }

      // Isola e gerencia a faixa de áudio interno do sistema capturada
      const capturedSysTracks = mediaStream.getAudioTracks();
      if (capturedSysTracks.length > 0) {
        systemAudioStreamRef.current = new MediaStream(capturedSysTracks);
        capturedSysTracks.forEach((t) => {
          if (typeof mediaStream.removeTrack === 'function') {
            mediaStream.removeTrack(t);
          }
          t.enabled = !systemAudioMuted;
        });
        setHasSystemAudio(true);
      } else {
        systemAudioStreamRef.current = null;
        setHasSystemAudio(false);
      }

      // No modo tela cheia ('screen'), a janela de overlay externa transparente (FloatingAnnotationOverlay)
      // com setContentProtection(false) já é capturada nativamente pelo Windows Graphics Capture (WGC)
      // via GPU Direct3D 11 a 60 FPS com zero uso de CPU.
      // A faixa bruta da GPU é utilizada diretamente para máximo desempenho e fluidez, sem intermediários.
      const isScreenMode = (source.type || (source.id.startsWith('screen') ? 'screen' : 'window')) === 'screen';

      if (videoTrack && !isScreenMode) {
        const masked = createCursorMaskedTrack(videoTrack);
        maskedTracksRef.current.push(masked);
        if (masked.active && masked.track !== videoTrack) {
          if (typeof mediaStream.removeTrack === 'function') {
            mediaStream.removeTrack(videoTrack);
          }
          if (typeof mediaStream.addTrack === 'function') {
            mediaStream.addTrack(masked.track);
          }
        }
      }

      if (window.electronAPI && typeof window.electronAPI.startCursorTracking === 'function') {
        window.electronAPI
          .startCursorTracking({
            sourceId: source.id,
            type: source.type || (source.id.startsWith('screen') ? 'screen' : 'window'),
            displayId: source.displayId,
            allowedSourceIds: allowedSourceIds && allowedSourceIds.length > 0 ? allowedSourceIds : undefined,
          })
          .catch(() => {});
      }

      // Tenta anexar microfone do professor com processamento DSP anti-microfonia (RF-10, RN-10)
      try {
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono para voz elimina defasagem de fase e realimentação estéreo
          sampleRate: 48000,
          // @ts-ignore
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true, // Filtra frequências graves de ressonância mecânica
          googTypingNoiseDetection: true,
        };

        const rawAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        rawAudioStreamRef.current = rawAudioStream;
        rawAudioStream.getAudioTracks().forEach((track) => {
          track.enabled = !micMuted;
        });

        let finalAudioTrack: MediaStreamTrack | null = null;

        // Processamento Web Audio API: Mixer Bus (Microfone com DSP + Áudio do Sistema Alta Fidelidade)
        const AudioCtxClass =
          typeof window !== 'undefined'
            ? window.AudioContext || (window as any).webkitAudioContext
            : null;

        if (AudioCtxClass && typeof AudioCtxClass === 'function') {
          try {
            if (audioContextRef.current) {
              audioContextRef.current.close().catch(() => {});
            }
            const audioCtx = new AudioCtxClass();
            audioContextRef.current = audioCtx;

            if (audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
            }

            if (
              typeof audioCtx.createMediaStreamSource === 'function' &&
              typeof audioCtx.createBiquadFilter === 'function' &&
              typeof audioCtx.createDynamicsCompressor === 'function' &&
              typeof audioCtx.createMediaStreamDestination === 'function'
            ) {
              const destination = audioCtx.createMediaStreamDestination();
              mixerDestinationRef.current = destination;

              // 1. Ramo do Microfone (Voz com Filtros Anti-Microfonia e Hard Limiter)
              if (rawAudioStream.getAudioTracks().length > 0) {
                const sourceNode = audioCtx.createMediaStreamSource(rawAudioStream);

                // 1. Filtro Passa-Alta (Highpass): remove ressonâncias subgraves (< 85 Hz)
                const highpass = audioCtx.createBiquadFilter();
                highpass.type = 'highpass';
                highpass.frequency.value = 85;

                // 2. Filtro Passa-Baixa (Lowpass): elimina apitos agudos de microfonia (> 7500 Hz)
                const lowpass = audioCtx.createBiquadFilter();
                lowpass.type = 'lowpass';
                lowpass.frequency.value = 7500;

                // 3. Hard Limiter Dinâmico: trava o ganho em -6 dBFS em 1 ms, impedindo o loop de Barkhausen
                const limiter = audioCtx.createDynamicsCompressor();
                limiter.threshold.value = -6;
                limiter.knee.value = 3;
                limiter.ratio.value = 20; // 20:1 limiter
                limiter.attack.value = 0.001; // 1 ms de ataque imediato
                limiter.release.value = 0.15; // 150 ms de recuperação suave

                sourceNode.connect(highpass);
                highpass.connect(lowpass);
                lowpass.connect(limiter);
                limiter.connect(destination);
              }

              // 2. Ramo do Áudio do Sistema (Alta Fidelidade 20Hz-20kHz para Vídeos Educativos)
              if (
                systemAudioStreamRef.current &&
                systemAudioStreamRef.current.getAudioTracks().length > 0
              ) {
                try {
                  const sysSource = audioCtx.createMediaStreamSource(systemAudioStreamRef.current);
                  if (typeof audioCtx.createGain === 'function') {
                    const sysGain = audioCtx.createGain();
                    sysGain.gain.value = systemAudioMuted ? 0 : 1; // Inicia em 0 (MUTADO)
                    systemGainNodeRef.current = sysGain;
                    sysSource.connect(sysGain);
                    sysGain.connect(destination);
                  } else {
                    sysSource.connect(destination);
                  }
                } catch (sysErr) {
                  console.warn('[Capture] Erro ao conectar áudio do sistema ao mixer Web Audio:', sysErr);
                }
              }

              const processedTracks = destination.stream.getAudioTracks();
              if (processedTracks.length > 0) {
                finalAudioTrack = processedTracks[0];
              }
            }
          } catch (dspErr) {
            console.warn('[Capture] Falha ao inicializar Web Audio mixer, utilizando faixa bruta:', dspErr);
          }
        }

        const trackToAdd = finalAudioTrack || rawAudioStream.getAudioTracks()[0];
        if (trackToAdd) {
          trackToAdd.enabled = (!micMuted) || (!systemAudioMuted);
          mediaStream.addTrack(trackToAdd);
        }
      } catch (err) {
        console.warn('Microfone não disponível ou permissão não concedida:', err);
      }

      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      console.error('Erro ao capturar stream de tela/janela:', err);
      return null;
    }
  }, [stream, micMuted, systemAudioMuted, targetFps]);

  const toggleMicMute = useCallback(() => {
    const nextMuted = !micMuted;
    setMicMuted(nextMuted);

    if (rawAudioStreamRef.current) {
      rawAudioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    if (stream) {
      const isAnyActive = (!nextMuted) || (!systemAudioMuted);
      stream.getAudioTracks().forEach((track) => {
        track.enabled = isAnyActive;
      });
    }
  }, [stream, micMuted, systemAudioMuted]);

  const toggleSystemAudio = useCallback(async () => {
    const nextMuted = !systemAudioMuted;
    setSystemAudioMuted(nextMuted);

    if (systemGainNodeRef.current) {
      systemGainNodeRef.current.gain.value = nextMuted ? 0 : 1;
    }

    if (systemAudioStreamRef.current) {
      systemAudioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    } else if (!nextMuted) {
      // Se não foi capturado na inicialização, tenta capturar sob demanda
      try {
        const sysStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
            },
          },
          video: false,
        });
        if (sysStream && sysStream.getAudioTracks().length > 0) {
          systemAudioStreamRef.current = sysStream;
          setHasSystemAudio(true);
          if (audioContextRef.current && mixerDestinationRef.current) {
            const sysSource = audioContextRef.current.createMediaStreamSource(sysStream);
            if (typeof audioContextRef.current.createGain === 'function') {
              const sysGain = audioContextRef.current.createGain();
              sysGain.gain.value = 1;
              systemGainNodeRef.current = sysGain;
              sysSource.connect(sysGain);
              sysGain.connect(mixerDestinationRef.current);
            } else {
              sysSource.connect(mixerDestinationRef.current);
            }
          }
        }
      } catch (err) {
        console.warn('[Capture] Captura de áudio do sistema sob demanda não disponível:', err);
      }
    }

    if (stream) {
      const isAnyActive = (!micMuted) || (!nextMuted);
      stream.getAudioTracks().forEach((track) => {
        track.enabled = isAnyActive;
      });
    }
  }, [stream, systemAudioMuted, micMuted]);

  const toggleVideoPause = useCallback(() => {
    if (stream) {
      const nextEnabled = videoPaused; // inverte estado
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = nextEnabled;
      });
      maskedTracksRef.current.forEach((m) => {
        m.setEnabled(nextEnabled);
      });
      setVideoPaused(!videoPaused);
    }
  }, [stream, videoPaused]);

  const stopCapture = useCallback(() => {
    if (window.electronAPI && typeof window.electronAPI.stopCursorTracking === 'function') {
      window.electronAPI.stopCursorTracking().catch(() => {});
    }
    if (maskedTracksRef.current.length > 0) {
      maskedTracksRef.current.forEach((m) => {
        try {
          m.dispose();
        } catch {}
      });
      maskedTracksRef.current = [];
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setSelectedSource(null);
    }
    if (rawAudioStreamRef.current) {
      rawAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      rawAudioStreamRef.current = null;
    }
    if (systemAudioStreamRef.current) {
      systemAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      systemAudioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    systemGainNodeRef.current = null;
    mixerDestinationRef.current = null;
    setHasSystemAudio(false);
    setSystemAudioMuted(true);
  }, [stream]);

  return {
    captureMode,
    setCaptureMode: changeCaptureMode,
    targetFps,
    setTargetFps,
    sources,
    selectedSource,
    stream,
    micMuted,
    systemAudioMuted,
    hasSystemAudio,
    videoPaused,
    hasPermissions,
    loadSources,
    refreshSources,
    selectSource,
    toggleMicMute,
    toggleSystemAudio,
    toggleVideoPause,
    stopCapture,
  };
}

