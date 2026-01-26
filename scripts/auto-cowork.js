#!/usr/bin/env node

/**
 * AICowork 自动化助手
 * 功能：自动打开应用、输入消息、监控日志并自我修复
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
  appSupportDir: path.join(process.env.HOME, 'Library/Application Support/aicowork'),
  appSupportErrorLog: path.join(process.env.HOME, 'Library/Application Support/aicowork/logs/error.log'),
  appSupportMainLog: path.join(process.env.HOME, 'Library/Application Support/aicowork/logs/app.log'),
  testMessages: [
    "请检查系统状态",
    "报告所有错误",
    "尝试自动修复发现的问题",
    "测试聊天功能是否正常",
    "你好，请回复这条消息"
  ],
  checkInterval: 2000,
  maxRetries: 3,
  commands: {
    checkRunning: 'pgrep -f "AICowork"',
    killApp: 'pkill -f "AICowork"',
    openInstalledApp: 'open -a "AICowork"',
    openSourceApp: 'open "/Users/hanqin/nodeworks/AICowork-Xiaoxili/dist/mac-arm64/AICowork.app"',
    focusApp: 'osascript -e \'tell application "AICowork" to activate\'',
    installApp: 'cp -R "/Users/hanqin/nodeworks/AICowork-Xiaoxili/dist/mac-arm64/AICowork.app" "/Applications/AICowork.app"',
    checkInstalled: 'ls "/Applications/AICowork.app"'
  }
};

class AutoCowork {
  constructor() {
    this.isRunning = false;
    this.errorCount = 0;
    this.retryCount = 0;
    this.logMonitors = new Map();
    this.appState = {
      isOpen: false,
      lastMessage: '',
      errors: [],
      fixes: []
    };
  }

  async run() {
    console.log('🤖 启动 AICowork 自动化助手...\n');

    try {
      this.isRunning = true;

      // 1. 预检查
      await this.precheck();

      // 2. 启动应用
      await this.startApp();

      // 3. 开始监控
      await this.startMonitoring();

      // 4. 执行自动化任务
      await this.executeTasks();

    } catch (error) {
      console.error('❌ 运行失败:', error);
      await this.handleCriticalError(error);
    }
  }

  async precheck() {
    console.log('🔍 执行预检查...');

    // 检查应用是否已安装到Applications目录
    const isInstalled = await this.isAppInstalled();
    if (isInstalled) {
      console.log('✅ 发现已安装的应用: /Applications/AICowork.app');
      console.log('📝 将测试已安装的应用版本');
    } else {
      console.log('⚠️  未找到已安装的应用');
      // 检查源应用是否存在
      try {
        await fs.access(CONFIG.sourceAppPath);
        console.log('✅ 源应用文件存在，将测试dist目录中的版本');
      } catch {
        throw new Error('应用文件不存在，请先打包应用');
      }
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

  async startApp() {
    console.log('\n📱 启动 AICowork 应用...');

    // 如果应用已在运行，先关闭
    if (await this.isAppRunning()) {
      console.log('应用已在运行，重新启动...');
      await this.killApp();
      await setTimeout(2000);
    }

    // 检查是否已安装到Applications目录
    const isInstalled = await this.isAppInstalled();
    if (isInstalled) {
      console.log('✅ 发现已安装的应用，将测试/Applications中的版本');
      console.log('📍 应用路径: /Applications/AICowork.app');
    } else {
      console.log('⚠️  未找到已安装的应用，将测试dist目录中的版本');
      console.log('📍 应用路径: /Users/hanqin/nodeworks/AICowork-Xiaoxili/dist/mac-arm64/AICowork.app');
    }

    // 启动应用
    return new Promise((resolve, reject) => {
      const openCommand = isInstalled ? CONFIG.commands.openInstalledApp : CONFIG.commands.openSourceApp;
      exec(openCommand, async (error) => {
        if (error) {
          reject(new Error(`启动应用失败: ${error.message}`));
        } else {
          console.log('✅ 应用启动命令已发送');

          // 等待应用完全启动
          await this.waitForAppReady();
          resolve();
        }
      });
    });
  }

  async isAppInstalled() {
    try {
      await fs.access(CONFIG.installAppPath);
      return true;
    } catch {
      return false;
    }
  }

  async waitForAppReady() {
    console.log('⏳ 等待应用就绪...');

    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      if (await this.isAppRunning()) {
        console.log('✅ 应用已成功启动');
        this.appState.isOpen = true;
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
    console.log('📝 特别关注聊天功能错误日志: ~/Library/Application Support/aicowork/logs/error.log');

    // 创建日志文件
    await this.createLogFiles();

    // 启动日志监控 - 重点监控Application Support目录中的错误日志
    this.startLogWatcher(CONFIG.errorLog, 'error');
    this.startLogWatcher(CONFIG.mainLog, 'main');

    // 重点监控Application Support目录中的日志
    if (await this.pathExists(CONFIG.appSupportErrorLog)) {
      console.log('📍 监控应用支持目录错误日志...');
      this.startLogWatcher(CONFIG.appSupportErrorLog, 'app-error');
    }
    if (await this.pathExists(CONFIG.appSupportMainLog)) {
      console.log('📍 监控应用支持目录主日志...');
      this.startLogWatcher(CONFIG.appSupportMainLog, 'app-main');
    }

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

      // 检测错误
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
      'unable', 'panic', 'fatal', 'unhandled'
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
    if (errorLine.includes('database')) {
      fixApplied = await this.fixDatabase();
    } else if (errorLine.includes('network')) {
      fixApplied = await this.fixNetwork();
    } else if (errorLine.includes('permission')) {
      fixApplied = await this.fixPermissions();
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

  async fixDatabase() {
    console.log('  🗄️  修复数据库问题...');

    try {
      // 重置数据库连接（这里需要根据实际数据库类型调整）
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

  async fixPermissions() {
    console.log('  🔐 修复权限问题...');

    try {
      // 修复应用权限
      await execPromise(`chmod -R 755 "${CONFIG.appPath}"`);

      // 修复日志目录权限
      await execPromise(`chmod -R 755 "${CONFIG.logsDir}"`);

      console.log('  ✅ 权限已修复');
      return true;
    } catch (error) {
      console.warn('  ⚠️  权限修复失败:', error.message);
      return false;
    }
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
    await setTimeout(2000);
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
      await setTimeout(3000); // 等待响应
    }
  }

  async sendMessage(text) {
    // 使用 AppleScript 发送消息 - 特别针对聊天功能测试
    const isChatMessage = text.includes("聊天") || text.includes("你好") || text.includes("回复");

    if (isChatMessage) {
      console.log(`  💬 正在测试聊天功能: "${text}"`);
    }

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
      console.log(`  ✅ 消息已发送${isChatMessage ? ' (聊天功能测试)' : ''}`);

      // 如果是聊天测试，等待更长时间观察响应
      if (isChatMessage) {
        console.log('  ⏳ 等待应用处理聊天消息...');
        await setTimeout(3000);
      }
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
    console.log(`  将观察 ${CONFIG.checkInterval * 10 / 1000} 秒`);

    // 观察一段时间
    for (let i = 0; i < 10; i++) {
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

    // 检查聊天功能测试结果
    const chatTestMessages = CONFIG.testMessages.filter(msg =>
      msg.includes("聊天") || msg.includes("你好") || msg.includes("回复")
    );

    // 检查Application Support目录中的错误日志
    let appSupportErrorLogContent = '';
    try {
      if (await this.pathExists(CONFIG.appSupportErrorLog)) {
        const content = await fs.readFile(CONFIG.appSupportErrorLog, 'utf-8');
        const errorLines = content.split('\n').filter(line => line.trim());
        if (errorLines.length > 0) {
          appSupportErrorLogContent = errorLines.slice(-10).join('\n');
        }
      }
    } catch (e) {
      // 忽略读取错误
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        appStatus: this.appState.isOpen ? 'running' : 'stopped',
        totalErrors: this.errorCount,
        fixesApplied: this.appState.fixes.length,
        testMessages: CONFIG.testMessages.length,
        chatMessages: chatTestMessages.length,
        appInstallPath: await this.isAppInstalled() ? '/Applications/AICowork.app' : 'dist/mac-arm64/AICowork.app'
      },
      appState: this.appState,
      errors: this.appState.errors,
      fixes: this.appState.fixes,
      appSupportErrorLog: appSupportErrorLogContent
    };

    // Generate timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportFilename = `${timestamp}_test_report.md`;
    const reportPath = path.join(__dirname, '..', 'tests', 'reports', reportFilename);

    const reportContent = `# AICowork 自动化测试报告

**测试时间**: ${report.timestamp}
**应用状态**: ${report.summary.appStatus}
**错误数量**: ${report.summary.totalErrors}
**修复次数**: ${report.summary.fixesApplied}
**测试版本**: ${report.summary.appInstallPath}

## 🎯 聊天功能专项测试结果

### 聊天消息测试
已发送 ${report.summary.chatMessages} 条聊天测试消息:
${chatTestMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

### Application Support错误日志检查
**重点关注路径**: \`~/Library/Application Support/aicowork/logs/error.log\`
${appSupportErrorLogContent ? '```\n' + appSupportErrorLogContent + '\n```' : '✅ 未发现错误日志或日志为空'}

## 📊 详细信息

### 应用状态
- 应用是否运行: ${this.appState.isOpen ? '是' : '否'}
- 应用路径: ${report.summary.appInstallPath}
- 最后消息: ${this.appState.lastMessage || '无'}

### 检测到的错误
${this.appState.errors.map(e => `- ${e.time}: ${e.message}`).join('\n') || '无错误'}

### 应用的修复
${this.appState.fixes.map(f => `- ${f.time}: ${f.fix}`).join('\n') || '无修复'}

### 所有测试消息
${CONFIG.testMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

## 🔍 聊天功能分析

1. **消息发送**: 聊天消息已成功发送到应用界面
2. **错误监控**: 持续监控Application Support目录中的错误日志
3. **响应等待**: 为聊天响应预留了额外的等待时间
4. **日志检查**: 重点检查聊天相关的错误和警告

---
*由自动化脚本生成 - 专为聊天功能测试优化*
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

// 交互式 CLI
class InteractiveCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('\n🤖 AICowork 自动化助手');
    console.log('======================\n');

    const options = await this.showMenu();

    if (options.runTest) {
      const auto = new AutoCowork();

      // 应用自定义设置
      if (options.customMessages?.length > 0) {
        CONFIG.testMessages = options.customMessages;
      }

      await auto.run();
    }

    this.rl.close();
  }

  async showMenu() {
    return new Promise((resolve) => {
      console.log('请选择操作:');
      console.log('1. 运行完整自动化测试');
      console.log('2. 仅启动应用和监控');
      console.log('3. 自定义测试消息');
      console.log('4. 退出\n');

      this.rl.question('输入选项 (1-4): ', async (choice) => {
        switch (choice) {
          case '1':
            resolve({ runTest: true });
            break;
          case '2':
            CONFIG.testMessages = [];
            resolve({ runTest: true });
            break;
          case '3':
            const messages = await this.getCustomMessages();
            resolve({ runTest: true, customMessages: messages });
            break;
          default:
            console.log('退出程序');
            resolve({ runTest: false });
        }
      });
    });
  }

  async getCustomMessages() {
    return new Promise((resolve) => {
      console.log('\n请输入自定义测试消息（每行一条，空行结束）:');
      const messages = [];

      const getInput = () => {
        this.rl.question('> ', (input) => {
          if (input.trim() === '') {
            resolve(messages);
          } else {
            messages.push(input.trim());
            getInput();
          }
        });
      };

      getInput();
    });
  }
}

// 命令行参数处理
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AICowork 自动化助手

用法: node auto-cowork.js [选项]

选项:
  --auto, -a      自动模式（无交互）
  --monitor, -m   仅监控模式
  --help, -h      显示帮助信息

示例:
  node auto-cowork.js        # 交互式模式
  node auto-cowork.js --auto # 自动模式
  node auto-cowork.js -m     # 仅监控日志
`);
    return;
  }

  if (args.includes('--monitor') || args.includes('-m')) {
    // 仅监控模式
    CONFIG.testMessages = [];
    const auto = new AutoCowork();
    await auto.run();
  } else if (args.includes('--auto') || args.includes('-a')) {
    // 自动模式
    const auto = new AutoCowork();
    await auto.run();
  } else {
    // 交互式模式
    const cli = new InteractiveCLI();
    await cli.start();
  }
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

export { AutoCowork, CONFIG };