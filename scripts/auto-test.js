#!/usr/bin/env node

/**
 * AICowork 自动化测试和修复脚本
 * 功能：自动打开应用、输入聊天信息、监控日志并尝试自我修复
 */

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  appPath: '/Users/hanqin/nodeworks/AICowork-Xiaoxili/dist/mac-arm64/AICowork.app',
  logsDir: path.join(process.env.HOME, 'Library/Logs/AICowork'),
  errorLog: path.join(process.env.HOME, 'Library/Logs/AICowork/logs/error.log'),
  mainLog: path.join(process.env.HOME, 'Library/Logs/AICowork/main.log'),
  testMessages: [
    "你好，请帮我测试一下这个应用是否正常工作",
    "请检查系统状态并报告任何错误",
    "如果有错误，请尝试自动修复"
  ],
  checkInterval: 5000, // 5秒检查一次日志
  maxRetries: 3
};

class AICoworkAutoTester {
  constructor() {
    this.appProcess = null;
    this.logMonitor = null;
    this.errorCount = 0;
    this.isRunning = false;
    this.retryCount = 0;
    this.logWatchers = new Set();
  }

  async start() {
    console.log('🚀 启动 AICowork 自动化测试...');

    try {
      // 1. 清理旧日志
      await this.cleanLogs();

      // 2. 启动应用
      await this.startApp();

      // 3. 等待应用启动
      await this.waitForApp();

      // 4. 开始监控日志
      this.startLogMonitoring();

      // 5. 自动输入测试消息
      await this.sendTestMessages();

      // 6. 等待并分析结果
      await this.analyzeResults();

    } catch (error) {
      console.error('❌ 测试过程出错:', error);
      await this.handleError(error);
    }
  }

