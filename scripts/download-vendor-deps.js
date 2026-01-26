#!/usr/bin/env node

/**
 * 下载和准备 vendor 依赖
 * 用于打包时包含 node、uv 等运行时
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VENDOR_DIR = path.join(__dirname, '..', 'vendor');

// 依赖下载配置 - 支持多架构，按需下载
// 使用国内镜像加速下载
const DEPENDENCIES = {
  uv: {
    'darwin-arm64': {
      url: 'https://github.com/astral-sh/uv/releases/download/0.4.29/uv-aarch64-apple-darwin.tar.gz',
      file: 'uv-aarch64-apple-darwin.tar.gz',
      extract: 'tar -xzf',
      executable: 'uv'
    },
    'darwin-x64': {
      url: 'https://github.com/astral-sh/uv/releases/download/0.4.29/uv-x86_64-apple-darwin.tar.gz',
      file: 'uv-x86_64-apple-darwin.tar.gz',
      extract: 'tar -xzf',
      executable: 'uv'
    },
    'linux-x64': {
      url: 'https://github.com/astral-sh/uv/releases/download/0.4.29/uv-x86_64-unknown-linux-gnu.tar.gz',
      file: 'uv-x86_64-unknown-linux-gnu.tar.gz',
      extract: 'tar -xzf',
      executable: 'uv'
    },
    'win32-x64': {
      url: 'https://github.com/astral-sh/uv/releases/download/0.4.29/uv-x86_64-pc-windows-msvc.zip',
      file: 'uv-x86_64-pc-windows-msvc.zip',
      extract: 'unzip',
      executable: 'uv.exe'
    }
  },
  node: {
    'darwin-x64': {
      // 使用官方镜像
      url: 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-x64.tar.gz',
      file: 'node-v20.18.0-darwin-x64.tar.gz',
      extract: 'tar -xzf',
      executable: 'bin/node',
      strip: 1
    },
    'darwin-arm64': {
      url: 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-darwin-arm64.tar.gz',
      file: 'node-v20.18.0-darwin-arm64.tar.gz',
      extract: 'tar -xzf',
      executable: 'bin/node',
      strip: 1
    },
    'linux-x64': {
      url: 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.xz',
      file: 'node-v20.18.0-linux-x64.tar.xz',
      extract: 'tar -xJf',
      executable: 'bin/node',
      strip: 1
    },
    'win32-x64': {
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

async function downloadDependency(name, platformKey) {
  const config = DEPENDENCIES[name][platformKey];
  if (!config) {
    console.log(`No ${name} binary available for ${platformKey}`);
    return;
  }

  const platformDir = path.join(VENDOR_DIR, `${name}-${platformKey}`);

  // 检查是否已存在可执行文件
  let execPath = path.join(platformDir, config.executable);

  // 检查是否在子目录中（如果直接路径不存在）
  if (!fs.existsSync(execPath) && fs.existsSync(platformDir)) {
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
    console.log(`${name} for ${platformKey} already exists at ${execPath}, skipping download`);

    // 确保可执行权限（非 Windows）
    if (!platformKey.startsWith('win32')) {
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
    if (!platformKey.startsWith('win32')) {
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

// 获取当前系统架构信息
function getCurrentSystemArch() {
  const platform = process.platform;
  const arch = process.arch;

  // 映射架构名称
  if (platform === 'darwin') {
    // macOS: 根据实际架构选择
    if (arch === 'arm64') {
      return 'darwin-arm64';
    } else if (arch === 'x64') {
      return 'darwin-x64';
    }
  } else if (platform === 'linux') {
    // Linux: 目前只支持 x64
    return 'linux-x64';
  } else if (platform === 'win32') {
    // Windows: 目前只支持 x64
    return 'win32-x64';
  }

  return `${platform}-${arch}`;
}

async function main() {
  console.log('Downloading vendor dependencies...');

  // 获取当前系统信息
  const currentPlatform = process.platform;
  const currentArch = process.arch;
  const systemKey = getCurrentSystemArch();

  console.log(`\nSystem Information:`);
  console.log(`  Platform: ${currentPlatform}`);
  console.log(`  Architecture: ${currentArch}`);
  console.log(`  Will download: ${systemKey}`);

  const supportedPlatforms = ['darwin', 'linux', 'win32'];

  if (!supportedPlatforms.includes(currentPlatform)) {
    console.error(`Unsupported platform: ${currentPlatform}`);
    process.exit(1);
  }

  ensureDir(VENDOR_DIR);

  try {
    // 获取命令行参数
    const downloadOnly = process.argv.includes('--download-only');

    // 只下载当前系统架构的依赖
    for (const depName of Object.keys(DEPENDENCIES)) {
      // 如果指定了只下载node，则跳过其他
      if (downloadOnly && depName !== 'node') {
        console.log(`\nSkipping ${depName} (download-only mode)`);
        continue;
      }

      // 使用标准架构键
      const archKey = systemKey;
      const depConfig = DEPENDENCIES[depName];
      if (depConfig[archKey]) {
        console.log(`\nDownloading ${depName} for ${archKey}...`);
        await downloadDependency(depName, archKey);
      } else {
        console.log(`\nSkipping ${depName} for ${archKey} (not available)`);
      }
    }

    console.log('\n✅ All dependencies downloaded successfully!');
    console.log(`Vendor directory: ${VENDOR_DIR}`);

    // 列出下载的内容
    console.log('\n📦 Downloaded files:');
    execSync(`ls -la "${VENDOR_DIR}"`, { stdio: 'inherit' });

    // 计算总大小
    try {
      const sizeResult = execSync(`du -sh "${VENDOR_DIR}"`, { encoding: 'utf8' });
      const totalSize = sizeResult.trim().split('\t')[0];
      console.log(`\n📊 Total size: ${totalSize}`);
    } catch (e) {
      // 忽略大小计算错误
    }

    console.log(`\n🚀 Usage:`);
    console.log(`  --download-only     只下载node`);

  } catch (error) {
    console.error('❌ Failed to download dependencies:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { downloadDependency, DEPENDENCIES };