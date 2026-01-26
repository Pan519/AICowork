# AICowork 构建指南

本文档介绍如何构建和发布 AICowork 应用。

## 目录结构

```
.
├── .github/workflows/       # GitHub Actions 工作流
│   ├── ci.yml             # 持续集成工作流
│   ├── build.yml           # 构建和发布工作流
│   └── README.md          # 工作流说明
├── scripts/                # 构建脚本
│   ├── build-all-platforms.sh  # 全平台构建脚本
│   ├── download-vendor-deps.js # 下载 vendor 依赖
│   ├── fix-vendor-executables.js # 修复可执行文件
│   └── run-auto-test.sh   # 自动化测试
├── src/                   # 源代码
├── electron-builder.json   # Electron Builder 配置
└── package.json          # 项目配置
```

## 快速开始

### 1. 环境要求

- Node.js >= 20.x
- npm >= 9.x
- Git

### 2. 安装依赖

```bash
npm ci
```

### 3. 下载 vendor 依赖

```bash
node scripts/download-vendor-deps.js
```

### 4. 构建应用

#### 方式一：使用便捷脚本

```bash
# 全平台构建（自动检测平台）
./scripts/build-all-platforms.sh

# 或者指定平台
./scripts/build-all-platforms.sh mac-arm64  # macOS ARM64
./scripts/build-all-platforms.sh mac-x64    # macOS Intel
./scripts/build-all-platforms.sh win        # Windows
./scripts/build-all-platforms.sh linux       # Linux
```

#### 方式二：使用 npm 脚本

```bash
# macOS ARM64
npm run dist:mac-arm64

# macOS Intel
npm run dist:mac-x64

# Windows
npm run dist:win

# Linux
npm run dist:linux

# 所有平台（需要手动切换平台）
npm run dist
```

### 5. 查看构建产物

构建完成后，产物位于 `dist/` 目录：

- **macOS**:
  - `AICowork-VERSION-arm64.dmg` - ARM64 安装包
  - `AICowork-VERSION-x64.dmg` - Intel 安装包
  - `AICowork-VERSION-arm64.zip` - ARM64 压缩包
  - `AICowork-VERSION-x64.zip` - Intel 压缩包

- **Windows**:
  - `AICowork Setup VERSION.exe` - NSIS 安装程序
  - `AICowork VERSION.zip` - 压缩包

- **Linux**:
  - `AICowork-VERSION.AppImage` - AppImage 应用包
  - `AICowork-VERSION.x86_64.deb` - Debian/Ubuntu 包
  - `AICowork-VERSION.x86_64.rpm` - RedHat/CentOS/Fedora 包

## GitHub Actions 自动构建

### CI 工作流 (ci.yml)

在每次 `push` 和 `pull request` 时自动运行：

- ✅ 代码检查 (ESLint)
- ✅ 类型检查 (TypeScript)
- ✅ 单元测试
- ✅ 构建验证（所有平台）

### 构建和发布工作流 (build.yml)

在打标签时自动运行：

- 📦 构建所有平台的应用
- 🚀 自动创建 GitHub Release
- 📁 上传构建产物

#### 发布新版本

1. 更新版本号：
   ```bash
   # 编辑 package.json
   vim package.json
   ```

2. 提交并打标签：
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

3. GitHub Actions 将自动：
   - 检测到新标签 `v*`
   - 运行构建流程
   - 上传产物到 Releases
   - 生成发布说明

## 本地测试

### 运行自动化测试

```bash
bash scripts/run-auto-test.sh
```

### 运行单元测试

```bash
npm test
```

### 调试开发模式

```bash
npm run dev
```

## 故障排除

### 构建失败

**检查清单：**

1. Node.js 版本
   ```bash
   node --version  # 应为 v20.x.x
   ```

2. 依赖安装
   ```bash
   npm ci
   ```

3. vendor 依赖
   ```bash
   node scripts/download-vendor-deps.js
   ```

4. 本地构建测试
   ```bash
   npm run transpile:electron
   npm run vite:build
   ```

### 签名问题

**macOS 代码签名：**

1. 配置 GitHub Secrets：
   - `CSC_NAME`
   - `CSC_KEY_PASSWORD`
   - `CSC_LINK`

2. 在 `electron-builder.json` 中启用签名：
   ```json
   "mac": {
     "identity": "Developer ID Application: Your Name (TEAMID)"
   }
   ```

**Windows 代码签名：**

1. 配置 GitHub Secrets：
   - `WIN_CSC_LINK`
   - `WIN_CSC_KEY_PASSWORD`

### 性能优化

**减少构建时间：**

1. 使用缓存：
   ```yaml
   # .github/workflows/build.yml
   - uses: actions/setup-node@v4
     with:
       cache: 'npm'
   ```

2. 并行构建：
   ```yaml
   strategy:
     matrix:
       include:
         - os: macos-14
         - os: windows-latest
         - os: ubuntu-latest
   ```

3. 增量构建：
   ```bash
   # 只构建变化的平台
   if [ "$GITHUB_EVENT_NAME" = "push" ]; then
     npm run dist:${{ matrix.platform }}
   fi
   ```

## 最佳实践

### 1. 版本管理

- 使用语义化版本：`v主版本.次版本.修订版本`
- 示例：`v1.2.3`

### 2. 分支策略

- `main`: 主分支，稳定的发布版本
- `develop`: 开发分支，集成分支
- `feature/*`: 功能分支
- `release/*`: 发布分支

### 3. 构建产物管理

- 在 GitHub Releases 中保留最新版本
- 旧版本可下载但标记为过时
- 定期清理构建缓存

### 4. 自动化测试

- 在发布前运行完整测试套件
- 使用 `npm test` 运行所有测试
- 使用 `npm run lint` 检查代码质量

## 参考链接

- [Electron Builder 文档](https://www.electron.build/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [代码签名指南](https://www.electron.build/code-signing)

## 常见问题

**Q: 构建失败，提示 "Cannot find module"**
A: 确保运行了 `npm ci` 安装所有依赖

**Q: macOS 构建失败，提示 "codesign failed"**
A: 检查代码签名配置或禁用签名（开发模式）

**Q: Windows 构建失败，提示 "signtool not found"**
A: 配置代码签名证书或禁用签名（开发模式）

**Q: 构建时间太长**
A: 检查网络连接，考虑使用构建缓存

**Q: GitHub Actions 构建失败**
A: 检查 Actions 日志，确认平台兼容性

## 许可证

本项目使用 MIT 许可证。详情请参阅 LICENSE 文件。
