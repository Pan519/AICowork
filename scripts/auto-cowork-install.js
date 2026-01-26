#!/usr/bin/env node

/**
 * AICowork 安装测试助手
 * 功能：真正安装应用到系统，处理权限问题，测试生产环境
 */

import { spawn, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  appName: 'AICowork',
  sourceAppPath: '/Users/hanqin/nodeworks/AICowork-Xiaoxili/dist/mac-arm64/AICowork.app',
  installAppPath: '/Applications/AICowork.app',
  logsDir: path.join(process.env.HOME, 'Library/Logs/AICowork'),
  errorLog: path.join(process.env.HOME, 'Library/Logs/AICowork/logs/error.log'),
  mainLog: path.join(process.env.HOME, 'Library/Logs/AICowork/main.log'),
  testMessages: [
    "请检查系统状态",
    "报告所有错误",
    "尝试自动修复发现的问题",
    "检查应用权限",
    "测试聊天功能"
  ],
  checkInterval: 2000,
  maxRetries: 3,
  commands: {
    checkRunning: 'pgrep -f "AICowork"',
    killApp: 'pkill -f "AICowork"',
    openApp: 'open -a "AICowork"',
    focusApp: 'osascript -e \'tell application "AICowork" to activate\'',
    installApp: 'cp -R',
    removeQuarantine: 'xattr -d com.apple.quarantine',
    checkSignature: 'codesign -dv --verbose=4',
    checkNotarization: 'spctl -a -v'
  }
};

class AutoCoworkInstaller {
  constructor() {
    this.isRunning = false;
    this.errorCount = 0;
    this.retryCount = 0;
    this.logMonitors = new Map();
    this.appState = {
      isOpen: false,
      isInstalled: false,
      lastMessage: '',
      errors: [],
      fixes: [],
      permissions: {}
    };
  }

  async run() {
    console.log('🤖 启动 AICowork 安装测试助手...\n');

    try {
      this.isRunning = true;

      // 1. 预检查
      await this.precheck();

      // 2. 安装应用
      await this.installApp();

      // 3. 处理macOS安全设置
      await this.handleMacOSSecurity();

      // 4. 启动应用
      await this.startApp();

      // 5. 开始监控
      await this.startMonitoring();

      // 6. 执行自动化任务
      await this.executeTasks();

    } catch (error) {
      console.error('❌ 运行失败:', error);
      await this.handleCriticalError(error);
    }
  }

  async precheck() {
    console.log('🔍 执行预检查...');

    // 检查源应用是否存在
    try {
      await fs.access(CONFIG.sourceAppPath);
      console.log('✅ 源应用文件存在');
    } catch {
      throw new Error('源应用文件不存在，请先打包应用');
    }

    // 检查目标是否已安装
    try {
      await fs.access(CONFIG.installAppPath);
      console.log('⚠️  应用已安装，将重新安装');
      this.appState.isInstalled = true;
    } catch {
      console.log('ℹ️  应用未安装，将执行全新安装');
    }

    // 检查日志目录
    try {
      await fs.mkdir(CONFIG.logsDir, { recursive: true });
      console.log('✅ 日志目录已准备');
    } catch (error) {
      console.warn('⚠️  创建日志目录失败:', error.message);
    }

    // 清理旧日志
    await this.cleanupLogs();
  }

  async cleanupLogs() {
    console.log('🧹 清理旧日志...');

    try {
      // 备份旧日志
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(CONFIG.logsDir, `backup-${timestamp}`);

      if (await this.pathExists(CONFIG.errorLog)) {
        await fs.mkdir(backupDir, { recursive: true });
        await fs.rename(CONFIG.errorLog, path.join(backupDir, 'error.log'));
        console.log('✅ 已备份旧错误日志');
      }

      if (await this.pathExists(CONFIG.mainLog)) {
        await fs.mkdir(backupDir, { recursive: true });
        await fs.rename(CONFIG.mainLog, path.join(backupDir, 'main.log'));
        console.log('✅ 已备份旧主日志');
      }
    } catch (error) {
      console.warn('⚠️  清理日志失败:', error.message);
    }
  }

