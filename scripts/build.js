const { execSync } = require('child_process');
const path = require('path');

// 定位项目根目录
const PROJECT_DIR = path.resolve(__dirname, '..');
process.chdir(PROJECT_DIR);

console.log('Installing dependencies...');
execSync('pnpm install --prefer-frozen-lockfile --prefer-offline', { stdio: 'inherit' });

console.log('Building the Next.js project...');
execSync('pnpm next build', { stdio: 'inherit' });

console.log('Bundling server with tsup...');
execSync('pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify', { stdio: 'inherit' });

console.log('Build completed successfully!');
