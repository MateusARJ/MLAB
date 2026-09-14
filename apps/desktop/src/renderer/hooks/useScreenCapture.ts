import { useState, useEffect, useCallback } from 'react';

export interface Source {
  id: string;
  name: string;
  thumbnail: string;
}

export function useScreenCapture() {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  useEffect(() => {
    // Checagem prévia de permissões do SO (RF-24)
    if (window.electronAPI && window.electronAPI.getScreenSources) {
      window.electronAPI.getScreenSources()
        .then((srcs) => {
          setSources(srcs);
          setHasPermissions(true);
        })
        .catch(() => {
          setHasPermissions(false);
        });
    } else {
      setHasPermissions(true);
    }
  }, []);

  const selectSource = useCallback(async (source: Source) => {
    setSelectedSource(source);
    try {
      // Captura via desktopCapturer constraints (RF-04)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-ignore
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          },
        },
      });

      // Tenta anexar microfone se disponivel (RF-10, RN-10)
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getAudioTracks().forEach((track) => mediaStream.addTrack(track));
      } catch (err) {
        console.warn('Microfone nao disponivel ou nao concedido');
      }

      setStream(mediaStream);
    } catch (err) {
      console.error('Erro ao capturar stream de tela:', err);
    }
  }, []);

  const toggleMicMute = useCallback(() => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = micMuted; // Inverte o estado atual
      });
      setMicMuted(!micMuted);
    }
  }, [stream, micMuted]);

  const toggleVideoPause = useCallback(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = videoPaused; // Inverte o estado atual
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
    sources,
    selectedSource,
    stream,
    micMuted,
    videoPaused,
    hasPermissions,
    selectSource,
    toggleMicMute,
    toggleVideoPause,
    stopCapture,
  };
}