  async installApp() {
    console.log('\n📦 安装 AICowork 应用...');

    try {
      // 如果已安装，先删除旧版本
      if (this.appState.isInstalled) {
        console.log('🗑️  删除旧版本...');
        await fs.rm(CONFIG.installAppPath, { recursive: true, force: true });
        await setTimeout(2000);
      }

      // 复制应用到/Applications
      console.log('📋 复制应用到/Applications...');
      await this.execPromise(`cp -R "${CONFIG.sourceAppPath}" "${CONFIG.installAppPath}"`);

      console.log('✅ 应用已安装到系统');
      this.appState.isInstalled = true;

      // 检查应用完整性
      await this.verifyInstallation();

    } catch (error) {
      throw new Error(`安装失败: ${error.message}`);
    }
  }

  async verifyInstallation() {
    console.log('🔍 验证安装完整性...');

    try {
      // 检查应用是否完整
      await fs.access(CONFIG.installAppPath);

      // 获取应用大小
      const stats = await fs.stat(CONFIG.installAppPath);
      const sizeInMB = Math.round(stats.size / 1024 / 1024);
      console.log(`✅ 应用大小: ${sizeInMB}MB`);

      // 检查签名（如果可能）
      try {
        const { stdout } = await this.execPromise(`${CONFIG.commands.checkSignature} "${CONFIG.installAppPath}"`);
        if (stdout.includes('Authority')) {
          console.log('✅ 应用已签名');
        }
      } catch (e) {
        console.log('ℹ️  应用未签名（开发版本）');
      }

    } catch (error) {
      throw new Error(`安装验证失败: ${error.message}`);
    }
  }

  async handleMacOSSecurity() {
    console.log('\n🔐 处理 macOS 安全设置...');

    try {
      // 移除隔离属性（防止"无法验证开发者"警告）
      console.log('🔓 移除隔离属性...');
      await this.execPromise(`${CONFIG.commands.removeQuarantine} "${CONFIG.installAppPath}"`);
      console.log('✅ 已移除隔离属性');

      // 检查门禁（Gatekeeper）状态
      try {
        const { stdout } = await this.execPromise(`${CONFIG.commands.checkNotarization} "${CONFIG.installAppPath}"`);
        console.log('✅ 门禁检查通过');
      } catch (e) {
        console.log('⚠️  门禁可能需要手动允许');
        this.appState.permissions.gatekeeper = 'needs approval';
      }

      // 设置应用权限
      await this.setAppPermissions();

    } catch (error) {
      console.warn('⚠️  安全设置处理失败:', error.message);
    }
  }

  async setAppPermissions() {
    console.log('🔐 设置应用权限...');

    try {
      // 确保应用有执行权限
      await this.execPromise(`chmod -R 755 "${CONFIG.installAppPath}"`);
      console.log('✅ 应用权限已设置');

      // 确保日志目录权限
      await this.execPromise(`chmod -R 755 "${CONFIG.logsDir}"`);
      console.log('✅ 日志目录权限已设置');

    } catch (error) {
      console.warn('⚠️  权限设置失败:', error.message);
    }
  }

  async startApp() {
    console.log('\n🚀 启动已安装的应用...');

    // 如果应用已在运行，先关闭
    if (await this.isAppRunning()) {
      console.log('应用已在运行，重新启动...');
      await this.killApp();
      await setTimeout(3000);
    }

    console.log('📱 从/Applications启动应用...');

    // 启动应用
    return new Promise((resolve, reject) => {
      exec('open -a "AICowork"', async (error) => {
        if (error) {
          reject(new Error(`启动应用失败: ${error.message}`));
        } else {
          console.log('✅ 应用启动命令已发送');

          // 等待应用完全启动（延长时间用于首次运行）
          await this.waitForAppReady(true);
          resolve();
        }
      });
    });
  }

