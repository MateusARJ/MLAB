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

function build(targetOS, binaryName, arch = 'amd64') {
  console.log(`[build-backend] Compilando backend Go para ${targetOS} (${arch})...`);
  const env = {
    ...process.env,
    CGO_ENABLED: '0',
    GOOS: targetOS,
    GOARCH: arch
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
    console.error(`[build-backend] ✖ Erro ao compilar para ${targetOS} (${arch}):`, err.message || err);
    process.exit(1);
  }
}

function buildMac(binaryName) {
  const arm64Path = path.join(binDir, `${binaryName}-darwin-arm64`);
  const amd64Path = path.join(binDir, `${binaryName}-darwin-amd64`);
  const outPath = path.join(binDir, binaryName);

  console.log(`[build-backend] Compilando backend Go para macOS (arm64 e amd64)...`);
  try {
    execSync(`go build -o "${arm64Path}" ./cmd/server`, {
      cwd: backendDir,
      env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'arm64' },
      stdio: 'inherit'
    });
    execSync(`go build -o "${amd64Path}" ./cmd/server`, {
      cwd: backendDir,
      env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'amd64' },
      stdio: 'inherit'
    });

    let lipoAvailable = false;
    try {
      execSync('lipo -version', { stdio: 'ignore' });
      lipoAvailable = true;
    } catch {}

    if (lipoAvailable) {
      console.log(`[build-backend] Criando Universal Binary para macOS via lipo...`);
      execSync(`lipo -create -output "${outPath}" "${arm64Path}" "${amd64Path}"`, { stdio: 'inherit' });
      try { fs.unlinkSync(arm64Path); fs.unlinkSync(amd64Path); } catch {}
    } else {
      // Se lipo não estiver disponível (ex: Windows/Linux host), usa o binário arm64 como padrão
      fs.copyFileSync(arm64Path, outPath);
      try { fs.unlinkSync(arm64Path); fs.unlinkSync(amd64Path); } catch {}
    }
    console.log(`[build-backend] ✔ Sucesso: ${path.relative(rootDir, outPath)} (macOS)`);
  } catch (err) {
    console.error(`[build-backend] ✖ Erro ao compilar para macOS:`, err.message || err);
    process.exit(1);
  }
}

const buildWin = target === 'win' || target === 'windows' || target === 'all';
const buildLinux = target === 'linux' || target === 'all';
const buildMacTarget = target === 'mac' || target === 'darwin' || target === 'all';

if (!buildWin && !buildLinux && !buildMacTarget) {
  console.error(`[build-backend] Alvo desconhecido: "${target}". Use "win", "linux", "mac" ou "all".`);
  process.exit(1);
}

if (buildWin) {
  build('windows', 'server.exe', 'amd64');
}

if (buildLinux) {
  build('linux', 'server', 'amd64');
}

if (buildMacTarget) {
  buildMac('server');
}
