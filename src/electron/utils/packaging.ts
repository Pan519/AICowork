import { join, dirname } from "path";
import { app } from "electron";
import { existsSync, readdirSync } from "fs";
import { stat, readFile } from "fs/promises";
import { log } from "../logger.js";

/**
 * 打包依赖管理器
 * 处理 bun、uv 等依赖的打包和运行时路径设置
 */

import { spawn } from "child_process";

// 需要打包的依赖列表
const PACKAGED_DEPENDENCIES = [
  {
    name: "bun",
    executable: "bun",
    paths: {
      darwin: "vendor/bun-darwin-aarch64/bun",
      linux: "vendor/bun-linux-x64/bun",
      win32: "vendor/bun-windows-x64/bun.exe"
    }
  },
  {
    name: "uv",
    executable: "uv",
    paths: {
      darwin: "vendor/uv-darwin-aarch64/uv",
      linux: "vendor/uv-linux-x64/uv",
      win32: "vendor/uv-windows-x64/uv.exe"
    }
  },
  {
    name: "node",
    executable: "node",
    paths: {
      darwin: "vendor/node-darwin-aarch64/bin/node",
      linux: "vendor/node-linux-x64/bin/node",
      win32: "vendor/node-windows-x64/node.exe"
    }
  }
];

/**
 * 获取增强的 PATH 路径
 * 包含打包的依赖路径
 */
export function buildEnhancedPath(): string {
  const platform = process.platform as "darwin" | "linux" | "win32";
  const pathSeparator = process.platform === "win32" ? ";" : ":";

  // 基础 PATH
  const basePath = process.env.PATH || "";
  const pathParts: string[] = [basePath];

  if (app.isPackaged) {
    // 生产环境：添加打包的依赖路径
    const resourcesPath = process.resourcesPath;

    PACKAGED_DEPENDENCIES.forEach(dep => {
      const relativePath = dep.paths[platform];
      if (relativePath) {
        // 添加到 app.asar.unpacked 的路径
        const unpackedPath = join(resourcesPath, "app.asar.unpacked", relativePath);
        const binDir = dirname(unpackedPath);

        if (existsSync(unpackedPath)) {
          pathParts.unshift(binDir);
          log.debug(`[Packaging] Added ${dep.name} to PATH: ${binDir}`);
        } else {
          log.warn(`[Packaging] ${dep.name} not found at: ${unpackedPath}`);
        }
      }
    });
  }

  // 去重并合并
  const uniquePaths = Array.from(new Set(pathParts.filter(p => p.trim())));
  return uniquePaths.join(pathSeparator);
}

/**
 * 获取可执行文件路径
 */
export async function getExecutablePath(executable: "node" | "bun" | "uv"): Promise<string | undefined> {
  const platform = process.platform as "darwin" | "linux" | "win32";

  if (app.isPackaged) {
    // 生产环境：使用打包的可执行文件
    const dep = PACKAGED_DEPENDENCIES.find(d => d.name === executable);
    if (!dep) {
      log.error(`[Packaging] Unknown executable: ${executable}`);
      return undefined;
    }

    const relativePath = dep.paths[platform];
    if (!relativePath) {
      log.error(`[Packaging] No path configured for ${executable} on ${platform}`);
      return undefined;
    }

    const execPath = join(process.resourcesPath, "app.asar.unpacked", relativePath);

    if (existsSync(execPath)) {
      // 验证可执行文件是否是有效的二进制（不是占位符脚本）
      try {
        // 检查文件大小和类型，确保不是占位符脚本
        const stats = await stat(execPath);
        if (stats.size < 1000) { // 真实的二进制文件应该更大
          const content = await readFile(execPath, "utf8");
          if (content.startsWith("#!/bin/bash") || content.includes("echo")) {
            log.warn(`[Packaging] Vendor ${executable} is a script, not a binary. Falling back to system ${executable}.`);
            return executable; // 回退到系统 PATH
          }
        }
      } catch (e) {
        log.warn(`[Packaging] Failed to validate vendor ${executable}:`, e);
        return executable; // 验证失败时回退到系统 PATH
      }

      log.debug(`[Packaging] Found ${executable} at: ${execPath}`);
      return execPath;
    } else {
      log.warn(`[Packaging] ${executable} not found at: ${execPath}`);
      // 对于 node/bun，回退到系统 PATH
      if (executable === "node" || executable === "bun") {
        log.info(`[Packaging] Falling back to system ${executable}`);
        return executable;
      }
      return undefined;
    }
  } else {
    // 开发环境：使用系统 PATH 中的可执行文件
    return executable;
  }
}

/**
 * 验证打包的依赖是否可用
 */
export async function validatePackagedDependencies(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const dep of PACKAGED_DEPENDENCIES) {
    const path = await getExecutablePath(dep.name as "node" | "bun" | "uv");
    results[dep.name] = !!path;

    if (path) {
      log.info(`[Packaging] ${dep.name} is available at: ${path}`);
    } else {
      log.warn(`[Packaging] ${dep.name} is not available`);
    }
  }

  return results;
}

/**
 * 异步验证可执行文件是否可用
 */
export async function validateExecutable(executable: string): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(executable, ['--version'], {
      stdio: 'ignore',
      shell: true
    });

    process.on('close', (code) => {
      resolve(code === 0);
    });

    process.on('error', () => {
      resolve(false);
    });

    // 超时处理
    setTimeout(() => {
      process.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * 获取验证报告
 */
export async function getValidationReport(): Promise<{
  platform: string;
  isPackaged: boolean;
  dependencies: Record<string, {
    path?: string;
    available: boolean;
    version?: string;
  }>;
}> {
  const report = {
    platform: process.platform,
    isPackaged: app.isPackaged,
    dependencies: {} as Record<string, {
      path?: string;
      available: boolean;
      version?: string;
    }>
  };

  for (const dep of PACKAGED_DEPENDENCIES) {
    const execPath = await getExecutablePath(dep.name as "node" | "bun" | "uv");
    const isAvailable = await validateExecutable(dep.name);

    report.dependencies[dep.name] = {
      path: execPath,
      available: isAvailable
    };

    if (execPath && isAvailable) {
      log.info(`[Validation] ${dep.name} validated successfully`);
    } else if (execPath) {
      log.warn(`[Validation] ${dep.name} found but not executable`);
    } else {
      log.warn(`[Validation] ${dep.name} not found`);
    }
  }

  return report;
}

/**
 * 获取 SDK 执行选项
 */
export async function getSDKExecutableOptions(): Promise<{
  executable?: "node" | "bun" | "deno";
  env?: Record<string, string>;
}> {
  const options: {
    executable?: "node" | "bun" | "deno";
    env?: Record<string, string>;
  } = {};

  // 优先使用 bun（如果可用）
  const bunPath = await getExecutablePath("bun");
  if (bunPath) {
    options.executable = "bun";
    log.info("[Packaging] Using bun as SDK executable");
  } else {
    // 回退到 node
    const nodePath = await getExecutablePath("node");
    if (nodePath) {
      options.executable = "node";
      log.info("[Packaging] Using node as SDK executable");
    }
  }

  // 设置增强的 PATH
  const enhancedPath = buildEnhancedPath();
  options.env = {
    ...process.env,
    PATH: enhancedPath
  };

  // 添加其他有用的环境变量
  if (bunPath) {
    options.env.BUN_INSTALL = dirname(bunPath);
  }

  if (await getExecutablePath("uv")) {
    options.env.UV_PYTHON_PREFERENCE = "only-system";
  }

  return options;
}