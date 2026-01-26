#!/usr/bin/env node

/**
 * 修复vendor目录中的可执行文件
 * 将真正的可执行文件复制到正确的位置
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VENDOR_DIR = path.join(__dirname, '..', 'vendor');

// 修复映射：从真实文件到目标位置
const FIXES = [
  {
    name: 'bun',
    from: path.join(VENDOR_DIR, 'bun-darwin', 'bun-darwin-aarch64', 'bun'),
    to: path.join(VENDOR_DIR, 'bun-darwin-aarch64', 'bun')
  },
  {
    name: 'uv',
    from: path.join(VENDOR_DIR, 'uv-darwin', 'uv-aarch64-apple-darwin', 'uv'),
    to: path.join(VENDOR_DIR, 'uv-darwin-aarch64', 'uv')
  },
  {
    name: 'node',
    from: path.join(VENDOR_DIR, 'node-darwin', 'bin', 'node'),
    to: path.join(VENDOR_DIR, 'node-darwin-aarch64', 'bin', 'node')
  }
];

async function fixExecutables() {
  console.log('🔧 修复vendor可执行文件...\n');

  for (const fix of FIXES) {
    console.log(`检查 ${fix.name}...`);

    // 检查源文件是否存在
    if (!fs.existsSync(fix.from)) {
      console.log(`  ❌ 源文件不存在: ${fix.from}`);
      continue;
    }

    // 检查源文件是否为真正的可执行文件
    const sourceStats = fs.statSync(fix.from);
    if (sourceStats.size < 10000) { // 真实的可执行文件应该大于10KB
      console.log(`  ⚠️  源文件太小，可能是占位符: ${sourceStats.size} bytes`);
      continue;
    }

    // 确保目标目录存在
    const targetDir = path.dirname(fix.to);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`  📁 创建目录: ${targetDir}`);
    }

    // 备份现有的占位符文件（如果存在）
    if (fs.existsSync(fix.to)) {
      const currentContent = fs.readFileSync(fix.to, 'utf8');
      if (currentContent.includes('#!/bin/bash') && currentContent.includes('echo')) {
        const backupPath = fix.to + '.backup';
        fs.renameSync(fix.to, backupPath);
        console.log(`  💾 备份占位符文件: ${backupPath}`);
      }
    }

    // 复制真实的可执行文件
    fs.copyFileSync(fix.from, fix.to);

    // 设置可执行权限
    fs.chmodSync(fix.to, 0o755);

    // 验证复制结果
    const newStats = fs.statSync(fix.to);
    console.log(`  ✅ 已修复: ${fix.name}`);
    console.log(`     大小: ${(newStats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`     路径: ${fix.to}`);

    // 验证文件类型
    try {
      const { execSync } = await import('child_process');
      const fileType = execSync(`file "${fix.to}"`, { encoding: 'utf8' }).trim();
      console.log(`     类型: ${fileType.split(': ')[1]}`);
    } catch (e) {
      console.log(`     类型: 无法检测`);
    }

    console.log('');
  }

  console.log('✅ vendor可执行文件修复完成！');
}

// 运行修复
fixExecutables().catch(console.error);