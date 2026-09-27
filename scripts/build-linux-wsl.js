const { spawnSync } = require('child_process');

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

const bashCmd = `export PATH="$HOME/.local/node/bin:$PATH"; cd /mnt/c/Users/User/Documents/mlab/apps/desktop && npx electron-builder --linux ${targets}`;

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
