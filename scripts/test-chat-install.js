#!/usr/bin/env node

/**
 * AICowork 聊天安装测试
 * 专注于测试从DMG安装后的聊天功能
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { setTimeout } from 'timers/promises';

const CONFIG = {
  dmgPath: '/Users/hanqin/nodeworks/AICowork-Xiaoxili/dist/AICowork-0.1.0-arm64.dmg',
  appName: 'AICowork',
  testMessages: [
    "你好，这是一个测试消息",
    "请检查聊天功能是否正常",
    "报告任何发现的错误"
  ],
  logsDir: path.join(process.env.HOME, 'Library/Logs/AICowork'),
  errorLog: path.join(process.env.HOME, 'Library/Logs/AICowork/logs/error.log'),
  mainLog: path.join(process.env.HOME, 'Library/Logs/AICowork/main.log')
};

async function checkAppRunning() {
  return new Promise((resolve) => {
    exec('pgrep -f "AICowork"', (error, stdout) => {
      resolve(!error && stdout.trim().length > 0);
    });
  });
}

async function killApp() {
  return new Promise((resolve) => {
    exec('pkill -f "AICowork"', () => {
      resolve();
    });
  });
}

async function mountDMG() {
  console.log('📦 挂载DMG文件...');
  return new Promise((resolve, reject) => {
    exec(`hdiutil attach "${CONFIG.dmgPath}"`, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        // 提取挂载点
        const lines = stdout.split('\n');
        const mountLine = lines.find(line => line.includes('/Volumes/'));
        const mountPath = mountLine ? mountLine.split('\t').pop() : null;
        console.log(`✅ DMG已挂载到: ${mountPath}`);
        resolve(mountPath);
      }
    });
  });
}

async function unmountDMG(mountPath) {
  console.log('🔓 卸载DMG...');
  return new Promise((resolve) => {
    exec(`hdiutil detach "${mountPath}"`, () => {
      resolve();
    });
  });
}

async function sendTestMessage(text) {
  const script = `
    tell application "${CONFIG.appName}" to activate
    delay 1
    tell application "System Events"
      keystroke "${text}"
      key code 36 -- Enter
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

async function readRecentLogs() {
  try {
    const errorContent = await fs.readFile(CONFIG.errorLog, 'utf-8');
    const mainContent = await fs.readFile(CONFIG.mainLog, 'utf-8');

    return {
      errors: errorContent.split('\n').filter(line => line.trim()),
      main: mainContent.split('\n').filter(line => line.trim())
    };
  } catch (e) {
    return { errors: [], main: [] };
  }
}

async function runTest() {
  console.log('🤖 开始聊天安装测试...\n');

  let mountPath = null;

  try {
    // 1. 检查DMG文件
    try {
      await fs.access(CONFIG.dmgPath);
      console.log('✅ DMG文件存在');
    } catch {
      throw new Error('DMG文件不存在，请先构建应用');
    }

    // 2. 如果应用已在运行，先关闭
    if (await checkAppRunning()) {
      console.log('🔄 关闭已运行的应用...');
      await killApp();
      await setTimeout(3000);
    }

    // 3. 挂载DMG
    mountPath = await mountDMG();
    const appPath = `${mountPath}/AICowork.app`;

    // 4. 启动应用
    console.log('🚀 从DMG启动应用...');
    exec(`open "${appPath}"`);

    // 等待应用启动
    let attempts = 0;
    while (!(await checkAppRunning()) && attempts < 30) {
      await setTimeout(1000);
      attempts++;
      process.stdout.write('.');
    }
    console.log('\n✅ 应用已启动');

    // 5. 等待初始化
    console.log('⏳ 等待应用初始化...');
    await setTimeout(5000);

    // 6. 发送测试消息
    console.log('\n💬 发送测试消息...');
    for (let i = 0; i < CONFIG.testMessages.length; i++) {
      const message = CONFIG.testMessages[i];
      console.log(`  [${i+1}/${CONFIG.testMessages.length}] ${message}`);

      try {
        await sendTestMessage(message);
        console.log('  ✅ 已发送');
      } catch (error) {
        console.log('  ❌ 发送失败:', error.message);
      }

      await setTimeout(3000);
    }

    // 7. 等待响应
    console.log('\n⏳ 等待响应...');
    await setTimeout(10000);

    // 8. 检查日志
    console.log('\n📋 检查日志...');
    const logs = await readRecentLogs();

    if (logs.errors.length > 0) {
      console.log('⚠️  发现错误:');
      logs.errors.slice(-5).forEach(line => console.log(`  - ${line}`));
    } else {
      console.log('✅ 未发现错误');
    }

    if (logs.main.length > 0) {
      console.log('ℹ️  主日志信息:');
      logs.main.slice(-5).forEach(line => console.log(`  - ${line}`));
    }

    // 9. 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      appRunning: await checkAppRunning(),
      errorCount: logs.errors.length,
      testMessages: CONFIG.testMessages,
      recentErrors: logs.errors.slice(-5),
      recentLogs: logs.main.slice(-5)
    };

    const reportPath = path.join(process.cwd(), 'CHAT_TEST_REPORT.md');
    const reportContent = `# AICowork 聊天功能测试报告

**测试时间**: ${report.timestamp}
**应用状态**: ${report.appRunning ? '运行中' : '已停止'}
**错误数量**: ${report.errorCount}

## 测试消息
${report.testMessages.map((m, i) => `${i+1}. ${m}`).join('\n')}

## 最近错误
${report.recentErrors.map(e => `- ${e}`).join('\n') || '无'}

## 最近日志
${report.recentLogs.map(l => `- ${l}`).join('\n') || '无'}

---
*从DMG安装测试*
`;

    await fs.writeFile(reportPath, reportContent);
    console.log(`\n✅ 测试报告已保存: ${reportPath}`);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  } finally {
    // 清理
    if (await checkAppRunning()) {
      console.log('\n🔄 关闭应用...');
      await killApp();
    }

    if (mountPath) {
      console.log('🔓 卸载DMG...');
      await unmountDMG(mountPath);
    }

    console.log('\n✅ 测试完成');
  }
}

// 运行测试
runTest().catch(console.error);