import { defineConfig, devices } from '@playwright/test';
import { E2E_HOST_KEY } from './e2e/constants';

/**
 * E2E do web do aluno (004/T404). Sobe o backend real (go run) e o Vite; o professor é simulado
 * pelas fixtures em e2e/fixtures.ts. Arquivos *.e2e.ts para não colidir com o Vitest (*.test/*.spec).
 *
 *   npm run test:e2e -w @mlab/web
 */
const chromiumArgs = [
  // Expõe IPs reais em vez de candidatos mDNS no loopback (determinismo do ICE em teste).
  '--disable-features=WebRtcHideLocalIpsWithMdns',
];

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1, // um único backend; /rooms/active depende da sala mais recente
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // 051/RF-5101: artefatos em test-results, que o Vite não observa. Em e2e-results, o .html gravado pelo trace fazia o
  // Vite mandar full-reload e a página do aluno recarregava no meio do teste (#153).
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium', // Chromium completo em headless novo (dispensa o download do headless shell)
        viewport: { width: 1280, height: 800 },
        // Exige gesto para áudio: exercita o banner "Clique para Ativar Som" (A10).
        launchOptions: { args: [...chromiumArgs, '--autoplay-policy=user-gesture-required'] },
      },
    },
    {
      name: 'mobile',
      grep: /@mobile/,
      use: {
        ...devices['Pixel 7'],
        channel: 'chromium',
        launchOptions: { args: chromiumArgs },
      },
    },
  ],
  webServer: [
    {
      command: 'go run ./cmd/server',
      cwd: '../backend',
      url: 'http://localhost:8080/health',
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        PORT: '8080',
        MLAB_HOST_KEY: E2E_HOST_KEY,
        MLAB_DEV_MONOREPO: '1',
      },
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
