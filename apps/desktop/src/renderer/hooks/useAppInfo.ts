import { useEffect, useState } from 'react';
import type { AppInfo } from '@mlab/types';

/**
 * Pede ao main, uma vez, as informações do MLab para o rodapé e o diálogo "Sobre" (021, RF-2101/RF-2102).
 * Se o IPC falhar, devolve `null` e a tela segue sem o rodapé (RF-2107).
 */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => window.electronAPI.getAppInfo())
      .then((result) => {
        if (active && result?.version) setInfo(result);
      })
      .catch(() => {
        if (active) setInfo(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return info;
}