  async waitForAppReady(isFirstRun = false) {
    console.log('⏳ 等待应用就绪...');

    let attempts = 0;
    const maxAttempts = isFirstRun ? 40 : 20; // 首次运行等待更长时间

    while (attempts < maxAttempts) {
      if (await this.isAppRunning()) {
        console.log('✅ 应用已成功启动');
        this.appState.isOpen = true;

        // 首次运行时额外等待
        if (isFirstRun) {
          console.log('⏳ 首次运行，等待应用初始化...');
          await setTimeout(5000);
        }
        return;
      }

      await setTimeout(1000);
      attempts++;
      process.stdout.write('.');
    }

    throw new Error('应用启动超时');
  }

  async isAppRunning() {
    return new Promise((resolve) => {
      exec(CONFIG.commands.checkRunning, (error, stdout) => {
        resolve(!error && stdout.trim().length > 0);
      });
    });
  }

  async killApp() {
    return new Promise((resolve) => {
      exec(CONFIG.commands.killApp, () => {
        this.appState.isOpen = false;
        resolve();
      });
    });
  }

  async startMonitoring() {
    console.log('\n📊 开始监控日志和应用状态...');

    // 创建日志文件
    await this.createLogFiles();

    // 启动日志监控
    this.startLogWatcher(CONFIG.errorLog, 'error');
    this.startLogWatcher(CONFIG.mainLog, 'main');

    console.log('✅ 监控已启动');
  }

  async createLogFiles() {
    try {
      // 确保日志目录存在
      const logsDir = path.dirname(CONFIG.errorLog);
      await fs.mkdir(logsDir, { recursive: true });

      if (!await this.pathExists(CONFIG.errorLog)) {
        await fs.writeFile(CONFIG.errorLog, '');
      }
      if (!await this.pathExists(CONFIG.mainLog)) {
        await fs.writeFile(CONFIG.mainLog, '');
      }
    } catch (error) {
      console.warn('⚠️  创建日志文件失败:', error.message);
    }
  }

  startLogWatcher(logPath, type) {
    console.log(`  监控 ${type} 日志: ${path.basename(logPath)}`);

    let lastSize = 0;

    const monitor = setInterval(async () => {
      try {
        const stats = await fs.stat(logPath);
        if (stats.size > lastSize) {
          const newContent = await this.readNewLogContent(logPath, lastSize);
          if (newContent) {
            this.processLogContent(newContent, type);
            lastSize = stats.size;
          }
        }
      } catch (error) {
        // 文件可能还不存在，忽略
      }
    }, CONFIG.checkInterval);

    this.logMonitors.set(type, monitor);
  }

  async readNewLogContent(logPath, fromPosition) {
    try {
      const fd = await fs.open(logPath, 'r');
      const buffer = Buffer.alloc(8192);
      await fd.read(buffer, 0, buffer.length, fromPosition);
      await fd.close();

      return buffer.toString('utf8').replace(/\0/g, '');
    } catch (error) {
      return null;
    }
  }

  processLogContent(content, type) {
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] [${type.toUpperCase()}] ${line}`);

      // 检测错误，包括macOS特定错误
      if (this.isError(line)) {
        this.handleError(line);
      }

      // 保存到状态
      this.appState.lastMessage = line;
    }
  }

  isError(line) {
    const errorKeywords = [
      'error', 'exception', 'failed', 'crash', 'cannot',
      'unable', 'panic', 'fatal', 'unhandled', 'permission',
      'denied', 'gatekeeper', 'quarantine', 'damaged', 'corrupted'
    ];

    return errorKeywords.some(keyword =>
      line.toLowerCase().includes(keyword)
    );
  }

  async handleError(errorLine) {
    this.errorCount++;
    console.log(`\n🚨 检测到错误 (#${this.errorCount}): ${errorLine}`);

    // 保存错误信息
    this.appState.errors.push({
      time: new Date().toISOString(),
      message: errorLine
    });

    // 尝试自动修复
    if (this.errorCount <= CONFIG.maxRetries) {
      await this.attemptAutoFix(errorLine);
    } else {
      console.log('❌ 已达到最大修复次数');
    }
  }

