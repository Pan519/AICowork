# AICowork

> **AI 智能协作助手 - 您的全天候 AI 办公伙伴**

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-orange.svg)](https://github.com/Pan519/AICowork)
[![Electron](https://img.shields.io/badge/Electron-39.2.7-9FEAF9.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB.svg)](https://react.dev/)

[快速入门](#-快速入门) • [功能特性](#-功能特性) • [安装指南](#-安装指南) • [使用文档](#-使用文档) • [技术架构](#-技术架构)

</div>

---

## 项目简介

**AICowork** 是一款基于 Electron 开发的桌面 AI 智能协作助手，通过 Claude Agent SDK 提供强大的 AI 对话能力，帮助用户在办公、学习、创作等多个场景中提高效率。

### 核心价值

| 特性 | 说明 |
|------|------|
| **智能对话** | 基于 Claude AI 的自然语言交互 |
| **记忆系统** | 本地持久化知识库，AI 记住重要信息 |
| **技能扩展** - | 支持自定义技能和 MCP 服务器 |
| **多场景应用** | 文档写作、学习辅助、创意工作、数据分析 |
| **安全隐私** | 数据本地存储，保护用户隐私 |
| **多语言界面** | 支持中英文等多语言切换 |

### 适用场景

| 场景 | 应用示例 |
|------|----------|
| 💻 **办公协作** | 文档撰写、会议记录、邮件回复 |
| 📚 **学习辅助** | 知识问答、要点总结、概念解释 |
| 🎨 **创意工作** | 头脑风暴、创意生成、内容策划 |
| 📊 **数据分析** | 数据解读、报告生成、趋势分析 |
| 📝 **文档处理** | 翻译润色、格式调整、内容优化 |

---

## 功能特性

### 1. AI 对话系统

与 Claude AI 进行自然语言对话，支持：
- 多轮连续对话，上下文记忆
- 文档写作和润色
- 知识问答和解释
- 创意头脑风暴
- 内容翻译和改写

### 2. 记忆系统

**本地知识库，让 AI 记住重要信息**

- 保存项目信息和个人偏好
- 存储常用文档模板
- 整理知识要点和笔记
- 智能搜索和检索
- 自动保存重要对话内容

### 3. 技能系统

扩展 AI 能力的自定义技能：

- 创建和编辑自定义技能
- 技能标签分类管理
- 技能库分享和导入
- MCP 服务器集成

### 4. 斜杠命令

快捷命令，提高效率：

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空当前对话 |
| `/memory save` | 保存到记忆系统 |
| `/memory search` | 搜索记忆内容 |
| `/memory ask` | 询问记忆相关信息 |

### 5. 安全控制

- 数据本地存储
- API 密钥安全保护
- 权限精细控制
- 敏感操作确认

---

## 快速入门

### 前置要求

- **操作系统**: Windows 10+, macOS 11+, Linux
- **API Key**: 需要从 [Anthropic Console](https://console.anthropic.com) 获取

### 三步快速上手

#### 1. 获取 API Key

```
1. 访问 https://console.anthropic.com
2. 注册或登录账号
3. 点击 "API Keys" → "Create Key"
4. 复制生成的 API Key
```

#### 2. 配置应用

```
1. 打开 AICowork
2. 点击左侧栏底部的 ⚙️ 设置
3. 点击 "Claude API" 标签
4. 粘贴 API Key 到输入框
5. 点击"保存"按钮
```

#### 3. 开始对话

```
1. 点击左侧 "+ 新对话" 创建会话
2. 输入框输入您的问题或需求
3. 按 Enter 键发送
4. 等待 AI 回复
```

---

## 安装指南

### 方式一：下载安装包（推荐）

从 [Releases](https://github.com/Pan519/AICowork/releases) 下载对应平台的安装包：

| 平台 | 文件名 |
|------|--------|
| Windows | `AICowork-Setup-0.1.0.exe` |
| macOS (ARM) | `AICowork-0.1.0-arm64.dmg` |
| macOS (Intel) | `AICowork-0.1.0-x64.dmg` |
| Linux | `aicowork_0.1.0_amd64.deb` |

### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/Pan519/AICowork.git
cd AICowork

#安装pnpm
npm install -g pnpm

#安装bun
npm install -g bun

# 安装依赖
pnpm install

# 重新构建原生模块
pnpm rebuild

# 开发模式运行
pnpm dev

# 构建应用
pnpm build

# 打包应用
pnpm dist:win      # Windows
pnpm dist:mac-arm64 # macOS ARM
pnpm dist:mac-x64  # macOS Intel
pnpm dist:linux    # Linux
```



#### Electron安装修复

如果在运行时候出现报错`Electron failed to install correctly, please delete node_modules/electron and try installing again`请使用下面方案解决

_这不是你的问题，这是`pnpm`的问题~_

```bash
#安装electron-fix（解决Electron failed to install correctly）
npm install -g electron-fix

#安装electron
electron-fix start
```



---

## 使用文档

### 文档导航

| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [快速入门指南](docs/快速入门指南.md) | 5 分钟快速上手 | 新用户 |
| [完整用户手册](docs/完整用户手册.md) | 全面功能参考 | 所有用户 |
| [功能专题教程](docs/功能专题教程.md) | 深度功能讲解 | 进阶用户 |
| [快速参考卡](docs/快速参考卡_v1.0.0.md) | 常用操作速查 | 熟悉用户 |

### 核心功能使用

#### AI 对话

```
1. 点击左侧 "+ 新对话" 创建会话
2. 输入您的问题或需求
3. 按 Enter 发送
4. 与 AI 进行多轮对话
```

#### 记忆系统

```
1. 设置 → 记忆系统
2. 点击 "+ 添加新记忆"
3. 填写标题和内容
4. 保存供 AI 调用
```

#### 斜杠命令

在输入框中输入 `/` 即可查看所有可用命令。

---

## 技术架构

### 技术栈

#### 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.3 | UI 框架 |
| Tailwind CSS | 4.1.18 | 样式框架 |
| Zustand | 5.0.10 | 状态管理 |
| i18next | - | 国际化 |
| react-markdown | 10.1.0 | Markdown 渲染 |
| highlight.js | 11.11.1 | 代码高亮 |

#### 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 39.2.7 | 桌面框架 |
| better-sqlite3 | 12.6.0 | 数据库 |
| Winston | 3.19.0 | 日志系统 |
| @anthropic-ai/claude-agent-sdk | 0.2.6 | Claude SDK |
| @memvid/sdk | 2.0.120 | 记忆系统 |

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    用户界面层 (UI)                       │
│  React 19 + Tailwind CSS 4 + i18next                    │
└─────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                   预加载层 (Preload)                      │
│  contextBridge 安全 API 暴露                              │
└─────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                   主进程层 (Main)                         │
│  IPC Handlers | Session Store | AI Agent Runner         │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                   数据层 (Data)                           │
│  better-sqlite3 (WAL 模式) + Memvid                      │
└─────────────────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── electron/              # 主进程
│   ├── main.ts           # 主入口
│   ├── ipc-handlers.ts   # IPC 事件处理
│   ├── logger.ts         # 日志系统
│   └── libs/             # 核心库
│       ├── claude-settings.ts
│       ├── config-store.ts
│       ├── runner.ts
│       └── session-store.ts
│
└── ui/                    # 渲染进程
    ├── main.tsx           # React 入口
    ├── App.tsx            # 主应用组件
    ├── components/        # UI 组件
    ├── hooks/             # React Hooks
    ├── store/             # 状态管理
    ├── i18n/              # 国际化
    └── utils/             # 工具函数
```

详细架构文档请参阅 [架构设计文档](docs/02-技术文档/架构设计.md)。

---

## 配置说明

### 文件位置

```
配置文件: C:\Users\你的用户名\.aicowork\config.json
记忆数据: C:\Users\你的用户名\.aicowork\memvid\memory.mv2
日志文件: C:\Users\你的用户名\.aicowork\logs\
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| NODE_ENV | 环境模式 | development |
| PORT | Vite 开发服务器端口 | 5173 |

---

## 开发指南

### 开发环境设置

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 运行测试
pnpm test

# 代码检查
pnpm lint
```

### 项目脚本

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动开发模式 |
| `pnpm build` | 构建生产版本 |
| `pnpm lint` | 运行 ESLint |
| `pnpm test` | 运行测试 |
| `pnpm dist:win` | 打包 Windows 版本 |
| `pnpm dist:mac-arm64` | 打包 macOS ARM 版本 |
| `pnpm dist:mac-x64` | 打包 macOS Intel 版本 |
| `pnpm dist:linux` | 打包 Linux 版本 |

详细开发指南请参阅 [开发指南](docs/02-技术文档/开发指南.md)。

---

## 常见问题

### API Key 未配置

**问题**: 提示"API Key 未配置"

**解决**: 设置 → Claude API → 粘贴 API Key → 保存

### 发送消息无响应

**问题**: 发送消息没有反应

**解决**: 检查网络连接，确认 API Key 正确配置

### 如何删除历史对话

**问题**: 如何删除历史对话

**解决**: 点击对话卡片上的删除按钮

### 如何使用记忆系统

**问题**: 记忆系统如何使用

**解决**: 设置 → 记忆系统 → 添加新记忆，AI 会自动调用记忆内容

---

## 项目状态

**扫码加入社区：**

<div align="center">

> 二维码已过期，请点击链接获取最新的群二维码

[**🔗 点击获取微信群二维码**](https://ima.qq.com/note/share/_AwZPbuK9wucK5gWaVdjNQ?channel=4)

- 💻 **开发者群** - 程序员进开发者群（非程序员勿进）
- 👥 **交流群** - 普通用户进交流群

</div>

### 当前版本

- **版本号**: 0.1.0
- **发布日期**: 2026-01-22
- **状态**: 活跃开发中

### 开发进度

- [x] AI 对话功能
- [x] 记忆系统
- [x] 技能系统
- [x] 斜杠命令
- [x] 权限管理
- [x] 多语言支持
- [ ] 插件市场
- [ ] 云端同步
- [ ] 移动端适配

---

## 贡献指南

我们欢迎任何形式的贡献！

### 如何贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: 添加某个功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 遵循 ESLint 配置
- 使用 TypeScript 类型注解
- 编写单元测试
- 更新相关文档

---

## 路线图

### v0.2.0 (计划中)

- [ ] 技能市场功能
- [ ] 更多 AI 模型支持
- [ ] 对话导出功能

### v0.3.0 (规划中)

- [ ] 云端同步
- [ ] 团队协作功能
- [ ] 移动端适配

---

## 许可证

本项目采用 **MIT** 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 致谢

- [Anthropic](https://www.anthropic.com/) - Claude AI
- [Electron](https://www.electronjs.org/) - 桌面应用框架
- [React](https://react.dev/) - UI 框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Memvid](https://memvid.ai/) - 记忆系统 SDK

---

## 联系方式

- **作者**: Alan
- **项目地址**: [https://github.com/Pan519/AICowork](https://github.com/Pan519/AICowork)
- **问题反馈**: [Issues](https://github.com/Pan519/AICowork/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️ Star！**

Made with ❤️ by Alan

</div>
