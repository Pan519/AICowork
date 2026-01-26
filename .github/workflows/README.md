# GitHub Actions 工作流

本项目使用 GitHub Actions 进行自动化构建、测试和发布。

## 工作流说明

### 1. CI 工作流 (`ci.yml`)

在每次 `push` 和 `pull request` 时自动运行，用于验证代码质量：

- ✅ 运行 ESLint 检查
- ✅ 运行 TypeScript 类型检查
- ✅ 运行单元测试
- ✅ 验证构建流程（所有平台）

**触发条件：**
- 推送到 `main`、`master`、`develop` 分支
- 向这些分支的拉取请求

### 2. 构建和发布工作流 (`build.yml`)

在打标签时自动运行，用于构建和发布应用：

- 📦 构建 macOS (ARM64 + Intel)
- 📦 构建 Windows (x64)
- 📦 构建 Linux (x64)
- 🚀 自动创建 GitHub Release

**触发条件：**
- 推送以 `v` 开头的标签（如 `v1.0.0`）

## 使用方法

### 本地测试

在推送代码前，可以本地运行：

```bash
# 检查代码质量
pnpm run lint

# 类型检查
pnpm run transpile:electron

# 运行测试
pnpm test

# 本地构建（测试）
pnpm run build
```

### 发布新版本

1. **更新版本号**
   ```bash
   # 编辑 package.json
   vim package.json
   ```

2. **创建发布标签**
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

3. **GitHub Actions 将自动：**
   - 检测到新标签 `v*`
   - 运行构建流程
   - 上传构建产物到 GitHub Releases
   - 生成发布说明

## 代码签名配置（可选）

### macOS 代码签名

在 GitHub 仓库设置中添加以下 Secrets：

- `CSC_NAME`: 证书名称
- `CSC_KEY_PASSWORD`: 证书密码
- `CSC_LINK`: 证书文件 (.p12 或 .cer)
- `CSC_KEYCHAIN`: Keychain 名称
- `CSC_KEYCHAIN_PASSWORD`: Keychain 密码

### Windows 代码签名

在 GitHub 仓库设置中添加以下 Secrets：

- `WIN_CSC_LINK`: 代码签名证书文件
- `WIN_CSC_KEY_PASSWORD`: 证书密码

### 启用自动发布

1. 在 GitHub 仓库设置 → Actions → General → Workflow permissions
2. 选择 "Read and write permissions"
3. 勾选 "Allow GitHub Actions to create and approve pull requests"

## 构建产物

每次发布后，将在 GitHub Releases 中找到：

### macOS
- `.dmg` 文件（macOS 应用安装包）
- `.zip` 文件（压缩包）

### Windows
- `.exe` 文件（Windows 安装程序）
- `.zip` 文件（压缩包）

### Linux
- `.AppImage` 文件（Linux 应用包）
- `.deb` 文件（Debian/Ubuntu 安装包）
- `.rpm` 文件（RedHat/CentOS/Fedora 安装包）

## 故障排除

### 构建失败

1. **检查依赖安装**
   ```bash
   pnpm install
   ```

2. **检查 Node.js 版本**
   ```bash
   node --version  # 应为 v20.x.x
   ```

3. **本地运行构建**
   ```bash
   pnpm run transpile:electron
   pnpm run vite:build
   ```

### 签名失败

如果 macOS 签名失败：

1. 检查 GitHub Secrets 配置
2. 确认证书有效期
3. 检查证书权限

### 上传失败

如果 GitHub Releases 上传失败：

1. 检查 `GITHUB_TOKEN` 权限
2. 确认 Workflow permissions 设置
3. 检查标签格式（必须以 `v` 开头）

## 自定义构建

### 修改构建配置

编辑 `.github/workflows/build.yml` 文件：

```yaml
strategy:
  matrix:
    include:
      # 添加新平台
      - os: ubuntu-22.04
        arch: x64
        platform: linux
        # ...
```

### 修改构建脚本

编辑 `package.json` 中的脚本：

```json
{
  "scripts": {
    "dist:custom": "npm run build && electron-builder"
  }
}
```

然后在工作流中使用：

```yaml
- name: Build distributable
  run: npm run dist:custom
```

## 最佳实践

1. **使用语义化版本**
   - 遵循 `v主版本.次版本.修订版本` 格式
   - 例如：`v1.2.3`

2. **编写清晰的发布说明**
   - 在 GitHub Releases 中手动编辑说明
   - 描述新功能、修复和变更

3. **测试标签发布前**
   - 先在本地测试构建
   - 使用预发布版本测试

4. **保持 Actions 最新**
   - 定期更新 `actions/checkout@v4`
   - 定期更新 `actions/setup-node@v4`

## 参考

- [Electron Builder 文档](https://www.electron.build/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [代码签名指南](https://www.electron.build/code-signing)
