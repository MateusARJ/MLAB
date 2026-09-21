import { useState, useRef, useEffect, useCallback } from 'react';
import type { RecordingFormat, RecordingStatus } from '@mlab/types';
import { fixWebmDuration } from '../utils/webmFixer';

export interface UseLocalRecorderOptions {
  stream: MediaStream | null;
  initialFormat?: RecordingFormat;
}

export function useLocalRecorder({ stream }: UseLocalRecorderOptions) {
  const [format, setFormat] = useState<RecordingFormat>('webm');
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const saveResolverRef = useRef<((val: { success: boolean; filePath?: string }) => void) | null>(null);

  const getBestMimeType = (): string => {
    // Padrão de alta definição WebM (suportado universalmente pelo Electron)
    const webmTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const t of webmTypes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  const startRecording = useCallback((_overrideFormat?: RecordingFormat, directStream?: MediaStream) => {
    const activeStream = directStream || stream;
    if (!activeStream) {
      setError('Nenhum stream ativo para gravação.');
      return;
    }

    // Se já havia um gravador ativo, encerra de forma limpa antes de iniciar o novo
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Erro ao finalizar gravador anterior:', e);
      }
    }

    try {
      chunksRef.current = [];
      setError(null);
      setSavedFilePath(null);

      const mimeType = getBestMimeType();
      const options: MediaRecorderOptions = {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 4000000, // 4 Mbps para 1080p (RF-04, RNF-01)
      };
      const recorder = new MediaRecorder(activeStream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (chunksRef.current.length === 0) {
          setStatus('idle');
          if (saveResolverRef.current) {
            saveResolverRef.current({ success: false });
            saveResolverRef.current = null;
          }
          return;
        }

        setIsSaving(true);
        try {
          const blobMime = mimeType || 'video/webm';
          const rawBlob = new Blob(chunksRef.current, { type: blobMime });

          // Injeta a duração real no cabeçalho EBML para WebM, eliminando corrupção e permitindo navegação na timeline
          const finalBlob = await fixWebmDuration(rawBlob, durationRef.current * 1000);
          const arrayBuffer = await finalBlob.arrayBuffer();

          if (window.electronAPI && window.electronAPI.saveRecordedVideo) {
            const res = await window.electronAPI.saveRecordedVideo(arrayBuffer, undefined, 'webm');
            if (res.success && res.filePath) {
              setSavedFilePath(res.filePath);
              if (saveResolverRef.current) {
                saveResolverRef.current({ success: true, filePath: res.filePath });
              }
            } else if (res.error) {
              setError(res.error);
              if (saveResolverRef.current) {
                saveResolverRef.current({ success: false });
              }
            } else {
              // Diálogo cancelado pelo usuário
              if (saveResolverRef.current) {
                saveResolverRef.current({ success: false });
              }
            }
          } else {
            if (saveResolverRef.current) {
              saveResolverRef.current({ success: false });
            }
          }
        } catch (err: any) {
          console.error('Erro ao processar e salvar gravação:', err);
          setError(err.message || 'Erro ao processar gravação');
          if (saveResolverRef.current) {
            saveResolverRef.current({ success: false });
          }
        } finally {
          saveResolverRef.current = null;
          setIsSaving(false);
          setStatus('stopped');
        }
      };

      recorder.start(1000); // chunk a cada 1s
      mediaRecorderRef.current = recorder;
      setStatus('recording');
      durationRef.current = 0;
      setDuration(0);

      // Timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao iniciar MediaRecorder:', err);
      setError(err.message || 'Falha ao iniciar gravação.');
      setStatus('idle');
    }
  }, [stream, format]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      timerRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);
    }
  }, []);

  const stopRecording = useCallback((): Promise<{ success: boolean; filePath?: string }> => {
    return new Promise((resolve) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        saveResolverRef.current = resolve;
        mediaRecorderRef.current.stop();
      } else {
        resolve({ success: false });
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatDuration = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  return {
    format,
    setFormat,
    status,
    duration,
    formattedDuration: formatDuration(duration),
    isSaving,
    savedFilePath,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
