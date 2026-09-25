import { useState, useEffect, useCallback, useRef } from 'react';
import type { CaptureSource, CaptureSourceType } from '@mlab/types';

export type Source = CaptureSource;

export function useScreenCapture(initialMode: CaptureSourceType = 'screen') {
  const [captureMode, setCaptureMode] = useState<CaptureSourceType>(initialMode);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const rawAudioStreamRef = useRef<MediaStream | null>(null);

  const loadSources = useCallback(async (mode: CaptureSourceType) => {
    if (window.electronAPI && window.electronAPI.getScreenSources) {
      try {
        const srcs = await window.electronAPI.getScreenSources(mode);
        // Filtra janelas do próprio MLab para evitar captura em espelho recursivo
        const filtered = srcs.filter((s) => {
          if (mode === 'window') {
            const name = s.name.toLowerCase();
            return !name.includes('mlab') && s.name.trim().length > 0;
          }
          return true;
        });
        setSources(filtered);
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

  useEffect(() => {
    loadSources(captureMode);
  }, [captureMode, loadSources]);

  const changeCaptureMode = useCallback((mode: CaptureSourceType) => {
    setCaptureMode(mode);
    setSelectedSource(null);
  }, []);

  const selectSource = useCallback(async (source: CaptureSource): Promise<MediaStream | null> => {
    setSelectedSource(source);
    try {
      let mediaStream: MediaStream;
      try {
        // Tenta capturar cravando resolução de alta fidelidade 1080p @ 30fps (RF-04, RNF-01, RNF-02)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              minWidth: 1920,
              maxWidth: 1920,
              minHeight: 1080,
              maxHeight: 1080,
              minFrameRate: 30,
              maxFrameRate: 30,
            },
          },
        });
      } catch {
        // Fallback flexível para monitores ou janelas com dimensões menores que 1080p (ex: 1366x768 ou janelas isoladas)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxWidth: 1920,
              maxHeight: 1080,
              minFrameRate: 30,
              maxFrameRate: 30,
            },
          },
        });
      }

      // Crava contentHint='detail' para que o encoder VP8 priorize nitidez de código/texto e evite suavização espacial
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        // @ts-ignore
        videoTrack.contentHint = 'detail';
        const settings = videoTrack.getSettings();
        console.log(`[Capture] Resolução capturada: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
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

        let finalAudioTrack: MediaStreamTrack | null = null;

        // Processamento Web Audio API: Highpass 85Hz + Lowpass 7.5kHz + DynamicsCompressor (Hard Limiter Anti-Howling)
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

              const destination = audioCtx.createMediaStreamDestination();
              sourceNode.connect(highpass);
              highpass.connect(lowpass);
              lowpass.connect(limiter);
              limiter.connect(destination);

              const processedTracks = destination.stream.getAudioTracks();
              if (processedTracks.length > 0) {
                finalAudioTrack = processedTracks[0];
              }
            }
          } catch (dspErr) {
            console.warn('[Capture] Falha ao inicializar Web Audio limiter, utilizando faixa bruta:', dspErr);
          }
        }

        const trackToAdd = finalAudioTrack || rawAudioStream.getAudioTracks()[0];
        if (trackToAdd) {
          trackToAdd.enabled = !micMuted;
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
  }, [stream, micMuted]);

  const toggleMicMute = useCallback(() => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = micMuted; // inverte estado
      });
      if (rawAudioStreamRef.current) {
        rawAudioStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = micMuted;
        });
      }
      setMicMuted(!micMuted);
    }
  }, [stream, micMuted]);

  const toggleVideoPause = useCallback(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = videoPaused; // inverte estado
      });
      setVideoPaused(!videoPaused);
    }
  }, [stream, videoPaused]);

  const stopCapture = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setSelectedSource(null);
    }
    if (rawAudioStreamRef.current) {
      rawAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      rawAudioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [stream]);

  return {
    captureMode,
    setCaptureMode: changeCaptureMode,
    sources,
    selectedSource,
    stream,
    micMuted,
    videoPaused,
    hasPermissions,
    loadSources,
    selectSource,
    toggleMicMute,
    toggleVideoPause,
    stopCapture,
  };
}

