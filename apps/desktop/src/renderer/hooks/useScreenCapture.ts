import { useState, useEffect, useCallback } from 'react';
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

      // Tenta anexar microfone do professor se disponível (RF-10, RN-10)
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        audioStream.getAudioTracks().forEach((track) => {
          track.enabled = !micMuted;
          mediaStream.addTrack(track);
        });
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

