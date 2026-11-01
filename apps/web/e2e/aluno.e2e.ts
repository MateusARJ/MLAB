/**
 * Specs do E2E do aluno (004/T406). O ID do item da matriz de smoke abre o título de cada teste.
 * Testes marcados com @mobile rodam também no projeto mobile (Pixel 7).
 */
import { test, expect, joinAsStudent, expectVideoPlaying } from './fixtures';

const MATRICULA = '2025116TADS0001';

test('A9 @mobile entrada pela raiz, validação da matrícula e acesso ao vivo', async ({ page, prof }) => {
  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`/${prof.slug}/entrar$`));

  await page.getByLabel('Nome Completo').fill('Aluna Teste');
  await page.getByLabel('Matrícula / Registro Acadêmico').fill('ABC');
  await page.getByRole('button', { name: /Assistir à Aula ao Vivo/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByLabel('Matrícula / Registro Acadêmico').fill(MATRICULA);
  await page.getByRole('button', { name: /Assistir à Aula ao Vivo/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${prof.slug}/ao-vivo$`));
});

test('A10 @mobile vídeo chega ao aluno, autoplay e controles de tela', async ({ page, prof }, testInfo) => {
  await joinAsStudent(page, prof.slug, 'Aluno Video', MATRICULA);
  await expectVideoPlaying(page);

  const video = page.locator('video').first();
  const banner = page.getByRole('button', { name: /Clique para Ativar Som/ });
  if (await banner.isVisible()) {
    await banner.click();
    await expect(banner).toBeHidden();
  }
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);

  if (testInfo.project.name === 'desktop') {
    await expect(page.getByRole('button', { name: 'Tela Cheia' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Picture-in-Picture' }).first()).toBeVisible();
  }
});

test('A13 @mobile aluno lista e baixa o arquivo enviado pelo professor', async ({ page, prof }) => {
  await joinAsStudent(page, prof.slug, 'Aluno Arquivos', MATRICULA);
  const file = await prof.upload('material-aula.txt', 'conteudo do material');

  await page.getByRole('button', { name: /Arquivos da aula/i }).first().click();
  const link = page.locator(`a[download="${file.name}"]`).first();
  await expect(link).toBeVisible();
  expect(await link.getAttribute('href')).toContain('token=');

  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(download.suggestedFilename()).toBe('material-aula.txt');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  expect(Buffer.concat(chunks).toString()).toBe('conteudo do material');
});

test('A14 chat público, privado e mensagem fixada pelo professor', async ({ page, prof }) => {
  await joinAsStudent(page, prof.slug, 'Aluno Chat', MATRICULA);

  await page.getByPlaceholder('Mensagem para toda a turma...').fill('ola turma e2e');
  await page.getByPlaceholder('Mensagem para toda a turma...').press('Enter');
  await expect(page.getByText('ola turma e2e')).toBeVisible();
  await prof.waitFor('chat-message', (p) => p.content?.includes('ola turma e2e'));

  await prof.send('chat-message', { content: 'aviso do professor e2e' });
  await expect(page.getByText('aviso do professor e2e').first()).toBeVisible();
  const echo = await prof.waitFor('chat-message', (p) => p.content?.includes('aviso do professor e2e'));
  await prof.send('pin-message', { message_id: echo.payload.message_id, pinned: true });
  await expect(page.getByTestId('pinned-public-section')).toContainText('aviso do professor e2e');

  await page.getByRole('button', { name: /Privado com Professor/ }).click();
  await page.getByPlaceholder('Dúvida privada ao professor...').fill('duvida privada e2e');
  await page.getByPlaceholder('Dúvida privada ao professor...').press('Enter');
  await prof.waitFor('chat-message', (p) => p.is_private && p.content?.includes('duvida privada e2e'));
});

test('A15 levantar e abaixar a mão', async ({ page, prof }) => {
  await joinAsStudent(page, prof.slug, 'Aluno Mao', MATRICULA);
  // A barra de controles fica sob o <video> para o Playwright (o vídeo intercepta o clique); o clique é
  // disparado direto no botão para testar o fluxo da mão, não o empilhamento visual (confirmado no celular).
  await page.getByRole('button', { name: 'Levantar mão' }).first().dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'Abaixar mão' }).first()).toBeAttached();
  await prof.waitFor('hand-updated', (p) => p.raised === true);

  await page.getByRole('button', { name: 'Abaixar mão' }).first().dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'Levantar mão' }).first()).toBeAttached();
  await prof.waitFor('hand-updated', (p) => p.raised === false);
});

test('A18 aluno reconecta sozinho quando o WebSocket cai', async ({ page, prof }) => {
  const routes: { close: (o?: { code?: number; reason?: string }) => Promise<void> }[] = [];
  await page.routeWebSocket(/\/ws\/rooms\//, (ws) => {
    ws.connectToServer();
    routes.push(ws);
  });
  await joinAsStudent(page, prof.slug, 'Aluno Reconexao', MATRICULA);
  await expect.poll(() => routes.length).toBeGreaterThanOrEqual(1);
  const before = routes.length;

  await routes[routes.length - 1].close({ code: 4000, reason: 'queda simulada' });
  await expect.poll(() => routes.length, { timeout: 20_000 }).toBeGreaterThan(before);
  await expect(page).toHaveURL(/\/ao-vivo$/);
  await expectVideoPlaying(page);
});

test('A3 professor encerra a sala e o aluno volta para a entrada com aviso', async ({ page, prof }, testInfo) => {
  // Registra os frames do WebSocket do aluno como evidência (tipo da mensagem e fechamento).
  const frames: string[] = [];
  page.on('websocket', (ws) => {
    frames.push(`open ${new URL(ws.url()).pathname}`);
    ws.on('framereceived', (f) => {
      try {
        frames.push(`recv ${JSON.parse(String(f.payload)).type}`);
      } catch {
        frames.push('recv (não-JSON)');
      }
    });
    ws.on('close', () => frames.push('close'));
  });
  await joinAsStudent(page, prof.slug, 'Aluno Encerramento', MATRICULA);
  await expectVideoPlaying(page);
  expect(await prof.closeRoom()).toBe(200);
  await page.waitForTimeout(1_000);
  await testInfo.attach('frames-websocket-aluno', { body: frames.join('\n'), contentType: 'text/plain' });
  expect(frames, 'aluno deveria receber room-closed').toContain('recv room-closed');
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('alert')).toContainText(/encerrada/i);
});

test('A20 aluno recebe aviso de limite do chat sem ser desconectado', async ({ page, prof }) => {
  await joinAsStudent(page, prof.slug, 'Aluno Rate', MATRICULA);
  const input = page.getByPlaceholder('Mensagem para toda a turma...');
  for (let i = 1; i <= 6; i++) {
    await input.fill(`rajada ${i}`);
    await input.press('Enter');
  }
  // Plano da 001 (§10b): "O cliente exibe feedback visual ao receber CHAT_RATE_LIMITED".
  await expect(page.getByText(/limite|aguarde|muitas mensagens|devagar/i).first()).toBeVisible({ timeout: 5_000 });
  await expect(page).toHaveURL(/\/ao-vivo$/);
});
