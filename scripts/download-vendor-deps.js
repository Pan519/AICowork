#!/usr/bin/env node

/**
 * 下载和准备 vendor 依赖
 * 用于打包时包含 bun、uv、node 等运行时
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VENDOR_DIR = path.join(__dirname, '..', 'vendor');

// 依赖下载配置
const DEPENDENCIES = {
  bun: {
    darwin: {
      url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.1.38/bun-darwin-aarch64.zip',
      file: 'bun-darwin-aarch64.zip',
      extract: 'unzip',
      executable: 'bun'
    },
    linux: {
      url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.1.38/bun-linux-x64.zip',
      file: 'bun-linux-x64.zip',
      extract: 'unzip',
      executable: 'bun'
    },
    win32: {
      url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.1.38/bun-windows-x64.zip',
      file: 'bun-windows-x64.zip',
      extract: 'unzip',
      executable: 'bun.exe'
    }
  },
  uv: {
    darwin: {
      url: 'https://github.com/astral-sh/uv/releases/download/0.4.29/uv-aarch64-apple-darwin.tar.gz',
      file: 'uv-aarch64-apple-darwin.tar.gz',
      extract: 'tar -xzf',
      executable: 'uv'
    },
    linux: {
      url: 'https://github.com/astral-sh/uv/releases/download/0.4.29/uv-x86_64-unknown-linux-gnu.tar.gz',
      file: 'uv-x86_64-unknown-linux-gnu.tar.gz',
      extract: 'tar -xzf',
      executable: 'uv'
    },
    win32: {
      url: 'https://github.com/astral-sh/uv/releases/download/0.4.29/uv-x86_64-pc-windows-msvc.zip',
      file: 'uv-x86_64-pc-windows-msvc.zip',
      extract: 'unzip',
      executable: 'uv.exe'
    }
  },
  node: {
    darwin: {
      url: 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-arm64.tar.gz',
      file: 'node-v20.18.0-darwin-arm64.tar.gz',
      extract: 'tar -xzf',
      executable: 'bin/node',
      strip: 1
    },
    linux: {
      url: 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.xz',
      file: 'node-v20.18.0-linux-x64.tar.xz',
      extract: 'tar -xJf',
      executable: 'bin/node',
      strip: 1
    },
    win32: {
      url: 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip',
      file: 'node-v20.18.0-win-x64.zip',
      extract: 'unzip',
      executable: 'node.exe'
    }
  }
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded to ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

function extractArchive(archivePath, extractDir, extractCmd) {
  console.log(`Extracting ${archivePath}...`);
  ensureDir(extractDir);

  const cmd = `${extractCmd} "${archivePath}"`;
  console.log(`Running: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: extractDir,
      stdio: 'inherit'
    });
    console.log(`Extracted to ${extractDir}`);
  } catch (error) {
    console.error(`Failed to extract ${archivePath}:`, error);
    throw error;
  }
}

async function downloadDependency(name, platform) {
  const config = DEPENDENCIES[name][platform];
  if (!config) {
    console.log(`No ${name} binary available for ${platform}`);
    return;
  }

  const platformDir = path.join(VENDOR_DIR, `${name}-${platform}`);

  // 检查是否已存在可执行文件
  let execPath = path.join(platformDir, config.executable);

  // 检查是否在子目录中（如果直接路径不存在）
  if (!fs.existsSync(execPath)) {
    const dirs = fs.readdirSync(platformDir).filter(f => {
      const fullPath = path.join(platformDir, f);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() && !f.startsWith('__MACOSX');
    });

    if (dirs.length > 0) {
      execPath = path.join(platformDir, dirs[0], config.executable);
    }
  }

  // 如果可执行文件已存在，跳过下载
  if (fs.existsSync(execPath)) {
    console.log(`${name} for ${platform} already exists at ${execPath}, skipping download`);

    // 确保可执行权限（非 Windows）
    if (platform !== 'win32') {
      try {
        fs.chmodSync(execPath, 0o755);
      } catch (error) {
        console.warn(`Warning: Could not set executable permissions for ${execPath}`);
      }
    }

    // 如果需要 strip 目录层级
    if (config.strip) {
      const targetPath = path.join(platformDir, path.basename(config.executable));
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(execPath, targetPath);
        fs.chmodSync(targetPath, 0o755);
        console.log(`Stripped to: ${targetPath}`);
      }
    }

    return;
  }

  // 如果可执行文件不存在，继续下载
  ensureDir(platformDir);

  const archivePath = path.join(platformDir, config.file);

  // 下载
  await downloadFile(config.url, archivePath);

  // 解压
  extractArchive(archivePath, platformDir, config.extract);

  // 删除压缩包
  fs.unlinkSync(archivePath);

  // 重新检查可执行文件路径
  execPath = path.join(platformDir, config.executable);

  // 检查是否在子目录中
  if (!fs.existsSync(execPath)) {
    // 查找解压后的目录
    const dirs = fs.readdirSync(platformDir).filter(f => {
      return fs.statSync(path.join(platformDir, f)).isDirectory() && !f.startsWith('__MACOSX');
    });

    if (dirs.length > 0) {
      // 在第一个目录中查找可执行文件
      execPath = path.join(platformDir, dirs[0], config.executable);
    }
  }

  if (fs.existsSync(execPath)) {
    // 设置可执行权限（非 Windows）
    if (platform !== 'win32') {
      fs.chmodSync(execPath, 0o755);
    }
    console.log(`${name} installed at: ${execPath}`);

    // 如果需要 strip 目录层级
    if (config.strip) {
      // 将文件移动到 platformDir
      const targetPath = path.join(platformDir, path.basename(config.executable));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(execPath, targetPath);
      fs.chmodSync(targetPath, 0o755);
      console.log(`Stripped to: ${targetPath}`);
    }
  } else {
    console.warn(`Warning: Executable not found at ${execPath}`);
    // 列出目录内容帮助调试
    console.log('Directory contents:');
    execSync(`ls -la "${platformDir}"`, { stdio: 'inherit' });
  }
}

async function main() {
  console.log('Downloading vendor dependencies...');

  const platform = process.platform;
  const supportedPlatforms = ['darwin', 'linux', 'win32'];

  if (!supportedPlatforms.includes(platform)) {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
  }

  ensureDir(VENDOR_DIR);

  try {
    // 为当前平台下载所有依赖
    for (const depName of Object.keys(DEPENDENCIES)) {
      console.log(`\nDownloading ${depName} for ${platform}...`);
      await downloadDependency(depName, platform);
    }

    console.log('\nAll dependencies downloaded successfully!');
    console.log(`Vendor directory: ${VENDOR_DIR}`);

    // 列出下载的内容
    console.log('\nDownloaded files:');
    execSync(`ls -la "${VENDOR_DIR}"`, { stdio: 'inherit' });

  } catch (error) {
    console.error('Failed to download dependencies:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { downloadDependency, DEPENDENCIES };