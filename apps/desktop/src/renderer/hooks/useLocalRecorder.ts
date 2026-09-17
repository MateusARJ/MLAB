import { useState, useRef, useEffect, useCallback } from 'react';
import type { RecordingFormat, RecordingStatus } from '@screenshare/types';

export interface UseLocalRecorderOptions {
  stream: MediaStream | null;
  initialFormat?: RecordingFormat;
}

export function useLocalRecorder({ stream, initialFormat = 'webm' }: UseLocalRecorderOptions) {
  const [format, setFormat] = useState<RecordingFormat>(initialFormat);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const getBestMimeType = (requestedFormat: RecordingFormat): string => {
    if (requestedFormat === 'mp4') {
      const mp4Types = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4',
      ];
      for (const t of mp4Types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      }
    }

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

  const startRecording = useCallback((overrideFormat?: RecordingFormat, directStream?: MediaStream) => {
    const activeStream = directStream || stream;
    if (!activeStream) {
      setError('Nenhum stream ativo para gravação.');
      return;
    }

    const targetFormat = overrideFormat || format;
    if (overrideFormat) {
      setFormat(overrideFormat);
    }

    try {
      chunksRef.current = [];
      setError(null);
      setSavedFilePath(null);

      const mimeType = getBestMimeType(targetFormat);
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(activeStream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (chunksRef.current.length === 0) {
          setStatus('idle');
          return;
        }

        setIsSaving(true);
        try {
          const blobMime = mimeType || (targetFormat === 'mp4' ? 'video/mp4' : 'video/webm');
          const completeBlob = new Blob(chunksRef.current, { type: blobMime });
          const arrayBuffer = await completeBlob.arrayBuffer();

          if (window.electronAPI && window.electronAPI.saveRecordedVideo) {
            const res = await window.electronAPI.saveRecordedVideo(arrayBuffer, undefined, targetFormat);
            if (res.success && res.filePath) {
              setSavedFilePath(res.filePath);
            } else if (res.error) {
              setError(res.error);
            }
          }
        } catch (err: any) {
          console.error('Erro ao processar e salvar gravação:', err);
          setError(err.message || 'Erro ao processar gravação');
        } finally {
          setIsSaving(false);
          setStatus('stopped');
        }
      };

      recorder.start(1000); // chunk a cada 1s
      mediaRecorderRef.current = recorder;
      setStatus('recording');
      setDuration(0);

      // Timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
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
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
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