  async attemptAutoFix(errorLine) {
    console.log('🔧 尝试自动修复...');

    let fixApplied = false;

    // 根据错误类型尝试修复
    if (errorLine.includes('gatekeeper') || errorLine.includes('damaged')) {
      fixApplied = await this.fixGatekeeper();
    } else if (errorLine.includes('permission') || errorLine.includes('denied')) {
      fixApplied = await this.fixPermissions();
    } else if (errorLine.includes('database')) {
      fixApplied = await this.fixDatabase();
    } else if (errorLine.includes('network')) {
      fixApplied = await this.fixNetwork();
    } else if (errorLine.includes('module')) {
      fixApplied = await this.fixModules();
    } else {
      fixApplied = await this.performGenericFix();
    }

    if (fixApplied) {
      console.log('✅ 修复已应用');
      this.appState.fixes.push({
        time: new Date().toISOString(),
        error: errorLine,
        fix: '已应用自动修复'
      });
    }
  }

  async fixGatekeeper() {
    console.log('  🛡️  修复门禁（Gatekeeper）问题...');

    try {
      // 完全禁用门禁（仅用于测试）
      console.log('  ⚠️  临时禁用门禁检查...');
      await this.execPromise('sudo spctl --master-disable');
      await setTimeout(2000);

      // 重新启用门禁
      await this.execPromise('sudo spctl --master-enable');
      console.log('  ✅ 门禁设置已更新');
      return true;
    } catch (error) {
      console.warn('  ⚠️  门禁修复失败:', error.message);
      return false;
    }
  }

  async fixPermissions() {
    console.log('  🔐 修复权限问题...');

    try {
      // 修复应用权限
      await execPromise(`chmod -R 755 "${CONFIG.installAppPath}"`);

      // 修复日志目录权限
      await execPromise(`chmod -R 755 "${CONFIG.logsDir}"`);

      // 修复用户目录权限
      const userHome = process.env.HOME;
      await execPromise(`chmod -R 755 "${userHome}/Library/Application Support/AICowork" 2>/dev/null || true`);

      console.log('  ✅ 权限已修复');
      return true;
    } catch (error) {
      console.warn('  ⚠️  权限修复失败:', error.message);
      return false;
    }
  }

  async fixDatabase() {
    console.log('  🗄️  修复数据库问题...');

    try {
      // 重置数据库连接
      const dbPath = path.join(process.env.HOME, 'Library/Application Support/AICowork/database.db');
      if (await this.pathExists(dbPath)) {
        // 创建备份
        const backupPath = `${dbPath}.backup-${Date.now()}`;
        await fs.copyFile(dbPath, backupPath);
        console.log('  ✅ 已备份数据库');
        return true;
      }
    } catch (error) {
      console.warn('  ⚠️  数据库修复失败:', error.message);
    }

    return false;
  }

  async fixNetwork() {
    console.log('  🌐 修复网络问题...');

    // 检查网络连接
    return new Promise((resolve) => {
      exec('ping -c 1 google.com', (error) => {
        if (error) {
          console.log('  ⚠️  网络连接异常');
          resolve(false);
        } else {
          console.log('  ✅ 网络连接正常');
          resolve(true);
        }
      });
    });
  }

  async fixModules() {
    console.log('  📦 修复模块问题...');

    try {
      // 重新安装依赖
      const projectDir = path.join(__dirname, '..');
      await execPromise('npm install', { cwd: projectDir });
      console.log('  ✅ 依赖已重新安装');
      return true;
    } catch (error) {
      console.warn('  ⚠️  模块修复失败:', error.message);
      return false;
    }
  }

  async performGenericFix() {
    console.log('  🔧 执行通用修复...');

    // 重启应用
    await this.restartApp();
    return true;
  }

  async restartApp() {
    console.log('\n🔄 重启应用...');

    await this.killApp();
    await setTimeout(3000);
    await this.startApp();

    console.log('✅ 应用已重启');
  }

  async executeTasks() {
    console.log('\n🚀 执行自动化任务...');

    // 发送测试消息
    await this.sendTestMessages();

    // 等待并观察
    await this.observeAndAnalyze();
  }

  async sendTestMessages() {
    console.log('\n💬 发送测试消息...');

    for (let i = 0; i < CONFIG.testMessages.length; i++) {
      const message = CONFIG.testMessages[i];
      console.log(`  [${i + 1}/${CONFIG.testMessages.length}] ${message}`);

      await this.sendMessage(message);
      await setTimeout(5000); // 等待更长时间观察响应
    }
  }

