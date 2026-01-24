/**
 * 窗口管理器
 * 负责创建和配置应用主窗口
 */

import { BrowserWindow, globalShortcut } from "electron";
import { isDev, DEV_PORT } from "../util.js";
import { getPreloadPath, getUIPath, getIconPath } from "../pathResolver.js";
import { cleanup } from "./lifecycle.js";

let mainWindow: BrowserWindow | null = null;

/**
 * 获取主窗口实例
 */
export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}

/**
 * 创建主窗口
 */
export function createMainWindow(): BrowserWindow {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: getPreloadPath(),
            // 安全配置
            contextIsolation: true,     // 启用上下文隔离
            sandbox: true,               // 启用沙箱模式
            nodeIntegration: false,      // 禁用 node 集成
            nodeIntegrationInWorker: false,
            webSecurity: true,           // 启用 web 安全
            allowRunningInsecureContent: false,
            // 开发者工具仅在生产环境禁用
            devTools: isDev(),
        },
        icon: getIconPath(),
        titleBarStyle: "hiddenInset",
        backgroundColor: "#FAF9F6",
        trafficLightPosition: { x: 15, y: 18 }
    });

    // 加载页面
    if (isDev()) {
        mainWindow.loadURL(`http://localhost:${DEV_PORT}`);
    } else {
        mainWindow.loadFile(getUIPath());
    }

    // 开发模式下自动打开开发者工具
    if (isDev() || process.env.OPEN_DEVTOOLS === '1') {
        mainWindow.webContents.openDevTools({ mode: 'bottom' });
    }

    // 设置 CSP 安全头
    setupSecurityHeaders();

    // 设置快捷键
    setupShortcuts();

    // 设置上下文菜单
    setupContextMenu();

    return mainWindow;
}

/**
 * 设置 CSP 安全头
 */
function setupSecurityHeaders(): void {
    if (!mainWindow) return;

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        // CSP 策略：移除 unsafe-inline 和 unsafe-eval（安全性提升）
        // 注意：由于启用 sandbox，需要使用 nonce 或 hash 来允许内联脚本
        const csp = isDev()
            ? "default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; style-src 'self' 'unsafe-inline' http://localhost:*; img-src 'self' data: https: http://localhost:*; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* https://api.anthropic.com https://*.anthropic.com;"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://*.anthropic.com;";

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp]
            }
        });
    });
}

/**
 * 设置全局快捷键
 * 包括开发者工具快捷键，确保在生产环境也能方便调试
 */
function setupShortcuts(): void {
    // Cmd/Ctrl+Q 退出应用
    globalShortcut.register('CommandOrControl+Q', () => {
        cleanup();
        // 需要动态导入 app 来避免循环依赖
        import("electron").then(({ app }) => {
            app.quit();
        });
    });

    // F12 打开开发者工具（标准快捷键）
    globalShortcut.register('F12', () => {
        mainWindow?.webContents.openDevTools();
    });

    // Cmd/Ctrl+Shift+I 打开开发者工具（Chrome风格）
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        mainWindow?.webContents.openDevTools();
    });

    // Cmd/Ctrl+Shift+D 切换开发者工具（快速开关）
    globalShortcut.register('CommandOrControl+Shift+D', () => {
        if (!mainWindow) return;
        const contents = mainWindow.webContents;
        if (contents.isDevToolsOpened()) {
            contents.closeDevTools();
        } else {
            contents.openDevTools({ mode: 'bottom' });
        }
    });

    // Cmd/Ctrl+Option+I (Mac) 或 Cmd/Ctrl+Alt+I (Windows/Linux) 打开开发者工具
    globalShortcut.register('CommandOrControl+Alt+I', () => {
        mainWindow?.webContents.openDevTools();
    });

    // Cmd/Ctrl+Shift+C 打开控制台（直接聚焦控制台）
    globalShortcut.register('CommandOrControl+Shift+C', () => {
        if (!mainWindow) return;
        const contents = mainWindow.webContents;
        if (!contents.isDevToolsOpened()) {
            contents.openDevTools({ mode: 'bottom' });
        }
        // 聚焦到控制台（需要在开发者工具打开后执行）
        contents.executeJavaScript('if (window.__focusConsole) window.__focusConsole()');
    });

    // F5 刷新页面（开发模式下重新加载）
    globalShortcut.register('F5', () => {
        if (isDev() && mainWindow) {
            mainWindow.reload();
        }
    });

    // Cmd/Ctrl+R 刷新页面（开发模式下重新加载）
    globalShortcut.register('CommandOrControl+R', () => {
        if (isDev() && mainWindow) {
            mainWindow.reload();
        }
    });

    // Cmd/Ctrl+Shift+R 强制刷新（清除缓存）
    globalShortcut.register('CommandOrControl+Shift+R', () => {
        if (isDev() && mainWindow) {
            mainWindow.webContents.reloadIgnoringCache();
        }
    });

    // 记录快捷键注册日志（仅在开发模式）
    if (isDev()) {
        console.log('[Shortcuts] Registered shortcuts:');
        console.log('  F12: Open DevTools');
        console.log('  Cmd/Ctrl+Shift+I: Open DevTools');
        console.log('  Cmd/Ctrl+Shift+D: Toggle DevTools');
        console.log('  Cmd/Ctrl+Alt+I: Open DevTools');
        console.log('  Cmd/Ctrl+Shift+C: Open Console');
        console.log('  F5: Reload (dev only)');
        console.log('  Cmd/Ctrl+R: Reload (dev only)');
        console.log('  Cmd/Ctrl+Shift+R: Hard Reload (dev only)');
    }
}

/**
 * 设置右键菜单（检查元素）
 */
function setupContextMenu(): void {
    if (!mainWindow) return;

    mainWindow.webContents.on('context-menu', (_event, params) => {
        mainWindow?.webContents.inspectElement(params.x, params.y);
        if (!mainWindow?.webContents.isDevToolsOpened()) {
            mainWindow?.webContents.openDevTools({ mode: 'bottom' });
        }
    });
}