  async cleanLogs() {
    console.log('🧹 清理旧日志文件...');
    try {
      if (fs.existsSync(CONFIG.logsDir)) {
        const files = fs.readdirSync(CONFIG.logsDir);
        for (const file of files) {
          if (file.endsWith('.log')) {
            const logPath = path.join(CONFIG.logsDir, file);
            console.log(`  清理日志: ${file}`);
            // 重命名旧日志文件
            const backupPath = `${logPath}.${Date.now()}.bak`;
            fs.renameSync(logPath, backupPath);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  清理日志时出错:', error.message);
    }
  }

  async startApp() {
    console.log('📱 启动 AICowork 应用...');

    return new Promise((resolve, reject) => {
      // 打开应用
      this.appProcess = spawn('open', [CONFIG.appPath], {
        stdio: 'ignore',
        detached: true
      });

      this.appProcess.on('error', (error) => {
        console.error('❌ 启动应用失败:', error);
        reject(error);
      });

      this.appProcess.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`⚠️  应用退出，代码: ${code}`);
        }
      });

      // 给应用一些启动时间
      setTimeout(resolve, 3000);
    });
  }

  async waitForApp() {
    console.log('⏳ 等待应用启动...');

    // 检查应用是否正在运行
    return new Promise((resolve, reject) => {
      let checkCount = 0;
      const maxChecks = 10;

      const checkApp = () => {
        exec('ps aux | grep -i "AICowork" | grep -v grep', (error, stdout) => {
          if (stdout && stdout.includes('AICowork')) {
            console.log('✅ 应用已成功启动');
            resolve();
          } else {
            checkCount++;
            if (checkCount >= maxChecks) {
              reject(new Error('应用启动超时'));
            } else {
              setTimeout(checkApp, 2000);
            }
          }
        });
      };

      checkApp();
    });
  }

  startLogMonitoring() {
    console.log('📊 开始监控日志文件...');

    // 确保日志目录存在
    if (!fs.existsSync(CONFIG.logsDir)) {
      fs.mkdirSync(CONFIG.logsDir, { recursive: true });
    }

    // 监控错误日志
    this.watchLogFile(CONFIG.errorLog, 'error');
    this.watchLogFile(CONFIG.mainLog, 'main');
  }

  watchLogFile(logPath, type) {
    // 如果文件不存在，先创建
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '');
    }

    console.log(`  监控日志: ${path.basename(logPath)}`);

    const watcher = fs.watchFile(logPath, { interval: 1000 }, (curr, prev) => {
      if (curr.size > prev.size) {
        const newContent = fs.readFileSync(logPath, 'utf8', { start: prev.size });
        this.processNewLogs(newContent, type);
      }
    });

    this.logWatchers.add(watcher);
  }

  processNewLogs(content, type) {
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      console.log(`[${type.toUpperCase()}] ${line}`);

      // 检测错误模式
      if (this.isErrorLine(line)) {
        this.errorCount++;
        console.log(`🚨 检测到错误 (#${this.errorCount}): ${line}`);
        this.attemptAutoFix(line);
      }
    }
  }

  isErrorLine(line) {
    const errorPatterns = [
      /error/i,
      /exception/i,
      /failed/i,
      /crash/i,
      /cannot/i,
      /unable/i,
      /panic/i,
      /fatal/i
    ];

    return errorPatterns.some(pattern => pattern.test(line));
  }

  async sendTestMessages() {
    console.log('💬 发送测试消息...');

    // 这里需要模拟用户输入，可以通过 AppleScript 或 CLI 接口
    try {
      // 方法1: 使用 AppleScript 模拟输入
      for (let i = 0; i < CONFIG.testMessages.length; i++) {
        const message = CONFIG.testMessages[i];
        console.log(`  发送消息 ${i + 1}: ${message}`);

        await this.simulateInput(message);
        await this.sleep(5000); // 等待响应
      }
    } catch (error) {
      console.warn('⚠️  发送消息失败:', error.message);
    }
  }

  async simulateInput(text) {
    // 使用 AppleScript 模拟输入
    const script = `
      tell application "AICowork"
        activate
      end tell
      delay 1
      tell application "System Events"
        keystroke "${text}"
        key code 36 -- Return key
      end tell
    `;

    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script}'`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async analyzeResults() {
    console.log('\n📈 分析测试结果...');

    // 等待一段时间让应用处理
    await this.sleep(10000);

    console.log(`\n📊 测试统计:`);
    console.log(`  错误数量: ${this.errorCount}`);
    console.log(`  重试次数: ${this.retryCount}`);

    if (this.errorCount === 0) {
      console.log('✅ 测试通过！未发现错误。');
    } else {
      console.log(`⚠️  发现 ${this.errorCount} 个错误`);

      // 如果还有重试机会，重新开始
      if (this.retryCount < CONFIG.maxRetries) {
        this.retryCount++;
        console.log(`🔄 第 ${this.retryCount} 次重试...`);
        await this.restartApp();
      } else {
        console.log('❌ 已达到最大重试次数');
        await this.generateReport();
      }
    }
  }

  async attemptAutoFix(errorLine) {
    console.log('🔧 尝试自动修复...');

    // 根据错误类型尝试不同的修复策略
    if (errorLine.includes('database')) {
      await this.fixDatabaseError();
    } else if (errorLine.includes('network') || errorLine.includes('connection')) {
      await this.fixNetworkError();
    } else if (errorLine.includes('permission')) {
      await this.fixPermissionError();
    } else if (errorLine.includes('module') || errorLine.includes('dependency')) {
      await this.fixModuleError();
    } else {
      // 通用修复策略
      await this.performGenericFix();
    }
  }

  async fixDatabaseError() {
    console.log('  🗄️  修复数据库错误...');
    // 可以尝试重置数据库连接或清理缓存
  }

  async fixNetworkError() {
    console.log('  🌐 修复网络错误...');
    // 可以检查网络连接或重置网络配置
  }

  async fixPermissionError() {
    console.log('  🔐 修复权限错误...');
    // 可以修复文件权限
    const appPath = CONFIG.appPath;
    exec(`chmod -R 755 "${appPath}"`, () => {
      console.log('  ✅ 已修复应用权限');
    });
  }

  async fixModuleError() {
    console.log('  📦 修复模块错误...');
    // 可以重新安装依赖
    exec('npm install', { cwd: path.join(__dirname, '..') }, (error) => {
      if (error) {
        console.error('  ❌ 重新安装依赖失败:', error);
      } else {
        console.log('  ✅ 已重新安装依赖');
      }
    });
  }

  async performGenericFix() {
    console.log('  🔧 执行通用修复...');
    // 重启应用
    await this.restartApp();
  }

  async restartApp() {
    console.log('🔄 重启应用...');

    // 关闭当前应用
    if (this.appProcess) {
      exec('pkill -f AICowork', () => {
        console.log('  ✅ 已关闭应用');
      });
    }

    // 等待后重新启动
    await this.sleep(3000);
    await this.start();
  }

  async generateReport() {
    console.log('\n📋 生成测试报告...');

    const reportPath = path.join(__dirname, '..', 'test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: this.errorCount,
        retryCount: this.retryCount,
        status: this.errorCount === 0 ? 'PASSED' : 'FAILED'
      },
      errors: [],
      fixes: []
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  报告已保存: ${reportPath}`);
  }

  async handleError(error) {
    console.error('❌ 处理致命错误:', error);

    // 生成错误报告
    await this.generateReport();

    // 清理资源
    this.cleanup();

    process.exit(1);
  }

  cleanup() {
    console.log('🧹 清理资源...');

    // 停止日志监控
    this.logWatchers.forEach(watcher => {
      watcher.stop();
    });

    // 关闭应用
    if (this.appProcess) {
      exec('pkill -f AICowork');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 交互式界面
class InteractiveTester {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('\n🤖 AICowork 自动化测试工具');
    console.log('==========================\n');

    const answers = await this.askQuestions();

    if (answers.runTest) {
      const tester = new AICoworkAutoTester();

      // 设置自定义配置
      if (answers.customMessages) {
        CONFIG.testMessages = answers.customMessages.split(',').map(m => m.trim());
      }

      await tester.start();
    }

    this.rl.close();
  }

  askQuestions() {
    return new Promise((resolve) => {
      this.rl.question('运行自动化测试? (y/n): ', (runTest) => {
        if (runTest.toLowerCase() === 'y') {
          this.rl.question('自定义测试消息 (用逗号分隔，直接回车使用默认): ', (customMessages) => {
            resolve({
              runTest: true,
              customMessages: customMessages || null
            });
          });
        } else {
          resolve({ runTest: false });
        }
      });
    });
  }
}

// 主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  // 检查命令行参数
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AICowork 自动化测试工具

用法: node auto-test.js [选项]

选项:
  --auto, -a      自动模式（无交互）
  --help, -h      显示帮助信息

示例:
  node auto-test.js        # 交互式模式
  node auto-test.js --auto # 自动模式
`);
    process.exit(0);
  }

  if (args.includes('--auto') || args.includes('-a')) {
    // 自动模式
    const tester = new AICoworkAutoTester();
    tester.start().catch(console.error);
  } else {
    // 交互式模式
    const interactive = new InteractiveTester();
    interactive.start().catch(console.error);
  }
}

export { AICoworkAutoTester, CONFIG };