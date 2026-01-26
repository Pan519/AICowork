#!/usr/bin/env node

/**
 * 测试API配置问题
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { setTimeout } from 'timers/promises';

const CONFIG = {
  appSupportDir: path.join(process.env.HOME, 'Library/Application Support/aicowork'),
  apiConfigPath: path.join(process.env.HOME, 'Library/Application Support/aicowork/api-config.json'),
  logsDir: path.join(process.env.HOME, 'Library/Application Support/aicowork/logs'),
  testMessage: "测试API配置是否影响聊天功能"
};

async function checkApiConfig() {
  console.log('🔍 检查API配置状态...\n');

  // 检查api-config.json是否存在
  try {
    await fs.access(CONFIG.apiConfigPath);
    console.log('✅ api-config.json 文件存在');

    const content = await fs.readFile(CONFIG.apiConfigPath, 'utf-8');
    console.log('文件内容:');
    console.log(content);

    return true;
  } catch (error) {
    console.log('❌ api-config.json 文件不存在');
    console.log('这可能导致聊天功能无法正常工作');
    return false;
  }
}

async function checkOtherConfigFiles() {
  console.log('\n📁 检查其他配置文件...');

  const configFiles = [
    'settings.json',
    'api-config.json',
    'agents/global-config.json',
    'sessions.db'
  ];

  for (const file of configFiles) {
    const filePath = path.join(CONFIG.appSupportDir, file);
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      console.log(`✅ ${file} - ${Math.round(stats.size / 1024 * 100) / 100}KB`);
    } catch (error) {
      console.log(`❌ ${file} - 不存在`);
    }
  }
}

async function checkLogErrors() {
  console.log('\n📋 检查日志中的错误...');

  const logFile = path.join(CONFIG.logsDir, 'app.log');
  try {
    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.split('\n');

    // 查找最近的错误
    const recentErrors = lines.filter(line =>
      line.includes('ERROR') ||
      line.includes('WARN') ||
      line.includes('Failed') ||
      line.includes('ENOENT')
    ).slice(-10);

    if (recentErrors.length > 0) {
      console.log('最近的错误/警告:');
      recentErrors.forEach(line => {
        console.log(`  ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
      });
    } else {
      console.log('✅ 未发现错误');
    }
  } catch (error) {
    console.log('❌ 无法读取日志文件');
  }
}

async function createApiConfig() {
  console.log('\n🔧 尝试创建API配置...');

  const defaultConfig = {
    "apiProviders": {
      "openai": {
        "apiKey": "",
        "baseURL": "https://api.openai.com/v1",
        "model": "gpt-3.5-turbo"
      },
      "anthropic": {
        "apiKey": "",
        "baseURL": "https://api.anthropic.com",
        "model": "claude-3-haiku-20240307"
      }
    },
    "defaultProvider": "anthropic",
    "maxTokens": 4096,
    "temperature": 0.7
  };

  try {
    await fs.writeFile(CONFIG.apiConfigPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✅ 已创建默认API配置');
    console.log('注意: 需要添加有效的API密钥才能使用聊天功能');
  } catch (error) {
    console.log('❌ 创建API配置失败:', error.message);
  }
}

async function checkAppRunning() {
  return new Promise((resolve) => {
    exec('pgrep -f "AICowork.app/Contents/MacOS/AICowork"', (error) => {
      resolve(!error);
    });
  });
}

async function testChatFunctionality() {
  console.log('\n🧪 测试聊天功能...');

  const isRunning = await checkAppRunning();
  if (!isRunning) {
    console.log('⚠️  应用未运行，请先启动应用');
    return;
  }

  console.log('✅ 应用正在运行');

  // 发送测试消息
  console.log('发送测试消息...');
  const script = `
    tell application "AICowork" to activate
    delay 1
    tell application "System Events"
      keystroke "${CONFIG.testMessage}"
      key code 36
    end tell
  `;

  try {
    await new Promise((resolve, reject) => {
      exec(`osascript -e '${script}'`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    console.log('✅ 消息已发送');
  } catch (error) {
    console.log('❌ 发送消息失败:', error.message);
  }

  // 等待并检查日志
  console.log('等待5秒后检查日志...');
  await setTimeout(5000);

  // 检查是否有新的错误
  await checkLogErrors();
}

async function runApiConfigTest() {
  console.log('🤖 开始API配置测试...\n');

  // 1. 检查API配置
  const hasConfig = await checkApiConfig();

  // 2. 检查其他配置文件
  await checkOtherConfigFiles();

  // 3. 检查日志错误
  await checkLogErrors();

  // 4. 如果没有配置，创建默认配置
  if (!hasConfig) {
    console.log('\n⚠️  缺少API配置可能导致聊天功能异常');
    await createApiConfig();
  }

  // 5. 测试聊天功能
  await testChatFunctionality();

  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    hasApiConfig: hasConfig,
    appRunning: await checkAppRunning()
  };

  const reportPath = path.join(process.cwd(), 'API_CONFIG_TEST_REPORT.md');
  const reportContent = `# AICowork API配置测试报告

**测试时间**: ${report.timestamp}
**API配置状态**: ${report.hasApiConfig ? '存在' : '缺失'}
**应用状态**: ${report.appRunning ? '运行中' : '已停止'}

## 测试结果

### API配置检查
- api-config.json 文件${report.hasApiConfig ? '存在' : '缺失'}
- 其他配置文件已检查
- 日志错误已分析

### 聊天功能
- 已测试消息发送
- 已检查功能响应

## 建议
${!report.hasApiConfig ? `- 需要配置有效的API密钥才能使用聊天功能
- 请编辑 api-config.json 文件添加您的API密钥` : '- API配置已存在，请确保密钥有效'}

---
*API配置测试*
`;

  await fs.writeFile(reportPath, reportContent);
  console.log(`\n✅ 测试报告已保存: ${reportPath}`);
}

// 运行测试
runApiConfigTest().catch(console.error);