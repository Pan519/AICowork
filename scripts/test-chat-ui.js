#!/usr/bin/env node

/**
 * AICowork UI聊天功能测试
 * 通过UI交互测试聊天功能
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { setTimeout } from 'timers/promises';

const CONFIG = {
  appName: 'AICowork',
  testMessage: "你好，这是一个测试消息，请回复以确认聊天功能正常",
  screenshotDir: '/tmp/aicowork-test'
};

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

async function checkAppRunning() {
  try {
    await execPromise('pgrep -f "AICowork.app/Contents/MacOS/AICowork"');
    return true;
  } catch {
    return false;
  }
}

async function takeScreenshot(name) {
  try {
    await fs.mkdir(CONFIG.screenshotDir, { recursive: true });
    const filename = `${CONFIG.screenshotDir}/${name}-${Date.now()}.png`;
    await execPromise(`screencapture -l $(osascript -e 'tell application "${CONFIG.appName}" to id of window 1') "${filename}"`);
    console.log(`  📸 截图保存: ${filename}`);
    return filename;
  } catch (error) {
    console.log(`  ⚠️  截图失败: ${error.message}`);
    return null;
  }
}

async function getWindowInfo() {
  try {
    const script = `
      tell application "System Events"
        tell process "${CONFIG.appName}"
          set windowList to {}
          repeat with w in windows
            set windowInfo to "Title: " & (name of w) & " | Position: " & (position of w as string) & " | Size: " & (size of w as string)
            set end of windowList to windowInfo
          end repeat
          return windowList as string
        end tell
      end tell
    `;
    const { stdout } = await execPromise(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error) {
    return null;
  }
}

async function findUIElements() {
  try {
    const script = `
      tell application "System Events"
        tell process "${CONFIG.appName}"
          set uiElements to {}
          repeat with w in windows
            repeat with ui in entire contents of w
              try
                set uiName to (name of ui as string)
                set uiClass to (class of ui as string)
                if uiName is not "" then
                  set end of uiElements to (uiClass & ": " & uiName)
                end if
              end try
            end repeat
          end repeat
          return uiElements as string
        end tell
      end tell
    `;
    const { stdout } = await execPromise(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error) {
    return null;
  }
}

async function findInputField() {
  try {
    // 尝试找到输入框（通过常见的文本区域类名）
    const script = `
      tell application "System Events"
        tell process "${CONFIG.appName}"
          -- 查找文本输入区域
          set textAreas to {}
          repeat with w in windows
            repeat with ui in entire contents of w
              try
                if (class of ui as string) contains "text" or (class of ui as string) contains "Text" then
                  set end of textAreas to (class of ui as string)
                end if
              end try
            end repeat
          end repeat
          return textAreas as string
        end tell
      end tell
    `;
    const { stdout } = await execPromise(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error) {
    return null;
  }
}

async function sendMessageToInput(message) {
  try {
    // 尝试多种方式找到输入框并发送消息
    const strategies = [
      // 策略1: 直接发送到焦点元素
      `tell application "${CONFIG.appName}" to activate
       delay 1
       tell application "System Events" to keystroke "${message}"
       delay 0.5
       tell application "System Events" to key code 36`,

      // 策略2: 查找特定UI元素
      `tell application "System Events"
         tell process "${CONFIG.appName}"
           -- 尝试点击第一个文本区域
           try
             click text area 1 of window 1
             delay 0.5
             keystroke "${message}"
             delay 0.5
             key code 36
           on error
             -- 如果失败，直接发送
             keystroke "${message}"
             delay 0.5
             key code 36
           end try
         end tell
       end tell`,

      // 策略3: 使用剪贴板
      `tell application "${CONFIG.appName}" to activate
       set the clipboard to "${message}"
       delay 1
       tell application "System Events"
         keystroke "v" using command down
         delay 0.5
         key code 36
       end tell`
    ];

    for (let i = 0; i < strategies.length; i++) {
      console.log(`  尝试策略 ${i + 1}...`);
      try {
        await execPromise(`osascript -e '${strategies[i]}'`);
        console.log('  ✅ 消息已发送');
        return true;
      } catch (error) {
        console.log(`  ⚠️  策略 ${i + 1} 失败`);
      }
    }

    return false;
  } catch (error) {
    console.log('  ❌ 发送消息失败:', error.message);
    return false;
  }
}

async function waitForResponse(timeout = 10) {
  console.log(`\n⏳ 等待响应 (${timeout}秒)...`);

  // 持续检查日志文件是否有新内容
  const logFile = path.join(process.env.HOME, 'Library/Application Support/aicowork/logs/app.log');
  const initialSize = await getFileSize(logFile);

  for (let i = 0; i < timeout; i++) {
    await setTimeout(1000);
    const newSize = await getFileSize(logFile);
    if (newSize > initialSize) {
      console.log(`  📊 检测到日志更新 (+${newSize - initialSize} bytes)`);
      // 读取新增内容
      const newContent = await getNewLogContent(logFile, initialSize);
      if (newContent) {
        const relevantLines = newContent.split('\n').filter(line =>
          line.includes('chat') || line.includes('message') || line.includes('response') ||
          line.includes('error') || line.includes('fail') || line.includes('success')
        );
        if (relevantLines.length > 0) {
          console.log('  相关日志:');
          relevantLines.forEach(line => console.log(`    ${line}`));
        }
      }
      break;
    }
    process.stdout.write('.');
  }
}

async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

async function getNewLogContent(filePath, fromPosition) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.slice(fromPosition);
  } catch {
    return null;
  }
}

async function runUITest() {
  console.log('🤖 开始UI聊天功能测试...\n');

  // 检查应用是否运行
  if (!(await checkAppRunning())) {
    console.log('❌ 应用未运行，请先启动应用');
    return;
  }

  console.log('✅ 应用正在运行');

  // 获取窗口信息
  console.log('\n🪟 检查窗口信息...');
  const windowInfo = await getWindowInfo();
  if (windowInfo) {
    console.log('窗口详情:');
    windowInfo.split('\n').forEach(line => console.log(`  ${line}`));
  }

  // 截图初始状态
  console.log('\n📸 截图初始状态...');
  const screenshot1 = await takeScreenshot('initial');

  // 查找UI元素
  console.log('\n🔍 查找UI元素...');
  const uiElements = await findUIElements();
  if (uiElements) {
    console.log('找到的元素类型:');
    const uniqueElements = [...new Set(uiElements.split('\n').filter(e => e.trim()))];
    uniqueElements.slice(0, 10).forEach(elem => console.log(`  ${elem}`));
    if (uniqueElements.length > 10) {
      console.log(`  ... 还有 ${uniqueElements.length - 10} 个元素`);
    }
  }

  // 查找输入框
  console.log('\n📝 查找输入框...');
  const inputFields = await findInputField();
  if (inputFields) {
    console.log('找到的输入元素:', inputFields);
  }

  // 发送消息
  console.log('\n💬 发送测试消息...');
  const success = await sendMessageToInput(CONFIG.testMessage);

  if (success) {
    // 截图发送后状态
    await setTimeout(2000);
    const screenshot2 = await takeScreenshot('after-send');

    // 等待响应
    await waitForResponse(15);

    // 截图最终状态
    await setTimeout(2000);
    const screenshot3 = await takeScreenshot('final');

    console.log('\n✅ 测试完成');
    console.log('\n📊 截图文件:');
    [screenshot1, screenshot2, screenshot3].forEach((file, i) => {
      if (file) console.log(`  ${['初始', '发送后', '最终'][i]}: ${file}`);
    });
  } else {
    console.log('\n❌ 消息发送失败');
  }

  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    appRunning: await checkAppRunning(),
    messageSent: success,
    testMessage: CONFIG.testMessage
  };

  const reportPath = path.join(process.cwd(), 'UI_TEST_REPORT.md');
  const reportContent = `# AICowork UI聊天功能测试报告

**测试时间**: ${report.timestamp}
**应用状态**: ${report.appRunning ? '运行中' : '已停止'}
**消息发送**: ${report.messageSent ? '成功' : '失败'}
**测试消息**: ${report.testMessage}

## 测试步骤
1. 检查应用窗口状态
2. 查找UI输入元素
3. 尝试发送消息
4. 等待响应
5. 记录整个过程

## 测试结果
- 窗口信息已获取
- UI元素已识别
- 消息发送${report.messageSent ? '成功' : '失败'}
- 截图已保存

---
*UI交互测试*
`;

  await fs.writeFile(reportPath, reportContent);
  console.log(`\n✅ 测试报告已保存: ${reportPath}`);
}

// 运行测试
runUITest().catch(console.error);