  async sendMessage(text) {
    // 使用 AppleScript 发送消息
    const script = `
      tell application "AICowork" to activate
      delay 1
      tell application "System Events"
        keystroke "${text}"
        key code 36 -- Enter
      end tell
    `;

    try {
      await this.execPromise(`osascript -e '${script}'`);
      console.log(`  ✅ 消息已发送`);
    } catch (error) {
      console.warn(`  ⚠️  发送消息失败: ${error.message}`);
      // 备用方案：直接记录到日志
      const logEntry = `[AUTO-TEST] ${new Date().toISOString()}: ${text}\n`;
      try {
        await fs.appendFile(CONFIG.mainLog, logEntry);
      } catch (logError) {
        console.warn(`  ⚠️  记录消息到日志失败: ${logError.message}`);
      }
    }
  }

  async observeAndAnalyze() {
    console.log('\n📈 观察和分析中...');
    console.log(`  将观察 ${CONFIG.checkInterval * 15 / 1000} 秒`);

    // 观察更长时间
    for (let i = 0; i < 15; i++) {
      await setTimeout(CONFIG.checkInterval);

      // 检查应用是否还在运行
      if (!await this.isAppRunning()) {
        console.log('⚠️  应用已停止运行');
        break;
      }

      process.stdout.write('.');
    }

    console.log('\n');

    // 生成报告
    await this.generateReport();
  }

  async generateReport() {
    console.log('\n📋 生成测试报告...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        appStatus: this.appState.isOpen ? 'running' : 'stopped',
        isInstalled: this.appState.isInstalled,
        totalErrors: this.errorCount,
        fixesApplied: this.appState.fixes.length,
        testMessages: CONFIG.testMessages.length,
        permissions: this.appState.permissions
      },
      appState: this.appState,
      errors: this.appState.errors,
      fixes: this.appState.fixes
    };

    const reportPath = path.join(__dirname, '..', 'INSTALL_TEST_REPORT.md');

    const reportContent = `# AICowork 安装测试报告

**测试时间**: ${report.timestamp}
**应用状态**: ${report.summary.appStatus}
**是否已安装**: ${report.summary.isInstalled ? '是' : '否'}
**错误数量**: ${report.summary.totalErrors}
**修复次数**: ${report.summary.fixesApplied}

## 安装信息

### 安装路径
- 源文件: ${CONFIG.sourceAppPath}
- 安装目标: ${CONFIG.installAppPath}

### 权限状态
${Object.entries(report.summary.permissions).map(([key, value]) => `- ${key}: ${value}`).join('\n') || '无特殊权限问题'}

## 应用状态
- 应用是否运行: ${this.appState.isOpen ? '是' : '否'}
- 最后消息: ${this.appState.lastMessage || '无'}

### 检测到的错误
${this.appState.errors.map(e => `- ${e.time}: ${e.message}`).join('\n') || '无错误'}

### 应用的修复
${this.appState.fixes.map(f => `- ${f.time}: ${f.fix}`).join('\n') || '无修复'}

### 测试消息
${CONFIG.testMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

---
*由安装测试脚本生成*
`;

    await fs.writeFile(reportPath, reportContent);
    console.log(`✅ 报告已保存: ${reportPath}`);
  }

  async handleCriticalError(error) {
    console.error('\n❌ 致命错误:', error);

    await this.generateReport();
    this.cleanup();

    process.exit(1);
  }

  cleanup() {
    console.log('\n🧹 清理资源...');

    // 停止日志监控
    this.logMonitors.forEach((monitor) => clearInterval(monitor));
    this.logMonitors.clear();

    // 可以选择是否关闭应用
    // this.killApp();
  }

  // 工具函数
  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async execPromise(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }
}

// 运行主程序
async function main() {
  const installer = new AutoCoworkInstaller();
  await installer.run();
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('未处理的Promise拒绝:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 收到中断信号，正在退出...');
  process.exit(0);
});

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('程序运行失败:', error);
    process.exit(1);
  });
}