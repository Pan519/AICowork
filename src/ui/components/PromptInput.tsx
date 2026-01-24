/**
 * PromptInput 组件
 * @author Alan
 * @copyright AGCPA v3.0
 * @created 2025-01-24
 * @Email alan@example.com
 *
 * 会话输入框组件 - 支持基本输入、发送和停止功能
 * 斜杠命令由 SDK 原生处理，无需前端补全
 */

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ClientEvent } from "../types";
import { useAppStore } from "../store/useAppStore";
import { log } from "../utils/logger";

const DEFAULT_ALLOWED_TOOLS = "Read,Edit,Bash";
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
  onSendMessage?: () => void;
  disabled?: boolean;
}

/**
 * Prompt 输入操作 Hook
 * 封装发送和停止逻辑
 */
export function usePromptActions(sendEvent: (event: ClientEvent) => void) {
  const { t } = useTranslation();
  const prompt = useAppStore((state) => state.prompt);
  const cwd = useAppStore((state) => state.cwd);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  const setGlobalError = useAppStore((state) => state.setGlobalError);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const isRunning = activeSession?.status === "running";

  /**
   * 发送消息
   */
  const handleSend = useCallback(async () => {
    if (!prompt.trim()) return;

    if (!activeSessionId) {
      let title = "";
      try {
        setPendingStart(true);
        title = await window.electron.generateSessionTitle(prompt);
      } catch (error) {
        log.error("Failed to generate session title", error);
        setPendingStart(false);
        setGlobalError(t("errors.failedToGetSessionTitle"));
        return;
      }
      sendEvent({
        type: "session.start",
        payload: { title, prompt, cwd: cwd.trim() || undefined, allowedTools: DEFAULT_ALLOWED_TOOLS }
      });
    } else {
      if (activeSession?.status === "running") {
        setGlobalError(t("errors.sessionStillRunning"));
        return;
      }
      sendEvent({ type: "session.continue", payload: { sessionId: activeSessionId, prompt } });
    }
    setPrompt("");
  }, [activeSession, activeSessionId, cwd, prompt, sendEvent, setGlobalError, setPendingStart, setPrompt, t]);

  /**
   * 停止会话
   */
  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    sendEvent({ type: "session.stop", payload: { sessionId: activeSessionId } });
  }, [activeSessionId, sendEvent]);

  /**
   * 从模态框开始会话
   */
  const handleStartFromModal = useCallback(() => {
    if (!cwd.trim()) {
      setGlobalError(t("errors.workingDirectoryRequired"));
      return;
    }
    handleSend();
  }, [cwd, handleSend, setGlobalError, t]);

  return { prompt, setPrompt, isRunning, handleSend, handleStop, handleStartFromModal };
}

/**
   * PromptInput 组件
   * 基本输入框组件，支持自动调整高度和快捷键操作
   */
export function PromptInput({ sendEvent, onSendMessage, disabled = false }: PromptInputProps) {
  const { t } = useTranslation();
  const { prompt, setPrompt, isRunning, handleSend, handleStop } = usePromptActions(sendEvent);
  console.log("🚀 ~ PromptInput ~ isRunning:", isRunning)
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // 直接检查是否有活跃会话，更可靠的方式
  const hasActiveSession = useAppStore((state) => !!state.activeSessionId);

  /**
   * 处理键盘事件
   * Enter 发送消息，Shift+Enter 换行
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled && !isRunning) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (isRunning) {
      handleStop();
      return;
    }
    onSendMessage?.();
    handleSend();
  };

  /**
   * 处理按钮点击
   */
  const handleButtonClick = () => {
    if (disabled && !isRunning) return;
    if (isRunning) {
      handleStop();
    } else {
      onSendMessage?.();
      handleSend();
    }
  };

  /**
   * 处理输入事件 - 自动调整高度
   */
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = "auto";
    const scrollHeight = target.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      target.style.height = `${MAX_HEIGHT}px`;
      target.style.overflowY = "auto";
    } else {
      target.style.height = `${scrollHeight}px`;
      target.style.overflowY = "hidden";
    }
  };

  /**
   * 当 prompt 内容变化时调整高度
   */
  useEffect(() => {
    if (!promptRef.current) return;
    promptRef.current.style.height = "auto";
    const scrollHeight = promptRef.current.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      promptRef.current.style.height = `${MAX_HEIGHT}px`;
      promptRef.current.style.overflowY = "auto";
    } else {
      promptRef.current.style.height = `${scrollHeight}px`;
      promptRef.current.style.overflowY = "hidden";
    }
  }, [prompt]);

  // 处理输入框点击事件 - 当没有活跃会话时，打开启动会话模态框
  const handleEmptySessionClick = () => {
    console.log("🚀 ~ handleEmptySessionClick ~ hasActiveSession:", hasActiveSession)
    if (!hasActiveSession) {
      useAppStore.getState().setShowStartModal(true);
    }
  };

  return (
    <section className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pb-6 px-2 lg:pb-8 pt-8 lg:ml-[280px]">
      <div className="mx-auto relative w-full max-w-full lg:max-w-3xl">
        <div 
          className="flex items-end gap-3 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card"
          onClick={handleEmptySessionClick}
        >
          {/* 文本输入框 */}
          <textarea
            rows={1}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm text-ink-800 placeholder:text-muted focus:outline-none disabled:opacity-60 cursor-pointer"
            placeholder={disabled ? t("promptInput.placeholderDisabled") : t("promptInput.placeholder")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            ref={promptRef}
          />

          {/* 发送/停止按钮 */}
          <button
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 cursor-pointer ${
              isRunning
                ? "bg-error text-white hover:bg-error/90"
                : "bg-accent text-white hover:bg-accent-hover"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleButtonClick();
            }}
            aria-label={isRunning ? t("promptInput.stopSession") : t("promptInput.sendPrompt")}
          >
            {isRunning ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
