const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'apps/backend');
const binDir = path.join(backendDir, 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const target = (process.argv[2] || 'all').toLowerCase();

function build(targetOS, binaryName) {
  console.log(`[build-backend] Compilando backend Go para ${targetOS} (amd64)...`);
  const env = {
    ...process.env,
    CGO_ENABLED: '0',
    GOOS: targetOS,
    GOARCH: 'amd64'
  };

  const outPath = path.join(binDir, binaryName);
  const relativeOut = path.relative(rootDir, outPath);

  try {
    execSync(`go build -o "${outPath}" ./cmd/server`, {
      cwd: backendDir,
      env,
      stdio: 'inherit'
    });
    console.log(`[build-backend] ✔ Sucesso: ${relativeOut}`);
  } catch (err) {
    console.error(`[build-backend] ✖ Erro ao compilar para ${targetOS}:`, err.message || err);
    process.exit(1);
  }
}

const buildWin = target === 'win' || target === 'windows' || target === 'all';
const buildLinux = target === 'linux' || target === 'all';

if (!buildWin && !buildLinux) {
  console.error(`[build-backend] Alvo desconhecido: "${target}". Use "win", "linux" ou "all".`);
  process.exit(1);
}

if (buildWin) {
  build('windows', 'server.exe');
}

if (buildLinux) {
  build('linux', 'server');
}
