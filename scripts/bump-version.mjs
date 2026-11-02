// Versionamento oficial do MLab: docs/versionamento.md
//
//   npm run bump                    -> próxima versão pela regra decimal (1.5.7 -> 1.5.8; 1.5.9 -> 1.6.0)
//   npm run bump -- --set 1.6.0     -> define uma versão explícita
//   npm run version:check           -> confere se todos os pacotes e o package-lock estão na mesma versão
//
// A versão é única para todo o monorepo. Nenhum build (npm run make*) altera a versão.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');

const WORKSPACES = ['apps/desktop', 'apps/web', 'apps/backend', 'packages/ui', 'packages/types'];
const PACKAGE_FILES = ['package.json', ...WORKSPACES.map((w) => `${w}/package.json`)];
const LOCK_FILE = 'package-lock.json';
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf-8'));

/** Troca só o valor do primeiro campo "version" de topo, preservando a formatação e as quebras de linha. */
function writePackageVersion(rel, version) {
  const full = path.join(rootDir, rel);
  const text = fs.readFileSync(full, 'utf-8');
  const next = text.replace(/^(\s*"version"\s*:\s*")[^"]*(")/m, `$1${version}$2`);
  if (next === text && readJson(rel).version !== version) {
    throw new Error(`campo "version" não encontrado em ${rel}`);
  }
  fs.writeFileSync(full, next, 'utf-8');
}

/** Atualiza a versão da raiz e dos workspaces no package-lock.json. */
function writeLockVersion(version) {
  const full = path.join(rootDir, LOCK_FILE);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, 'utf-8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lock = JSON.parse(text);
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
  for (const ws of WORKSPACES) {
    if (lock.packages?.[ws]) lock.packages[ws].version = version;
  }
  fs.writeFileSync(full, JSON.stringify(lock, null, 2).replace(/\n/g, eol) + eol, 'utf-8');
}

function collectVersions() {
  const found = PACKAGE_FILES.filter((rel) => fs.existsSync(path.join(rootDir, rel))).map((rel) => [
    rel,
    readJson(rel).version,
  ]);
  if (fs.existsSync(path.join(rootDir, LOCK_FILE))) {
    const lock = readJson(LOCK_FILE);
    found.push([`${LOCK_FILE} (raiz)`, lock.packages?.['']?.version ?? lock.version]);
    for (const ws of WORKSPACES) {
      if (lock.packages?.[ws]) found.push([`${LOCK_FILE} (${ws})`, lock.packages[ws].version]);
    }
  }
  return found;
}

/** Regra decimal: cada componente vai de 0 a 9; ao passar de 9 volta a 0 e incrementa o da esquerda. */
function nextDecimalVersion(current) {
  const m = VERSION_RE.exec(current);
  if (!m) throw new Error(`versão inválida no package.json raiz: ${current}`);
  let [major, minor, patch] = m.slice(1).map(Number);
  if (patch < 9) {
    patch += 1;
  } else {
    patch = 0;
    if (minor < 9) {
      minor += 1;
    } else {
      minor = 0;
      major += 1;
    }
  }
  return `${major}.${minor}.${patch}`;
}

function compareVersions(a, b) {
  const pa = VERSION_RE.exec(a).slice(1).map(Number);
  const pb = VERSION_RE.exec(b).slice(1).map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function check() {
  const versions = collectVersions();
  const expected = readJson('package.json').version;
  let ok = true;
  for (const [rel, v] of versions) {
    const mark = v === expected ? '✓' : '✗';
    if (v !== expected) ok = false;
    console.log(`  ${mark} ${rel}: ${v}`);
  }
  if (!ok) {
    console.error(`\nVersões divergentes; esperado ${expected} em todos. Corrija com: npm run bump -- --set ${expected}`);
    process.exit(1);
  }
  console.log(`\nVersão única do monorepo: ${expected}`);
}

function apply(version) {
  const current = readJson('package.json').version;
  for (const rel of PACKAGE_FILES) {
    if (fs.existsSync(path.join(rootDir, rel))) writePackageVersion(rel, version);
  }
  writeLockVersion(version);
  console.log(`MLab: ${current} -> ${version}`);
  check();
  console.log(`\nPróximo passo: commit "chore(release): versao ${version}" em PR para a development (docs/versionamento.md).`);
}

const args = process.argv.slice(2);
try {
  if (args.includes('--check')) {
    check();
  } else if (args.includes('--set')) {
    const version = args[args.indexOf('--set') + 1];
    if (!version || !VERSION_RE.test(version)) {
      throw new Error('uso: npm run bump -- --set <MAIOR.MENOR.CORRECAO>, ex.: 1.6.0');
    }
    const current = readJson('package.json').version;
    if (VERSION_RE.test(current) && compareVersions(version, current) < 0) {
      throw new Error(`versões não voltam: ${version} é menor que a atual ${current} (docs/versionamento.md)`);
    }
    apply(version);
  } else {
    apply(nextDecimalVersion(readJson('package.json').version));
  }
} catch (err) {
  console.error(`[bump-version] ${err.message}`);
  process.exit(1);
}
