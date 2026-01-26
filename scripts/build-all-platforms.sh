#!/bin/bash

# AICowork 全平台构建脚本
# 用于本地构建所有平台的应用包

set -e

echo "🚀 AICowork 全平台构建脚本"
echo "================================"
echo ""

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js (https://nodejs.org/)"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 版本: $NODE_VERSION"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 请先安装 npm"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm ci
echo ""

# 下载 vendor 依赖
echo "⬇️  下载 vendor 依赖..."
node scripts/download-vendor-deps.js
echo ""

# 修复 vendor 可执行文件（macOS）
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔧 修复 vendor 可执行文件..."
    node scripts/fix-vendor-executables.js
    echo ""
fi

# 构建函数
build_platform() {
    local platform=$1
    echo "🏗️  构建 $platform 应用..."

    case $platform in
        "mac-arm64")
            npm run dist:mac-arm64
            echo "✅ macOS ARM64 构建完成"
            ;;

        "mac-x64")
            npm run dist:mac-x64
            echo "✅ macOS Intel 构建完成"
            ;;

        "win")
            npm run dist:win
            echo "✅ Windows 构建完成"
            ;;

        "linux")
            npm run dist:linux
            echo "✅ Linux 构建完成"
            ;;

        *)
            echo "❌ 未知平台: $platform"
            exit 1
            ;;
    esac

    echo ""
}

# 主构建逻辑
PLATFORM=$(uname -s)
ARCH=$(uname -m)

echo "🖥️  检测到平台: $PLATFORM $ARCH"
echo ""

# 根据平台选择默认构建
case $PLATFORM in
    "Darwin")
        if [[ "$ARCH" == "arm64" ]]; then
            echo "📌 检测到 macOS ARM64，使用 'npm run dist:mac-arm64' 进行构建"
            build_platform "mac-arm64"
        else
            echo "📌 检测到 macOS Intel，使用 'npm run dist:mac-x64' 进行构建"
            build_platform "mac-x64"
        fi
        ;;

    "Linux")
        echo "📌 检测到 Linux，使用 'npm run dist:linux' 进行构建"
        build_platform "linux"
        ;;

    "CYGWIN"*|"MINGW"*|"MSYS"*)
        echo "📌 检测到 Windows，使用 'npm run dist:win' 进行构建"
        build_platform "win"
        ;;

    *)
        echo "❌ 不支持的平台: $PLATFORM"
        echo "支持的平台: macOS, Linux, Windows"
        exit 1
        ;;
esac

# 显示构建产物
echo "📋 构建产物列表:"
echo "================================"
if [ -d "dist" ]; then
    ls -lh dist/
    echo ""
    echo "✅ 所有构建完成！"
    echo ""
    echo "📍 构建产物位于: ./dist/"
    echo ""
    echo "🚀 使用说明:"
    echo "  - macOS: 安装 .dmg 文件或解压 .zip 文件"
    echo "  - Windows: 运行 .exe 安装程序或使用便携版"
    echo "  - Linux: 运行 .AppImage 或安装 .deb/.rpm 包"
else
    echo "❌ 未找到 dist 目录"
    exit 1
fi
