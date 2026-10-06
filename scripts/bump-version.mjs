import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rootPkgPath = path.join(rootDir, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
const currentVersion = rootPkg.version;

const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Formato de versão inválido no package.json raiz: ${currentVersion}`);
  process.exit(1);
}

let [major, minor, patch] = parts;

// Regra Decimal Estrita: Rolagem no 9
// Exemplo: 1.4.8 -> 1.4.9 -> 1.5.0 -> 1.5.1 ... -> 1.5.9 -> 1.6.0
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

const nextVersion = `${major}.${minor}.${patch}`;
console.log(`\n🚀 MLab Version Bump: ${currentVersion} -> ${nextVersion}\n`);

// Lista de todos os package.json a sincronizar no Monorepo
const packagesToSync = [
  'package.json',
  'apps/desktop/package.json',
  'apps/web/package.json',
  'apps/backend/package.json',
  'packages/ui/package.json',
  'packages/types/package.json'
];

for (const relPath of packagesToSync) {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const oldVersion = pkg.version;
    pkg.version = nextVersion;
    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    console.log(`  ✓ Atualizado: ${relPath} (${oldVersion} -> ${nextVersion})`);
  } else {
    console.warn(`  ⚠ Arquivo não encontrado: ${relPath}`);
  }
}

// Atualiza valores padrão e referências de versão no workflow de CI/CD
const workflowPath = path.join(rootDir, '.github/workflows/build-all.yml');
if (fs.existsSync(workflowPath)) {
  let content = fs.readFileSync(workflowPath, 'utf-8');
  content = content.replace(/default:\s*'v\d+\.\d+\.\d+'/g, `default: 'v${nextVersion}'`);
  content = content.replace(/default:\s*'MLab v\d+\.\d+\.\d+'/g, `default: 'MLab v${nextVersion}'`);
  content = content.replace(/tag=v\d+\.\d+\.\d+/g, `tag=v${nextVersion}`);
  content = content.replace(/title=MLab v\d+\.\d+\.\d+/g, `title=MLab v${nextVersion}`);
  content = content.replace(/echo "tag=v\d+\.\d+\.\d+"/g, `echo "tag=v${nextVersion}"`);
  content = content.replace(/echo "title=MLab v\d+\.\d+\.\d+"/g, `echo "title=MLab v${nextVersion}"`);
  fs.writeFileSync(workflowPath, content, 'utf-8');
  console.log(`  ✓ Atualizado: .github/workflows/build-all.yml -> v${nextVersion}`);
}

console.log(`\n🎉 Sincronização concluída com sucesso para a versão v${nextVersion}!\n`);
