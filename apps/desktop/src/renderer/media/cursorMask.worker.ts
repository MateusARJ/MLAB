import type { AnnotationOverlayState, AnnotationStroke, CursorState } from '@mlab/types';

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

self.onmessage = (evt: MessageEvent<WorkerInboundMessage>) => {
  const data = evt.data;
  if (!data) return;

  if (data.type === 'cursor') {
    currentState = data.state;
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
  let out: { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } | null = null;

  const ensureOutCanvas = (
    w: number,
    h: number
  ): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } | null => {
    if (w <= 0 || h <= 0 || typeof OffscreenCanvas === 'undefined') return null;
    if (out && width === w && height === h) return out;

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      out = null;
      return null;
    }

    width = w;
    height = h;
    out = { canvas, ctx };
    return out;
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
      const hasAnyAnnotation =
        ann.strokes.length > 0 || ann.activeStroke !== null || ann.spotlight.enabled === true;

      // No modo 'screen' com a janela de overlay externa ativa (sem setContentProtection),
      // o próprio capturador de tela do SO (WGC) já captura os traços e a Lupa a 60fps via GPU,
      // exceto quando o professor ativa ampliação óptica (zoom > 1) na Lupa.
      const capturedNativelyByScreen =
        ann.captureMode === 'screen' &&
        ann.externalOverlayActive === true &&
        !(ann.spotlight.enabled && (ann.spotlight.zoom || 1) > 1);

      const hasOverlayInWorker = hasAnyAnnotation && !capturedNativelyByScreen;

      // Caminho rápido 100% Zero-Copy: nenhuma operação de OffscreenCanvas quando sem overlay no worker
      if (!hasOverlayInWorker) {
        await writer.write(frame);
        frame.close();
        continue;
      }

      const fw = frame.codedWidth || frame.displayWidth;
      const fh = frame.codedHeight || frame.displayHeight;

      const target = ensureOutCanvas(fw, fh);
      if (!target) {
        await writer.write(frame);
        frame.close();
        continue;
      }

      try {
        target.ctx.drawImage(frame, 0, 0, width, height);
        renderAnnotationsAndSpotlight(target.ctx, target.canvas, ann, state.rect);

        const cleanFrame = new VideoFrame(target.canvas, {
          timestamp: frame.timestamp,
          duration: frame.duration ?? undefined,
        });
        frame.close();
        await writer.write(cleanFrame);
        cleanFrame.close();
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
