/**
 * 权限处理模块
 * @author Alan
 * @copyright AGCPA v3.0
 * @created 2025-01-24
 *
 * 模块职责：
 * ---------
 * 本模块负责处理 SDK 工具使用的权限管理，包括：
 * 1. 删除操作的自动检测和用户确认
 * 2. AskUserQuestion 工具的权限请求处理
 * 3. 记忆工具调用的状态事件发送
 * 4. 权限请求的超时和会话中止处理
 *
 * 权限模式：
 * ---------
 * - default: 默认模式，删除操作和 AskUserQuestion 需要用户确认
 * - acceptEdits: 自动批准编辑操作
 * - bypassPermissions: 跳过所有权限检查（不推荐）
 * - plan: 计划模式，用于规划和分析
 * - delegate: 委托模式，工具调用自动批准
 * - dontAsk: 不询问用户，自动执行
 *
 * 安全设计：
 * ---------
 * - 所有删除操作（无论平台）都需要用户确认
 * - 权限请求有超时机制，防止内存泄漏
 * - 会话中止时自动清理所有待处理的权限请求
 */

import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { checkIfDeletionOperation } from "../../../shared/deletion-detection.js";
import { RUNNER_TIMEOUT } from "../../config/constants.js";
import type { Session } from "../../storage/session-store.js";
import type { ServerEvent } from "../../types.js";

/**
 * 创建权限请求回调函数
 *
 * 用途：为 SDK 提供 canUseTool 回调，用于控制工具使用的权限
 *
 * 工作流程：
 * 1. 检测工具是否需要用户确认（删除操作、AskUserQuestion）
 * 2. 如果需要确认，发送权限请求到前端
 * 3. 等待用户响应（通过 pendingPermissions Map）
 * 4. 超时或会话中止时自动拒绝
 * 5. 其他工具自动批准
 *
 * @param session - 当前会话对象，用于存储待处理的权限请求
 * @param sendPermissionRequest - 发送权限请求到前端的回调函数
 * @returns canUseTool 回调函数，符合 SDK PermissionHandler 类型
 */
export function createPermissionHandler(
  session: Session,
  sendPermissionRequest: (toolUseId: string, toolName: string, input: unknown) => void
) {
  return async function canUseTool(
    toolName: string,
    input: unknown,
    { signal }: { signal: AbortSignal }
  ): Promise<PermissionResult> {
    const { log } = await import("../../logger.js");

    // ========== 1. 检测删除操作 ==========
    // 使用跨平台删除检测模块，识别所有形式的删除命令
    const isDeletionOperation = checkIfDeletionOperation(toolName, input);

    // 记录所有工具调用（使用 debug 级别减少日志量）
    log.debug(`[Tool] ${toolName}, isDeletion=${isDeletionOperation}`);

    // ========== 2. 处理需要用户确认的工具 ==========
    // AskUserQuestion 或删除操作都需要用户响应
    if (toolName === "AskUserQuestion" || isDeletionOperation) {
      // 生成唯一的工具使用 ID，用于关联请求和响应
      const toolUseId = crypto.randomUUID();

      // 发送权限请求到前端，显示确认对话框
      sendPermissionRequest(toolUseId, toolName, input);

      // ========== 3. 创建等待用户响应的 Promise ==========
      return new Promise<PermissionResult>((resolve) => {
        // 添加超时机制，防止 Promise 永不 resolve 导致内存泄漏
        const timeout = setTimeout(() => {
          session.pendingPermissions.delete(toolUseId);
          log.warn(`Permission request timeout for ${toolName}`, { toolUseId, toolName });
          resolve({ behavior: "deny", message: "Permission request timeout" });
        }, RUNNER_TIMEOUT);

        // 将待处理的权限请求存储在会话中
        // 当用户响应时，通过 IPC 调用 resolve 来完成这个 Promise
        session.pendingPermissions.set(toolUseId, {
          toolUseId,
          toolName,
          input,
          resolve: (result) => {
            clearTimeout(timeout);
            session.pendingPermissions.delete(toolUseId);
            resolve(result as PermissionResult);
          }
        });

        // ========== 4. 处理会话中止 ==========
        // 当会话被中止时，自动拒绝所有待处理的权限请求
        signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          session.pendingPermissions.delete(toolUseId);
          resolve({ behavior: "deny", message: "Session aborted" });
        });
      });
    }

    // ========== 5. 自动批准其他工具 ==========
    // 非危险操作（如读取文件、搜索代码等）自动批准
    return { behavior: "allow", updatedInput: input as Record<string, unknown> };
  };
}

/**
 * 处理工具使用事件
 *
 * 用途：在工具被调用时发送相应的状态事件，用于 UI 更新和日志记录
 *
 * 处理的工具类型：
 * 1. Memory MCP 工具（memory_search, memory_store, memory_ask）
 * 2. Claude Memory Tool 命令（memory create 等）
 * 3. Bash 删除命令（用于日志记录）
 *
 * @param toolName - 工具名称（如 "memory_search", "Bash"）
 * @param toolInput - 工具输入参数
 * @param memConfig - 记忆配置对象
 * @param session - 当前会话
 * @param onEvent - 事件回调函数，用于向前端发送事件
 */
export async function handleToolUseEvent(
  toolName: string,
  toolInput: unknown,
  memConfig: { enabled: boolean; autoStore?: boolean },
  session: Session,
  onEvent: (event: ServerEvent) => void
): Promise<void> {
  const { log } = await import("../../logger.js");

  // ========== 1. Memory MCP 工具处理 ==========
  if (memConfig.enabled) {
    // 快速记忆工具（自定义 MCP 服务器提供的工具）
    if (toolName === "memory_search" || toolName === "memory_store" || toolName === "memory_ask") {
      // 使用 debug 级别记录，避免日志过多
      log.debug(`[Memory Tool] ${toolName}`);

      // 发送记忆状态事件到前端，用于显示进度提示
      if (toolName === "memory_store") {
        onEvent({
          type: "memory.status",
          payload: {
            sessionId: session.id,
            stored: false,
            message: `正在存储记忆: ${(toolInput as Record<string, unknown>).title || '无标题'}`
          }
        });
      } else if (toolName === "memory_search") {
        onEvent({
          type: "memory.status",
          payload: {
            sessionId: session.id,
            stored: false,
            message: `正在搜索记忆: ${(toolInput as Record<string, unknown>).query?.toString().substring(0, 30) || ''}...`
          }
        });
      }
    }
    // Claude Memory Tool 命令（SDK 原生 memory 工具）
    else if (toolName === "memory") {
      log.debug(`[Memory Tool] memory command`);

      const subCommand = (toolInput as Record<string, unknown>)?.command || (toolInput as Record<string, unknown>)?.subcommand;
      if (subCommand === "create") {
        onEvent({
          type: "memory.status",
          payload: {
            sessionId: session.id,
            stored: false,
            message: `正在创建记忆文件`
          }
        });
      }
    }
  }

  // ========== 2. 删除操作日志记录 ==========
  // 记录检测到的删除操作，用于审计和调试
  if (toolName === "Bash") {
    const cmd = (toolInput as Record<string, unknown>)?.command;
    if (cmd && checkIfDeletionOperation("Bash", { command: cmd })) {
      log.info(`[Deletion Detected] Tool use detected: ${cmd}`);
    }
  }
}
