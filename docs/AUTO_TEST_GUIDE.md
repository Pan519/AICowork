# AICowork 自动化测试指南

## 功能概述

这个自动化工具可以：
- 🚀 自动打开 AICowork 应用
- 💬 自动输入预设的测试消息
- 📊 实时监控应用日志
- 🔧 检测到错误时自动尝试修复
- 📋 生成详细的测试报告

## 使用方法

### 方法1：使用 npm 脚本（推荐）

```bash
# 自动模式（一键运行）
npm run auto:test

# 交互式模式
npm run auto:test:interactive

# 仅监控模式（不发送消息）
npm run auto:test:monitor
```

### 方法2：使用 shell 脚本

```bash
# 一键运行自动化测试
./scripts/run-auto-test.sh
```

### 方法3：直接运行 Node.js 脚本

```bash
# 自动模式
node scripts/auto-cowork.js --auto

# 交互式模式
node scripts/auto-cowork.js

# 仅监控日志
node scripts/auto-cowork.js --monitor

# 查看帮助
node scripts/auto-cowork.js --help
```

## 功能详解

### 1. 自动启动应用
- 检查应用是否存在
- 如果已在运行，会自动重启
- 等待应用完全启动

### 2. 日志监控
- 实时监控 `~/Library/Logs/AICowork/` 目录下的日志文件
- 自动检测错误关键词
- 记录所有错误和修复操作

### 3. 自动修复策略

当检测到错误时，会尝试以下修复方法：

#### 数据库错误
- 备份数据库文件
- 重置数据库连接

#### 网络错误
- 检查网络连接
- 测试网络可达性

#### 权限错误
- 修复应用文件权限
- 修复日志目录权限

#### 模块错误
- 重新安装 npm 依赖

#### 通用修复
- 重启应用

### 4. 测试消息

默认测试消息：
1. "请检查系统状态"
2. "报告所有错误"
3. "尝试自动修复发现的问题"

## 自定义配置

### 修改测试消息

在交互式模式下，可以输入自定义的测试消息。

或者修改脚本中的 `CONFIG.testMessages` 数组：

```javascript
const CONFIG = {
  testMessages: [
    "你的自定义消息1",
    "你的自定义消息2",
    // ...
  ]
};
```

### 修改检查间隔

```javascript
const CONFIG = {
  checkInterval: 5000, // 5秒检查一次
  maxRetries: 5        // 最大重试次数
};
```

## 输出文件

测试完成后会生成以下文件：

1. **TEST_REPORT.md** - 详细的测试报告
2. **~/Library/Logs/AICowork/backup-*/** - 日志备份目录

## 常见问题

### Q: 应用无法启动？
A: 请确保已正确打包应用：
```bash
npm run dist:mac-arm64
```

### Q: 权限错误？
A: 给脚本添加执行权限：
```bash
chmod +x scripts/auto-cowork.js
chmod +x scripts/run-auto-test.sh
```

### Q: AppleScript 无法控制系统？
A: 需要在系统偏好设置中授权：
1. 打开 "系统偏好设置" → "安全性与隐私" → "隐私"
2. 选择 "辅助功能"
3. 添加并勾选 "终端" 或你的代码编辑器

### Q: 日志文件位置？
A: 日志文件位于：
- 错误日志：`~/Library/Logs/AICowork/logs/error.log`
- 主日志：`~/Library/Logs/AICowork/main.log`

## 高级用法

### 持续集成
可以将此脚本集成到 CI/CD 流程中：

```yaml
# GitHub Actions 示例
- name: Run AICowork Auto Test
  run: npm run auto:test
```

### 定时运行
使用 cron 定时运行测试：

```bash
# 每小时运行一次测试
0 * * * * cd /path/to/project && npm run auto:test
```

## 故障排除

如果脚本遇到问题，可以：

1. 查看控制台输出中的错误信息
2. 检查 `TEST_REPORT.md` 中的详细报告
3. 手动检查日志文件
4. 使用 `--monitor` 模式仅监控日志

## 扩展功能

你可以通过修改脚本添加更多功能：

- 添加更多的错误检测模式
- 实现自定义的修复策略
- 集成通知系统（如发送邮件或消息）
- 添加性能监控
- 实现更复杂的测试场景

## 技术支持

如果遇到问题，请检查：
1. Node.js 版本（建议 v16+）
2. 应用是否正确打包
3. 系统权限设置
4. 日志文件权限

---

*最后更新：2024-01-26*