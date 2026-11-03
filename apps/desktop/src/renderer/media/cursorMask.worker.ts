import type { AnnotationOverlayState, AnnotationStroke, CursorState } from '@mlab/types';
import {
  CursorTrail,
  decideFramePath,
  FrameBudgetGuard,
  rectsOverlap,
  type FrameBudgetEvent,
  type NormRect,
} from './cursorMaskPolicy';
import {
  copyAllExcept,
  copyRect,
  fillFromNeighborhood,
  frameGeometry,
  planeSpecs,
  toPixelRect as toPixelRectIn,
  type FrameGeometry,
} from './cursorMaskFrame';

interface InitMessage {
  type: 'init';
  readable: ReadableStream<VideoFrame>;
  writable: WritableStream<VideoFrame>;
}

interface CursorMessage {
  type: 'cursor';
  state: CursorState;
}

interface AnnotationsMessage {
  type: 'annotations';
  state: AnnotationOverlayState;
}

type WorkerInboundMessage = InitMessage | CursorMessage | AnnotationsMessage;

let currentState: CursorState = {
  visible: true,
  rect: null,
};

let currentAnnotations: AnnotationOverlayState = {
  strokes: [],
  activeStroke: null,
  spotlight: {
    enabled: false,
    x: 0.5,
    y: 0.5,
    radius: 0.14,
    zoom: 1,
    activeInViewer: false,
  },
  captureMode: 'screen',
  externalOverlayActive: true,
};

// Rastro do cursor (C-703): cobre o atraso entre o estado recebido e o quadro capturado.
const cursorTrail = new CursorTrail();

function updateCursorState(next: CursorState) {
  currentState = next;
  cursorTrail.push(next, performance.now());
}

