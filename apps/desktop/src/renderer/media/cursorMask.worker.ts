import type { CursorState } from '@mlab/types';

interface InitMessage {
  type: 'init';
  readable: ReadableStream<VideoFrame>;
  writable: WritableStream<VideoFrame>;
}

interface CursorMessage {
  type: 'cursor';
  state: CursorState;
}

type WorkerInboundMessage = InitMessage | CursorMessage;

let currentState: CursorState = {
  visible: true,
  rect: null,
};

let lastCursorRect: { x: number; y: number; w: number; h: number } | null = null;
let cursorStationarySince = 0;

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number } | null,
  b: { x: number; y: number; w: number; h: number } | null
): boolean {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateCursorState(next: CursorState) {
  const prevRect = currentState.rect;
  const nextRect = next.rect;
  const now = performance.now();

  if (!prevRect || !nextRect) {
    cursorStationarySince = now;
  } else {
    const dx = Math.abs(prevRect.x - nextRect.x);
    const dy = Math.abs(prevRect.y - nextRect.y);
    if (dx > 0.003 || dy > 0.003) {
      cursorStationarySince = now;
    }
  }

  currentState = next;
}

self.onmessage = (evt: MessageEvent<WorkerInboundMessage>) => {
  const data = evt.data;
  if (!data) return;

  if (data.type === 'cursor') {
    updateCursorState(data.state);
    return;
  }

  if (data.type === 'init') {
    runPipeline(data.readable, data.writable).catch((err) => {
      try {
        self.postMessage({ type: 'fatal', message: String(err) });
      } catch {}
    });
  }
};

async function runPipeline(
  readable: ReadableStream<VideoFrame>,
  writable: WritableStream<VideoFrame>
): Promise<void> {
  const reader = readable.getReader();
  const writer = writable.getWriter();

  let width = 0;
  let height = 0;
  let outCanvas: OffscreenCanvas | null = null;
  let outCtx: OffscreenCanvasRenderingContext2D | null = null;
  let plateCanvas: OffscreenCanvas | null = null;
  let plateCtx: OffscreenCanvasRenderingContext2D | null = null;
  let patchCanvas: OffscreenCanvas | null = null;
  let patchCtx: OffscreenCanvasRenderingContext2D | null = null;
  let blurCanvas: OffscreenCanvas | null = null;
  let blurCtx: OffscreenCanvasRenderingContext2D | null = null;

  let plateInitialized = false;
  let lastPlateUpdateAt = 0;
  let degraded = false;
  let avgProcessMs = 0;

  const ensureCanvases = (w: number, h: number): boolean => {
    if (w <= 0 || h <= 0 || typeof OffscreenCanvas === 'undefined') return false;
    if (outCanvas && width === w && height === h) return true;

    width = w;
    height = h;
    outCanvas = new OffscreenCanvas(w, h);
    outCtx = outCanvas.getContext('2d', { alpha: false });
    plateCanvas = new OffscreenCanvas(w, h);
    plateCtx = plateCanvas.getContext('2d', { alpha: false });
    patchCanvas = new OffscreenCanvas(256, 256);
    patchCtx = patchCanvas.getContext('2d', { alpha: false });
    blurCanvas = new OffscreenCanvas(32, 32);
    blurCtx = blurCanvas.getContext('2d', { alpha: false });
    plateInitialized = false;
    return !!(outCtx && plateCtx && patchCtx && blurCtx);
  };

  const toPixelRect = (norm: { x: number; y: number; w: number; h: number }) => {
    const x = Math.max(0, Math.floor(norm.x * width));
    const y = Math.max(0, Math.floor(norm.y * height));
    const w = Math.min(width - x, Math.ceil(norm.w * width));
    const h = Math.min(height - y, Math.ceil(norm.h * height));
    return { x, y, w, h };
  };

  /**
   * Atualiza o background plate preservando a região onde o cursor está no momento,
   * evitando gravar o desenho do ponteiro na placa de fundo limpa.
   */
  const updatePlatePreservingCursor = (
    frame: VideoFrame,
    cursorNorm: { x: number; y: number; w: number; h: number } | null
  ) => {
    if (!plateCtx || !plateCanvas || !patchCtx || !patchCanvas) return;

    if (!plateInitialized || !cursorNorm) {
      plateCtx.drawImage(frame, 0, 0, width, height);
      plateInitialized = true;
      lastCursorRect = cursorNorm;
      return;
    }

    const px = toPixelRect(cursorNorm);
    if (px.w <= 0 || px.h <= 0) {
      plateCtx.drawImage(frame, 0, 0, width, height);
      return;
    }

    const saveW = Math.min(patchCanvas.width, px.w);
    const saveH = Math.min(patchCanvas.height, px.h);

    // Salva a região limpa anterior antes de atualizar o restante do quadro
    patchCtx.drawImage(plateCanvas, px.x, px.y, px.w, px.h, 0, 0, saveW, saveH);
    plateCtx.drawImage(frame, 0, 0, width, height);
    plateCtx.drawImage(patchCanvas, 0, 0, saveW, saveH, px.x, px.y, px.w, px.h);
    lastCursorRect = cursorNorm;
  };

  /**
   * Preenche o retângulo do cursor interpolando a vizinhança imediata do quadro ao vivo
   * quando o cursor fica estacionado sobre vídeo em movimento.
   */
  const inpaintFromNeighborhood = (px: { x: number; y: number; w: number; h: number }) => {
    if (!outCtx || !outCanvas || !blurCtx || !blurCanvas) return;
    const margin = 10;
    const sx = Math.max(0, px.x - margin);
    const sy = Math.max(0, px.y - margin);
    const sw = Math.min(width - sx, px.w + margin * 2);
    const sh = Math.min(height - sy, px.h + margin * 2);
    if (sw <= 0 || sh <= 0) return;

    // Copia as bordas externas ao redor do cursor para um buffer reduzido e reescala suavizado
    blurCtx.clearRect(0, 0, 32, 32);
    // Topo e base ao redor do cursor
    if (px.y > margin) {
      blurCtx.drawImage(outCanvas, sx, sy, sw, margin, 0, 0, 32, 16);
    }
    if (px.y + px.h + margin <= height) {
      blurCtx.drawImage(outCanvas, sx, px.y + px.h, sw, margin, 0, 16, 32, 16);
    } else {
      blurCtx.drawImage(outCanvas, sx, sy, sw, margin, 0, 16, 32, 16);
    }
    outCtx.imageSmoothingEnabled = true;
    outCtx.drawImage(blurCanvas, 0, 0, 32, 32, px.x, px.y, px.w, px.h);
  };

  try {
    while (true) {
      const { done, value: frame } = await reader.read();
      if (done || !frame) break;

      const state = currentState;
      const now = performance.now();

      // Caminho rápido (passthrough zero-copy): cursor visível, fora da fonte ou pipeline degradado
      if (degraded || state.visible || !state.rect) {
        if (!degraded && ensureCanvases(frame.codedWidth || frame.displayWidth, frame.codedHeight || frame.displayHeight)) {
          if (!plateInitialized || now - lastPlateUpdateAt >= 90) {
            try {
              updatePlatePreservingCursor(frame, state.rect);
              lastPlateUpdateAt = now;
            } catch {}
          }
        }
        await writer.write(frame);
        frame.close();
        continue;
      }

      // Caminho de ocultação do cursor (state.visible === false && state.rect !== null)
      const t0 = performance.now();
      const fw = frame.codedWidth || frame.displayWidth;
      const fh = frame.codedHeight || frame.displayHeight;

      if (!ensureCanvases(fw, fh) || !outCtx || !outCanvas || !plateCtx || !plateCanvas) {
        await writer.write(frame);
        frame.close();
        continue;
      }

      try {
        outCtx.drawImage(frame, 0, 0, width, height);
        const px = toPixelRect(state.rect);

        if (px.w > 0 && px.h > 0) {
          const stationaryMs = now - cursorStationarySince;
          const hadOverlapOnInit = !plateInitialized || rectsOverlap(state.rect, lastCursorRect);

          if (plateInitialized && (!hadOverlapOnInit || stationaryMs < 350)) {
            outCtx.drawImage(plateCanvas, px.x, px.y, px.w, px.h, px.x, px.y, px.w, px.h);
          } else {
            inpaintFromNeighborhood(px);
          }
        }

        // Mantém o restante da placa de fundo atualizado a cada 90ms mesmo com cursor oculto
        if (!plateInitialized || now - lastPlateUpdateAt >= 90) {
          updatePlatePreservingCursor(frame, state.rect);
          lastPlateUpdateAt = now;
        }

        const cleanFrame = new VideoFrame(outCanvas, {
          timestamp: frame.timestamp,
          duration: frame.duration ?? undefined,
        });
        frame.close();
        await writer.write(cleanFrame);
        cleanFrame.close();

        const dt = performance.now() - t0;
        avgProcessMs = avgProcessMs === 0 ? dt : avgProcessMs * 0.92 + dt * 0.08;
        if (avgProcessMs > 8.5) {
          degraded = true;
          try {
            self.postMessage({ type: 'degraded', avgProcessMs });
          } catch {}
        }
      } catch {
        // Fallback imediato em caso de erro de composição no frame
        try {
          await writer.write(frame);
        } catch {}
        try {
          frame.close();
        } catch {}
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
    try {
      await writer.close();
    } catch {}
  }
}
