const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
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
const repoRoot = path.resolve(__dirname, '..');

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

const KOFFI_LINUX_PACKAGE = '@koromix/koffi-linux-x64';

function fail(message) {
  throw new Error(`[build-linux-wsl] ${message}`);
}

/**
 * 048 (#138): o npm do Windows só instala o binário do koffi da plataforma do host, e o electron-builder no WSL
 * empacota esses mesmos node_modules. Garante `@koromix/koffi-linux-x64` na versão do koffi instalado, conferida pelo
 * `integrity` do package-lock.json, e devolve a função que o remove ao fim (só se foi este script que o criou).
 */
function ensureLinuxKoffi() {
  // O `exports` do koffi não expõe `package.json`: resolve o pacote e sobe até a raiz dele.
  let koffiDir;
  try {
    koffiDir = path.dirname(require.resolve('koffi', { paths: [desktopDir] }));
    while (path.basename(koffiDir) !== 'koffi' || !fs.existsSync(path.join(koffiDir, 'package.json'))) {
      const parent = path.dirname(koffiDir);
      if (parent === koffiDir) throw new Error('raiz do koffi não encontrada');
      koffiDir = parent;
    }
  } catch {
    fail('koffi não encontrado nos node_modules; rode npm ci antes do build.');
  }
  const koffiPkgPath = path.join(koffiDir, 'package.json');
  const nodeModulesDir = path.dirname(koffiDir);
  const targetDir = path.join(nodeModulesDir, ...KOFFI_LINUX_PACKAGE.split('/'));
  if (fs.existsSync(path.join(targetDir, 'package.json'))) {
    console.log(`[build-linux-wsl] ${KOFFI_LINUX_PACKAGE} já presente; nada a baixar.`);
    return () => {};
  }

  const koffiPkg = JSON.parse(fs.readFileSync(koffiPkgPath, 'utf8'));
  const version = koffiPkg.optionalDependencies && koffiPkg.optionalDependencies[KOFFI_LINUX_PACKAGE];
  if (!version) fail(`koffi ${koffiPkg.version} não declara ${KOFFI_LINUX_PACKAGE} nas dependências opcionais.`);

  const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  const lockEntry = lock.packages && lock.packages[`node_modules/${KOFFI_LINUX_PACKAGE}`];
  if (!lockEntry || !lockEntry.integrity) fail(`${KOFFI_LINUX_PACKAGE} sem entrada com integrity no package-lock.json.`);
  if (lockEntry.version !== version) {
    fail(`versão divergente de ${KOFFI_LINUX_PACKAGE}: koffi pede ${version}, package-lock.json tem ${lockEntry.version}.`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mlab-koffi-linux-'));
  try {
    console.log(`[build-linux-wsl] Baixando ${KOFFI_LINUX_PACKAGE}@${version} para o pacote Linux...`);
    const pack = spawnSync('npm', ['pack', `${KOFFI_LINUX_PACKAGE}@${version}`, '--pack-destination', tmpDir, '--silent'], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (pack.error || pack.status !== 0) {
      fail(`npm pack falhou: ${(pack.error && pack.error.message) || pack.stderr || `código ${pack.status}`}`);
    }
    const tgz = fs.readdirSync(tmpDir).find((f) => f.endsWith('.tgz'));
    if (!tgz) fail('npm pack não gerou o arquivo .tgz.');
    const tgzPath = path.join(tmpDir, tgz);

    const [algorithm, expected] = lockEntry.integrity.split('-');
    const actual = crypto.createHash(algorithm).update(fs.readFileSync(tgzPath)).digest('base64');
    if (actual !== expected) {
      fail(`integridade de ${KOFFI_LINUX_PACKAGE} não confere com o package-lock.json (${algorithm}).`);
    }

    // Caminhos relativos ao diretório temporário: o GNU tar (Git Bash) leria "C:\..." como host remoto.
    fs.mkdirSync(path.join(tmpDir, 'extract'));
    const untar = spawnSync('tar', ['-xzf', tgz, '-C', 'extract'], { cwd: tmpDir, encoding: 'utf8' });
    if (untar.error || untar.status !== 0) {
      fail(`tar falhou ao extrair ${tgz}: ${(untar.error && untar.error.message) || untar.stderr}`);
    }
    try {
      fs.cpSync(path.join(tmpDir, 'extract', 'package'), targetDir, { recursive: true });
    } catch (err) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      fail(`não foi possível copiar ${KOFFI_LINUX_PACKAGE} para node_modules: ${err.message}`);
    }
    console.log(`[build-linux-wsl] ✔ ${KOFFI_LINUX_PACKAGE}@${version} conferido e colocado em node_modules.`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return () => {
    fs.rmSync(targetDir, { recursive: true, force: true });
    const scopeDir = path.dirname(targetDir);
    try {
      if (fs.readdirSync(scopeDir).length === 0) fs.rmdirSync(scopeDir);
    } catch {}
    console.log(`[build-linux-wsl] ${KOFFI_LINUX_PACKAGE} removido de node_modules.`);
  };
}

// Se estiver no Windows host, utiliza o WSL com caminho dinâmico
const desktopNormalized = desktopDir.replace(/\\/g, '/');
const wslDesktopPath = desktopNormalized.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
const bashCmd = `export PATH="$HOME/.local/node/bin:$PATH"; cd "${wslDesktopPath}" && npx electron-builder --linux ${targets} --publish never`;

let removeLinuxKoffi;
try {
  removeLinuxKoffi = ensureLinuxKoffi();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(`[build-linux-wsl] Empacotando alvos para Linux (${targets}) via WSL...`);
let result;
try {
  result = spawnSync('wsl', ['-e', 'bash', '-c', bashCmd], {
    stdio: 'inherit'
  });
} finally {
  // RF-4803: remove o binário que este script colocou, com o build bem-sucedido ou não.
  removeLinuxKoffi();
}

if (result.error) {
  console.error('[build-linux-wsl] Erro ao executar WSL:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[build-linux-wsl] Processo finalizado com erro (código: ${result.status})`);
  process.exit(result.status || 1);
}

console.log(`[build-linux-wsl] ✔ Build Linux (${targets}) concluído com sucesso!`);
