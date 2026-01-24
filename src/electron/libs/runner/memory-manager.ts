/**
 * 记忆管理模块
 * @author Alan
 * @copyright AGCPA v3.0
 * @created 2025-01-24
 *
 * 模块职责：
 * ---------
 * 本模块只负责记忆功能的配置管理，不直接参与记忆的存储和检索。
 * 具体的记忆功能（如 memory_search、memory_store、memory_ask）由 SDK
 * 通过 Memory MCP 服务器自动处理。
 *
 * 设计理念：
 * ---------
 * 遵循 SDK "按需加载、渐进式加载"的设计理念：
 * - 不在系统提示中预先注入记忆工具说明
 * - 让 AI 自然发现并使用 Memory MCP 工具
 * - 减少不必要的 token 消耗和启动延迟
 *
 * 配置来源：
 * ---------
 * - ~/.claude/api-config.json 中的记忆相关配置
 * - 通过 memory-config.js 模块异步加载
 */

import type { MemoryConfig } from "./types.js";

// ========== 配置缓存 ==========
// 缓存配置以避免频繁读取文件，提升性能
let cachedConfig: Partial<MemoryConfig> | null = null;

/**
 * 获取记忆工具配置（同步版本）
 *
 * 用途：提供快速访问记忆配置的入口，不会阻塞调用方
 *
 * 返回值：
 * - 如果缓存已加载，返回缓存的配置
 * - 如果缓存未加载，返回默认配置（enabled=false, autoStore=false）
 *
 * 注意：
 * - 此函数是同步的，不会触发文件 I/O
 * - 要加载实际配置，需在应用启动时调用 loadMemoryToolConfig()
 *
 * @returns 记忆配置对象（部分配置，可能只包含默认值）
 */
export function getMemoryToolConfig(): Partial<MemoryConfig> {
  // 如果有缓存，直接返回
  if (cachedConfig) {
    return cachedConfig;
  }

  // 返回默认配置（记忆功能禁用）
  return {
    enabled: false,
    autoStore: false,
  };
}

/**
 * 异步加载记忆配置
 *
 * 用途：在应用启动时预加载记忆配置，避免首次使用时阻塞
 *
 * 调用时机：
 * - 应在 app-initializer.ts 中调用
 * - 在应用启动流程中尽早执行
 *
 * 错误处理：
 * - 如果加载失败，保持默认配置（记忆功能禁用）
 * - 错误会被记录到控制台，但不影响应用启动
 *
 * @returns Promise，在配置加载完成后 resolve
 */
export async function loadMemoryToolConfig(): Promise<void> {
  try {
    // 动态导入避免循环依赖
    const { getMemoryConfig } = await import("../../utils/memory-config.js");
    const result = await getMemoryConfig();

    // 只在成功时更新缓存
    if (result.success && result.config) {
      cachedConfig = result.config;
    }
  } catch (error) {
    // 保持默认配置，记录错误但不抛出异常
    console.error('[memory-manager] Failed to load memory config:', error);
  }
}

// ========== 渐进式加载设计说明 ==========
/**
 * 关于记忆指南提示的移除：
 * -------------------------------
 * 早期设计中，我们会在每个会话开始时向 AI 注入一段详细的
 * 记忆工具使用说明（约 100+ 行）。这违反了 SDK "按需加载"
 * 的设计理念，导致：
 *
 * 1. 每次会话都消耗额外的 token
 * 2. 即使 AI 不需要记忆功能也会收到说明
 * 3. 违背了"AI 自然发现工具"的设计原则
 *
 * 新的设计中：
 * - Memory MCP 服务器自动注册记忆工具
 * - AI 通过工具列表自然发现这些工具
 * - 当需要时，AI 会主动使用 memory_search 等工具
 * - 无需预先注入使用说明
 */

/**
 * 清除记忆指南缓存
 *
 * 用途：兼容性保留函数，实际不再执行任何操作
 *
 * 历史背景：
 * - 之前用于清除缓存的记忆提示文本
 * - 移除自动注入后，此函数变为空操作
 * - 保留是为了避免破坏现有调用方
 *
 * @deprecated 此函数已废弃，保留仅为兼容性
 */
export function clearMemoryGuidanceCache(): void {
  // 不再需要缓存，SDK 直接处理
  cachedConfig = null;
}

/**
 * 触发自动记忆分析
 *
 * 用途：会话结束时的钩子函数，用于触发记忆存储
 *
 * 当前实现：
 * - 此函数现在只记录日志，不执行实际分析
 * - SDK 会通过 Memory MCP 工具自动处理记忆存储
 * - AI 可以在会话中主动调用 memory_store 工具
 *
 * 参数说明：
 * - _session: 会话对象（未使用，保留参数签名）
 * - _prompt: 用户提示词（未使用）
 * - _memConfig: 记忆配置（未使用）
 * - _onEvent: 事件回调函数（未使用）
 *
 * @returns Promise，总是立即 resolve
 */
export async function triggerAutoMemoryAnalysis(
  _session: unknown,
  _prompt: string,
  _memConfig: MemoryConfig,
  _onEvent: (event: unknown) => void
): Promise<void> {
  const { log } = await import("../../logger.js");

  // 此功能已由 SDK 处理，只记录日志
  log.debug('[Memory] Auto-analysis handled by SDK MCP tools');

  // 如果配置启用了自动存储，SDK 会自动处理
  // 应用层不再需要额外调用 API 进行分析
}
