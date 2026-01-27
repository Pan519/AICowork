#!/bin/bash

# AICowork 自动化测试一键运行脚本

echo "🤖 启动 AICowork 自动化测试..."
echo "================================"

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js"
    exit 1
fi

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 检查应用是否存在
APP_PATH="$PROJECT_DIR/dist/mac-arm64/AICowork.app"
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 未找到 AICowork 应用，请先打包："
    echo "   npm run dist:mac-arm64"
    exit 1
fi

# 运行自动化脚本
echo "📍 项目目录: $PROJECT_DIR"
echo "📱 应用路径: $APP_PATH"
echo ""

# 进入项目目录
cd "$PROJECT_DIR"

# 运行自动化测试
echo "🚀 开始自动化测试..."
node scripts/auto-cowork.js --auto

echo ""
echo "✅ 自动化测试完成！"
echo "📋 查看测试报告: TEST_REPORT.md"