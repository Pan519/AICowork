#!/usr/bin/env node

/**
 * AICowork 聊天功能详细调试测试
 */

import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { setTimeout } from 'timers/promises';

const CONFIG = {
  dmgPath: '/Users/hanqin/nodeworks/AICowork-Xiaoxili/dist/AICowork-0.1.0-arm64.dmg',
  appName: 'AICowork',
  testMessage: "你好，请回复这条消息以测试聊天功能",
  logsDir: path.join(process.env.HOME, 'Library/Logs/AICowork'),
  appSupportDir: path.join(process.env.HOME, 'Library/Application Support/aicowork')
};

async function captureConsoleLogs() {
  console.log('\n📋 捕获控制台日志...');

  // 尝试从多个来源获取日志
  const sources = [
    { name: '系统日志', cmd: 'log show --predicate "process == \"AICowork\"" --last 2m --style compact 2>/dev/null | tail -20' },
    { name: '控制台日志', cmd: 'log stream --predicate "process == \"AICowork\"" --level debug --timeout 5s 2>/dev/null | tail -20' },
    { name: '应用日志', cmd: `tail -20 "${CONFIG.logsDir}/main.log" 2>/dev/null || echo "无应用日志"` },
    { name: '错误日志', cmd: `tail -20 "${CONFIG.logsDir}/logs/error.log" 2>/dev/null || echo "无错误日志"` }
  ];

  for (const source of sources) {
    console.log(`\n${source.name}:`);
    try {
      const { stdout } = await execPromise(source.cmd);
      if (stdout.trim()) {
        stdout.split('\n').forEach(line => console.log(`  ${line}`));
      } else {
        console.log('  (空)');
      }
    } catch (e) {
      console.log('  (获取失败)');
    }
  }
}

async function checkAppFiles() {
  console.log('\n🔍 检查应用文件...');

  const paths = [
    CONFIG.appSupportDir,
    path.join(CONFIG.appSupportDir, 'logs'),
    path.join(CONFIG.appSupportDir, 'database.db'),
    CONFIG.logsDir
  ];

  for (const p of paths) {
    try {
      const stats = await fs.stat(p);
      if (stats.isDirectory()) {
        const files = await fs.readdir(p);
        console.log(`✅ ${p} (${files.length} 个文件)`);
      } else {
        console.log(`✅ ${p} (${Math.round(stats.size / 1024)}KB)`);
      }
    } catch (e) {
      console.log(`❌ ${p} (不存在)`);
    }
  }
}

async function monitorAppBehavior() {
  console.log('\n👀 监控应用行为...');

  // 监控CPU和内存使用
  const pid = await getAppPID();
  if (pid) {
    console.log(`应用PID: ${pid}`);

    // 获取内存信息
    try {
      const { stdout } = await execPromise(`ps -p ${pid} -o pid,ppid,pcpu,pmem,time,command`);
      console.log('进程信息:');
      console.log(stdout);
    } catch (e) {
      console.log('无法获取进程信息');
    }

    // 检查打开的文件
    try {
      const { stdout } = await execPromise(`lsof -p ${pid} | grep -E "(log|db|json)" | head -10`);
      if (stdout.trim()) {
        console.log('\n打开的相关文件:');
        stdout.split('\n').forEach(line => console.log(`  ${line}`));
      }
    } catch (e) {
      // 忽略错误
    }
  }
}

async function getAppPID() {
  return new Promise((resolve) => {
    exec('pgrep -f "AICowork.app/Contents/MacOS/AICowork"', (error, stdout) => {
      if (!error && stdout.trim()) {
        resolve(stdout.trim().split('\n')[0]);
      } else {
        resolve(null);
      }
    });
  });
}

async function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function runDebugTest() {
  console.log('🔍 开始详细调试测试...\n');

  const isRunning = await new Promise((resolve) => {
    exec('pgrep -f "AICowork"', (error, stdout) => {
      resolve(!error && stdout.trim().length > 0);
    });
  });

  if (!isRunning) {
    console.log('❌ 应用未运行，请先运行应用');
    return;
  }

  console.log('✅ 应用正在运行');

  // 执行各项检查
  await checkAppFiles();
  await monitorAppBehavior();
  await captureConsoleLogs();

  // 测试消息发送
  console.log('\n💬 测试消息发送...');
  const script = `
    tell application "${CONFIG.appName}" to activate
    delay 1
    tell application "System Events"
      keystroke "${CONFIG.testMessage}"
      key code 36 -- Enter
    end tell
  `;

  try {
    await execPromise(`osascript -e '${script}'`);
    console.log('✅ 消息已发送');
  } catch (error) {
    console.log('❌ 消息发送失败:', error.message);
  }

  // 等待并再次捕获日志
  console.log('\n⏳ 等待5秒后再次捕获日志...');
  await setTimeout(5000);
  await captureConsoleLogs();

  // 生成调试报告
  const report = {
    timestamp: new Date().toISOString(),
    appRunning: await getAppPID() !== null,
    testMessage: CONFIG.testMessage
  };

  const reportPath = path.join(process.cwd(), 'DEBUG_TEST_REPORT.md');
  const reportContent = `# AICowork 调试测试报告

**测试时间**: ${report.timestamp}
**应用状态**: ${report.appRunning ? '运行中' : '已停止'}
**测试消息**: ${report.testMessage}

## 测试说明

此测试用于详细检查应用在macOS上的行为，特别关注：
1. 应用文件结构
2. 日志记录情况
3. 进程行为
4. 消息发送功能

## 检查结果

- 应用文件结构已检查
- 进程信息已获取
- 控制台日志已捕获
- 消息发送已测试

---
*详细调试测试*
`;

  await fs.writeFile(reportPath, reportContent);
  console.log(`\n✅ 调试报告已保存: ${reportPath}`);
}

// 运行调试测试
runDebugTest().catch(console.error);