/**
 * Fixtures do E2E (004/T405): professor simulado.
 * - sessão e sala pela API real (com a chave de host do E2E);
 * - publisher WebRTC numa página separada (canvas.captureStream), sinalizando pelo WebSocket do professor
 *   exatamente como o app desktop: publish-request → offer → answer.
 * Nada aqui toca apps/web/src.
 */
import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { API_URL, E2E_HOST_KEY, WS_URL } from './constants';

export type WsMsg = { type: string; payload?: any };

export type Professor = {
  token: string;
  roomId: string;
  slug: string;
  /** Página do publisher (origem localhost:8080). */
  page: Page;
  /** Envia uma mensagem pelo WebSocket do professor. */
  send: (type: string, payload?: unknown) => Promise<void>;
  /** Espera uma mensagem recebida pelo professor que satisfaça o filtro. */
  waitFor: (type: string, match?: (payload: any) => boolean, timeoutMs?: number) => Promise<WsMsg>;
  upload: (name: string, content: string) => Promise<{ id: string; name: string; url: string }>;
  closeRoom: () => Promise<number>;
};

async function createProfessor(request: APIRequestContext, context: BrowserContext, name: string): Promise<Professor> {
  const session = await request.post(`${API_URL}/auth/session`, {
    headers: { 'X-MLab-Host-Key': E2E_HOST_KEY },
    data: { name },
  });
  expect(session.status(), 'POST /auth/session').toBe(200);
  const { token } = await session.json();

  const created = await request.post(`${API_URL}/rooms`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Aula ${name}`, max_participants: 50 },
  });
  expect(created.status(), 'POST /rooms').toBe(201);
  const { room_id: roomId, slug } = await created.json();

  const page = await context.newPage();
  await page.goto(`${API_URL}/health`); // origem localhost (contexto seguro) para WebRTC e WebSocket

  await page.evaluate(
    async ({ wsUrl }) => {
      const w = window as any;
      w.__msgs = [] as any[];
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d')!;
      let n = 0;
      w.__draw = setInterval(() => {
        n++;
        ctx.fillStyle = `hsl(${(n * 7) % 360}, 80%, 50%)`;
        ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = '#fff';
        ctx.font = '48px sans-serif';
        ctx.fillText(`MLab E2E ${n}`, 24, 80);
      }, 33);
      const stream = (canvas as any).captureStream(30) as MediaStream;

      const ws = new WebSocket(wsUrl);
      w.__ws = ws;
      ws.addEventListener('message', (e) => w.__msgs.push(JSON.parse(e.data)));
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
      });
      const waitMsg = (type: string) =>
        new Promise<any>((resolve) => {
          const h = (e: MessageEvent) => {
            const m = JSON.parse(e.data);
            if (m.type === type) {
              ws.removeEventListener('message', h);
              resolve(m);
            }
          };
          ws.addEventListener('message', h);
        });

      const pc = new RTCPeerConnection();
      w.__pc = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const approved = waitMsg('publish-approved');
      ws.send(JSON.stringify({ type: 'publish-request' }));
      await approved;
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && resolve());
      });
      const answer = waitMsg('answer');
      ws.send(JSON.stringify({ type: 'offer', payload: { sdp: pc.localDescription!.sdp } }));
      const ans = await answer;
      await pc.setRemoteDescription({ type: 'answer', sdp: ans.payload.sdp });
    },
    { wsUrl: `${WS_URL}/ws/rooms/${roomId}/signal?token=${token}` },
  );

  const send = async (type: string, payload?: unknown) => {
    await page.evaluate(({ type, payload }) => (window as any).__ws.send(JSON.stringify({ type, payload })), { type, payload });
  };

  const waitFor = async (type: string, match: (p: any) => boolean = () => true, timeoutMs = 15_000): Promise<WsMsg> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const msgs: WsMsg[] = await page.evaluate(() => (window as any).__msgs);
      const found = msgs.find((m) => m.type === type && match(m.payload));
      if (found) return found;
      await page.waitForTimeout(150);
    }
    throw new Error(`professor não recebeu "${type}" em ${timeoutMs} ms`);
  };

  const upload = async (fileName: string, content: string) => {
    const res = await request.post(`${API_URL}/rooms/${roomId}/files`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { file: { name: fileName, mimeType: 'text/plain', buffer: Buffer.from(content) } },
    });
    expect(res.status(), 'upload do professor').toBe(201);
    return res.json();
  };

  const closeRoom = async () => {
    const res = await request.post(`${API_URL}/rooms/${roomId}/close`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    return res.status();
  };

  return { token, roomId, slug, page, send, waitFor, upload, closeRoom };
}

/** Entra na sala pela interface do aluno e espera a página ao vivo. */
export async function joinAsStudent(page: Page, slug: string, name: string, studentId: string) {
  await page.goto(`/${slug}/entrar`);
  await page.getByLabel('Nome Completo').fill(name);
  await page.getByLabel('Matrícula').fill(studentId);
  await page.getByRole('button', { name: /Entrar na aula/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/ao-vivo$`));
}

/** Espera o vídeo do aluno ter dimensão e avançar no tempo. */
export async function expectVideoPlaying(page: Page) {
  const video = page.locator('video').first();
  await expect(video).toBeAttached();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 }).toBeGreaterThan(0);
  const t1 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(t1);
}

export const test = base.extend<{ prof: Professor }>({
  prof: async ({ browser, request }, use, testInfo) => {
    const context = await browser.newContext();
    const prof = await createProfessor(request, context, `Prof ${testInfo.title.slice(0, 20)}`);
    await use(prof);
    await prof.closeRoom().catch(() => undefined); // não deixa sala ativa para o próximo teste
    await context.close();
  },
});

export { expect };