self.onmessage = (evt: MessageEvent<WorkerInboundMessage>) => {
  const data = evt.data;
  if (!data) return;

  if (data.type === 'cursor') {
    updateCursorState(data.state);
    return;
  }

  if (data.type === 'annotations') {
    if (data.state) {
      currentAnnotations = data.state;
    }
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
  // Região da placa que nasceu com o cursor desenhado (sem pixel limpo conhecido); null = placa toda limpa.
  let plateDirtyRect: NormRect | null = null;
  const budgetGuard = new FrameBudgetGuard();
  const postBudgetEvent = (event: FrameBudgetEvent | null) => {
    if (!event) return;
    try {
      self.postMessage(event);
    } catch {}
  };

  /**
   * Máscara em memória (T708): planos do quadro copiados para `work`, placa de fundo em `plate` (mesmo layout).
   * O quadro de saída é criado a partir de `work` no formato do capturado, sem passar pela GPU, como no repasse.
   */
  interface MemState {
    format: VideoPixelFormat;
    size: number;
    work: Uint8Array;
    plate: Uint8Array;
    geom: FrameGeometry | null;
    layout: PlaneLayout[] | null;
    plateInitialized: boolean;
    plateDirtyRect: NormRect | null;
  }
  let mem: MemState | null = null;

  const isMemCapable = (frame: VideoFrame): boolean =>
    planeSpecs(frame.format) !== null && typeof frame.copyTo === 'function';

  const sameLayout = (a: PlaneLayout[] | null, b: PlaneLayout[]): boolean =>
    !!a && a.length === b.length && a.every((p, i) => p.offset === b[i].offset && p.stride === b[i].stride);

  /** Copia os planos do quadro para `mem.work`; geometria ou formato novos reiniciam a placa. */
  const copyFrameToMem = async (frame: VideoFrame): Promise<MemState | null> => {
    const format = frame.format;
    if (!format) return null;
    const w = frame.visibleRect?.width ?? frame.codedWidth;
    const h = frame.visibleRect?.height ?? frame.codedHeight;
    const size = frame.allocationSize();
    if (!mem || mem.size !== size || mem.format !== format || mem.geom?.width !== w || mem.geom?.height !== h) {
      mem = {
        format,
        size,
        work: new Uint8Array(size),
        plate: new Uint8Array(size),
        geom: null,
        layout: null,
        plateInitialized: false,
        plateDirtyRect: null,
      };
    }
    const m = mem;
    const layout = await frame.copyTo(m.work);
    const geom = frameGeometry(format, w, h, layout);
    if (!geom) return null;
    if (m.layout && !sameLayout(m.layout, layout)) {
      m.plateInitialized = false;
      m.plateDirtyRect = null;
    }
    m.geom = geom;
    m.layout = layout;
    return m;
  };

  /** Mesmas regras de `updatePlatePreservingCursor`, sobre os buffers (RF-702, RF-706). */
  const updateMemPlate = (m: MemState, preserveNorm: NormRect | null) => {
    const geom = m.geom;
    if (!geom) return;
    if (!m.plateInitialized) {
      m.plate.set(m.work);
      m.plateInitialized = true;
      m.plateDirtyRect = preserveNorm;
      return;
    }
    const px = preserveNorm ? toPixelRectIn(preserveNorm, geom.width, geom.height) : null;
    if (!px || px.w <= 0 || px.h <= 0) {
      m.plate.set(m.work);
      m.plateDirtyRect = null;
      return;
    }
    copyAllExcept(m.work, m.plate, geom, px);
    if (m.plateDirtyRect && !rectsOverlap(preserveNorm, m.plateDirtyRect)) {
      m.plateDirtyRect = null;
    }
  };

  /** Apaga o cursor em `m.work` e devolve o quadro de saída no formato e resolução do capturado (RF-701, RF-704). */
  const buildMemMaskedFrame = (
    frame: VideoFrame,
    m: MemState,
    maskNorm: NormRect,
    preserveNorm: NormRect | null,
    now: number
  ): VideoFrame | null => {
    const geom = m.geom;
    if (!geom || !m.layout) return null;
    if (!m.plateInitialized || now - lastPlateUpdateAt >= 90) {
      updateMemPlate(m, preserveNorm);
      lastPlateUpdateAt = now;
    }
    const px = toPixelRectIn(maskNorm, geom.width, geom.height);
    if (px.w > 0 && px.h > 0) {
      if (m.plateInitialized && !rectsOverlap(maskNorm, m.plateDirtyRect)) {
        copyRect(m.plate, m.work, geom, px);
      } else {
        fillFromNeighborhood(m.work, geom, px);
      }
    }
    let colorSpace: VideoColorSpaceInit | undefined;
    try {
      colorSpace = frame.colorSpace?.toJSON();
    } catch {}
    return new VideoFrame(m.work, {
      format: m.format,
      codedWidth: geom.width,
      codedHeight: geom.height,
      displayWidth: frame.displayWidth,
      displayHeight: frame.displayHeight,
      timestamp: frame.timestamp,
      duration: frame.duration ?? undefined,
      layout: m.layout,
      colorSpace,
    });
  };

  const ensureOutCanvas = (w: number, h: number): boolean => {
    if (w <= 0 || h <= 0 || typeof OffscreenCanvas === 'undefined') return false;
    if (outCanvas && width === w && height === h && outCtx) return true;

    width = w;
    height = h;
    outCanvas = new OffscreenCanvas(w, h);
    outCtx = outCanvas.getContext('2d', { alpha: false });
    plateCanvas = null;
    plateCtx = null;
    plateInitialized = false;
    return !!outCtx;
  };

  const ensureCursorMaskCanvases = (w: number, h: number): boolean => {
    if (!ensureOutCanvas(w, h)) return false;
    if (plateCanvas && plateCtx && blurCanvas && blurCtx) {
      return true;
    }
    plateCanvas = new OffscreenCanvas(w, h);
    plateCtx = plateCanvas.getContext('2d', { alpha: false });
    patchCanvas = null;
    patchCtx = null;
    blurCanvas = new OffscreenCanvas(32, 32);
    blurCtx = blurCanvas.getContext('2d', { alpha: false });
    plateInitialized = false;
    plateDirtyRect = null;
    return !!(plateCtx && blurCtx);
  };

  const toPixelRect = (norm: { x: number; y: number; w: number; h: number }) => {
    const x = Math.max(0, Math.floor(norm.x * width));
    const y = Math.max(0, Math.floor(norm.y * height));
    const w = Math.min(width - x, Math.ceil(norm.w * width));
    const h = Math.min(height - y, Math.ceil(norm.h * height));
    return { x, y, w, h };
  };

  const ensurePatchSize = (w: number, h: number): boolean => {
    if (patchCanvas && patchCtx && patchCanvas.width >= w && patchCanvas.height >= h) return true;
    const pw = Math.min(width, Math.max(256, w, patchCanvas?.width ?? 0));
    const ph = Math.min(height, Math.max(256, h, patchCanvas?.height ?? 0));
    patchCanvas = new OffscreenCanvas(pw, ph);
    patchCtx = patchCanvas.getContext('2d', { alpha: false });
    return !!patchCtx;
  };

  /**
   * Atualiza a placa de fundo com o quadro atual, preservando a área onde o cursor pode estar desenhado
   * (rastro recente). A região suja de quando a placa nasceu passa a ser limpa assim que uma atualização
   * não a sobrepõe (RF-706).
   */
  const updatePlatePreservingCursor = (frame: VideoFrame, preserveNorm: NormRect | null) => {
    if (!plateCtx || !plateCanvas) return;

    if (!plateInitialized) {
      plateCtx.drawImage(frame, 0, 0, width, height);
      plateInitialized = true;
      plateDirtyRect = preserveNorm;
      return;
    }

    const px = preserveNorm ? toPixelRect(preserveNorm) : null;
    if (!px || px.w <= 0 || px.h <= 0) {
      plateCtx.drawImage(frame, 0, 0, width, height);
      plateDirtyRect = null;
      return;
    }

    if (!ensurePatchSize(px.w, px.h) || !patchCtx || !patchCanvas) return;
    patchCtx.drawImage(plateCanvas, px.x, px.y, px.w, px.h, 0, 0, px.w, px.h);
    plateCtx.drawImage(frame, 0, 0, width, height);
    plateCtx.drawImage(patchCanvas, 0, 0, px.w, px.h, px.x, px.y, px.w, px.h);
    if (plateDirtyRect && !rectsOverlap(preserveNorm, plateDirtyRect)) {
      plateDirtyRect = null;
    }
  };

  const inpaintFromNeighborhood = (px: { x: number; y: number; w: number; h: number }) => {
    if (!outCtx || !outCanvas || !blurCtx || !blurCanvas) return;
    const margin = 10;
    const sx = Math.max(0, px.x - margin);
    const sy = Math.max(0, px.y - margin);
    const sw = Math.min(width - sx, px.w + margin * 2);
    const sh = Math.min(height - sy, px.h + margin * 2);
    if (sw <= 0 || sh <= 0) return;

    blurCtx.clearRect(0, 0, 32, 32);
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

  /**
   * Apaga o cursor do quadro composto: copia da placa de fundo sempre que ela tem pixels limpos na área, inclusive
   * com o cursor parado; o preenchimento pelo entorno (borrado) só é usado sem pixel limpo conhecido (RF-706).
   * Durante a ocultação a placa é atualizada a cada 90 ms, preservando o rastro (RF-701, C-703).
   */
  const maskCursorRegion = (
    frame: VideoFrame,
    maskNorm: NormRect,
    preserveNorm: NormRect | null,
    now: number
  ) => {
    if (!outCtx || !plateCanvas) return;
    const px = toPixelRect(maskNorm);
    if (px.w > 0 && px.h > 0) {
      if (plateInitialized && !rectsOverlap(maskNorm, plateDirtyRect)) {
        outCtx.drawImage(plateCanvas, px.x, px.y, px.w, px.h, px.x, px.y, px.w, px.h);
      } else {
        inpaintFromNeighborhood(px);
      }
    }

    if (!plateInitialized || now - lastPlateUpdateAt >= 90) {
      updatePlatePreservingCursor(frame, preserveNorm);
      lastPlateUpdateAt = now;
    }
  };

  const drawStrokeOnCanvas = (
    ctx: OffscreenCanvasRenderingContext2D,
    stroke: AnnotationStroke,
    w: number,
    h: number
  ) => {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    const scale = Math.max(1, w / 1280);
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = stroke.size * 3.2 * scale;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
    } else {
      ctx.globalAlpha = 1;
      ctx.lineWidth = stroke.size * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    if (stroke.tool === 'pen' || stroke.tool === 'highlighter') {
      ctx.beginPath();
      const first = pts[0];
      ctx.moveTo(first.x * w, first.y * h);
      if (pts.length === 1) {
        ctx.lineTo(first.x * w + 0.5, first.y * h + 0.5);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * w, pts[i].y * h);
        }
      }
      ctx.stroke();
    } else if (stroke.tool === 'rect' && pts.length >= 2) {
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      const rx = Math.min(p0.x, p1.x) * w;
      const ry = Math.min(p0.y, p1.y) * h;
      const rw = Math.abs(p1.x - p0.x) * w;
      const rh = Math.abs(p1.y - p0.y) * h;
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (stroke.tool === 'arrow' && pts.length >= 2) {
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      const x0 = p0.x * w;
      const y0 = p0.y * h;
      const x1 = p1.x * w;
      const y1 = p1.y * h;
      const headLen = Math.max(12, stroke.size * 3.5 * scale);
      const angle = Math.atan2(y1 - y0, x1 - x0);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  const renderAnnotationsAndSpotlight = (
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    ann: AnnotationOverlayState,
    cursorRect: { x: number; y: number; w: number; h: number } | null
  ) => {
    for (let i = 0; i < ann.strokes.length; i++) {
      drawStrokeOnCanvas(ctx, ann.strokes[i], width, height);
    }
    if (ann.activeStroke) {
      drawStrokeOnCanvas(ctx, ann.activeStroke, width, height);
    }

    if (ann.spotlight.enabled) {
      let normX = ann.spotlight.x;
      let normY = ann.spotlight.y;
      if (!ann.spotlight.activeInViewer && cursorRect) {
        normX = Math.min(1, Math.max(0, cursorRect.x + cursorRect.w * 0.35));
        normY = Math.min(1, Math.max(0, cursorRect.y + cursorRect.h * 0.35));
      }

      const cx = normX * width;
      const cy = normY * height;
      const minDim = Math.min(width, height);
      const radius = Math.max(36, ann.spotlight.radius * minDim);
      const zoom = ann.spotlight.zoom || 1;

      if (zoom > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        const srcW = (radius * 2) / zoom;
        const srcH = (radius * 2) / zoom;
        const srcX = cx - srcW / 2;
        const srcY = cy - srcH / 2;
        ctx.drawImage(canvas, srcX, srcY, srcW, srcH, cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      // Otimização de alta performance: 4 retângulos ao redor da caixa delimitadora do círculo
      // (reduz em 95% o cálculo de rasterização evenodd no OffscreenCanvas da CPU)
      const left = Math.max(0, cx - radius);
      const right = Math.min(width, cx + radius);
      const top = Math.max(0, cy - radius);
      const bottom = Math.min(height, cy + radius);

      if (top > 0) ctx.fillRect(0, 0, width, top);
      if (bottom < height) ctx.fillRect(0, bottom, width, height - bottom);
      if (left > 0) ctx.fillRect(0, top, left, bottom - top);
      if (right < width) ctx.fillRect(right, top, width - right, bottom - top);

      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.fill('evenodd');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = Math.max(2, 2.5 * (width / 1280));
      ctx.stroke();
      ctx.restore();
    }
  };

  try {
    while (true) {
      const { done, value: frame } = await reader.read();
      if (done || !frame) break;

      const state = currentState;
      const ann = currentAnnotations;
      // Decisão por quadro (007, cursorMaskPolicy). No modo 'screen' com overlay externo, o capturador
      // do SO já captura traços e Lupa; o worker só desenha o que a captura nativa não cobre.
      // Proteção de FPS (RF-703): a máscara pode estar suspensa por custo; as anotações nunca são suspensas.
      postBudgetEvent(budgetGuard.poll());
      const now = performance.now();
      const maskRect = cursorTrail.maskRect(now);
      const preserveRect = cursorTrail.anyRect(now);
      const path = decideFramePath(maskRect, ann, budgetGuard.isSuspended);

      // Resolução de exibição (sem o preenchimento do buffer codificado, ex.: 1088 linhas em NV12):
      // mantém a mesma resolução do repasse e evita reconfigurar o encoder a cada alternância (RF-704).
      const fw = frame.displayWidth || frame.codedWidth;
      const fh = frame.displayHeight || frame.codedHeight;

      // Caminho rápido sem cópia: o quadro capturado segue direto, sem gerar quadro novo, quando o cursor deve
      // aparecer (ou está fora da fonte) e não há overlay no worker (RF-702).
      const memCapable = isMemCapable(frame);

      /**
       * Mantém a placa de fundo a cada 250 ms fora da máscara, para que, quando o cursor precisar sumir, já existam
       * pixels limpos da área onde ele vai parar (RF-702, RF-706): uma cópia do quadro, sem gerar quadro novo.
       * Em memória quando o formato permite (T708); senão, no canvas. O custo entra na proteção de FPS (RF-703).
       */
      const refreshPlateOutsideMask = async () => {
        if (budgetGuard.isSuspended || now - lastPlateUpdateAt < 250) return;
        try {
          const t0 = performance.now();
          if (memCapable) {
            const m = await copyFrameToMem(frame);
            if (!m) return;
            updateMemPlate(m, preserveRect);
          } else {
            if (!ensureCursorMaskCanvases(fw, fh)) return;
            updatePlatePreservingCursor(frame, preserveRect);
          }
          lastPlateUpdateAt = now;
          postBudgetEvent(budgetGuard.record(performance.now() - t0));
        } catch {}
      };

      if (!path.compose) {
        await refreshPlateOutsideMask();
        await writer.write(frame);
        frame.close();
        continue;
      }

      // Máscara em memória (T708): o quadro sai no formato do capturado, sem leitura da GPU pelo encoder.
      // A proteção de FPS mede composição + entrega ao gerador (RF-703).
      if (path.maskCursor && maskRect !== null && memCapable) {
        const t0 = performance.now();
        let masked: VideoFrame | null = null;
        try {
          const m = await copyFrameToMem(frame);
          masked = m ? buildMemMaskedFrame(frame, m, maskRect, preserveRect, t0) : null;
        } catch {
          masked = null;
        }
        if (masked) {
          let out: VideoFrame = masked;
          const annReady = path.drawAnnotations && ensureOutCanvas(fw, fh);
          const annCtx = outCtx as OffscreenCanvasRenderingContext2D | null;
          const annCanvas = outCanvas as OffscreenCanvas | null;
          if (annReady && annCtx && annCanvas) {
            // Anotações sobre o quadro já mascarado; o canvas só entra quando há o que desenhar.
            try {
              annCtx.drawImage(masked, 0, 0, width, height);
              renderAnnotationsAndSpotlight(annCtx, annCanvas, ann, state.rect);
              out = new VideoFrame(annCanvas, {
                timestamp: frame.timestamp,
                duration: frame.duration ?? undefined,
              });
              masked.close();
            } catch {
              out = masked;
            }
          }
          frame.close();
          try {
            await writer.write(out);
          } finally {
            out.close();
          }
          postBudgetEvent(budgetGuard.record(performance.now() - t0));
          continue;
        }
        // Falha em memória: segue pelo canvas abaixo, com o quadro original intacto.
      }

      const maskCursor = path.maskCursor && maskRect !== null && ensureCursorMaskCanvases(fw, fh);
      const outReady = ensureOutCanvas(fw, fh);
      const ctx = outCtx as OffscreenCanvasRenderingContext2D | null;
      const canvas = outCanvas as OffscreenCanvas | null;

      if (!outReady || !ctx || !canvas || (!maskCursor && !path.drawAnnotations)) {
        await writer.write(frame);
        frame.close();
        continue;
      }

      if (!maskCursor) {
        // Só anotações: mantém a placa no mesmo ritmo do repasse (RF-706).
        await refreshPlateOutsideMask();
      }

      try {
        const t0 = performance.now();
        ctx.drawImage(frame, 0, 0, width, height);
        if (maskCursor && maskRect) {
          maskCursorRegion(frame, maskRect, preserveRect, t0);
        }
        if (path.drawAnnotations) {
          renderAnnotationsAndSpotlight(ctx, canvas, ann, state.rect);
        }

        const cleanFrame = new VideoFrame(canvas, {
          timestamp: frame.timestamp,
          duration: frame.duration ?? undefined,
        });
        frame.close();
        try {
          await writer.write(cleanFrame);
        } finally {
          cleanFrame.close();
        }
        // Quadros com máscara: mede composição + entrega ao gerador, onde a leitura da GPU acontece (RF-703).
        if (maskCursor) {
          postBudgetEvent(budgetGuard.record(performance.now() - t0));
        }
      } catch {
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
