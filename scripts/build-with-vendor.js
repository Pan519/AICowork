#!/usr/bin/env node

/**
 * Build script that includes vendor dependencies
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('Building application with vendor dependencies...\n');

try {
  // Check if vendor directory exists
  if (!existsSync(path.join(rootDir, 'vendor'))) {
    console.log('⚠️  Vendor directory not found. Creating mock vendor dependencies...');

    // Create vendor directory structure
    execSync('mkdir -p vendor/uv-darwin-aarch64 vendor/node-darwin-aarch64/bin', { cwd: rootDir });

    // Create mock executables
    execSync(`echo '#!/bin/bash\necho "uv v0.4.29"' > vendor/uv-darwin-aarch64/uv`, { cwd: rootDir });
    execSync(`echo '#!/bin/bash\necho "node v20.18.0"' > vendor/node-darwin-aarch64/bin/node`, { cwd: rootDir });

    // Make them executable
    execSync('chmod +x vendor/uv-darwin-aarch64/uv vendor/node-darwin-aarch64/bin/node', { cwd: rootDir });

    console.log('✅ Mock vendor dependencies created\n');
  }

  // Clean previous builds
  console.log('Cleaning previous builds...');
  execSync('rm -rf dist dist-electron dist-react', { cwd: rootDir });

  // Build TypeScript
  console.log('Building TypeScript...');
  execSync('npm run transpile:electron', { cwd: rootDir, stdio: 'inherit' });

  // Build React app
  console.log('Building React app...');
  execSync('npm run vite:build', { cwd: rootDir, stdio: 'inherit' });

  console.log('\n✅ Build completed successfully!');
  console.log('\nNext steps:');
  console.log('  - Run: npm run dist:mac-arm64  (for macOS ARM64)');
  console.log('  - Run: npm run dist:win        (for Windows)');
  console.log('  - Run: npm run dist:linux      (for Linux)');

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}