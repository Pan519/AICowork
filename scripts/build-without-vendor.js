#!/usr/bin/env node

/**
 * 构建项目，跳过vendor依赖下载
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔨 开始构建项目（跳过vendor下载）...');

try {
  // 1. TypeScript编译
  console.log('📘 编译TypeScript...');
  execSync('npx tsc --project src/electron/tsconfig.json', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // 2. Vite构建
  console.log('⚡ Vite构建...');
  execSync('npx tsc -b && npx vite build', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('✅ 构建完成！');
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}