const { spawnSync } = require('child_process');
const path = require('path');

const targetArg = (process.argv[2] || 'all').toLowerCase();

let targets = 'AppImage deb';
if (targetArg === 'appimage') {
  targets = 'AppImage';
} else if (targetArg === 'deb') {
  targets = 'deb';
} else if (targetArg === 'all') {
  targets = 'AppImage deb';
} else {
  targets = process.argv[2];
}

const desktopDir = path.resolve(__dirname, '../apps/desktop');

// Se já estiver rodando em um ambiente Linux (ex: runner ubuntu-latest do GitHub Actions)
if (process.platform === 'linux') {
  console.log(`[build-linux] Ambiente Linux nativo detectado (CI/CD). Empacotando alvos: ${targets}...`);
  const targetList = targets.split(' ').filter(Boolean);
  const result = spawnSync('npx', ['electron-builder', '--linux', ...targetList, '--publish', 'never'], {
    cwd: desktopDir,
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    console.error('[build-linux] Erro ao executar electron-builder no Linux:', result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[build-linux] Build falhou com código: ${result.status}`);
    process.exit(result.status || 1);
  }

  console.log(`[build-linux] ✔ Build Linux (${targets}) concluído com sucesso!`);
  process.exit(0);
}

// Se estiver no Windows host, utiliza o WSL com caminho dinâmico
const desktopNormalized = desktopDir.replace(/\\/g, '/');
const wslDesktopPath = desktopNormalized.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
const bashCmd = `export PATH="$HOME/.local/node/bin:$PATH"; cd "${wslDesktopPath}" && npx electron-builder --linux ${targets} --publish never`;

console.log(`[build-linux-wsl] Empacotando alvos para Linux (${targets}) via WSL...`);
const result = spawnSync('wsl', ['-e', 'bash', '-c', bashCmd], {
  stdio: 'inherit'
});

if (result.error) {
  console.error('[build-linux-wsl] Erro ao executar WSL:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[build-linux-wsl] Processo finalizado com erro (código: ${result.status})`);
  process.exit(result.status || 1);
}

console.log(`[build-linux-wsl] ✔ Build Linux (${targets}) concluído com sucesso!`);
