/**
 * 工具函数
 */

import { getFont } from './api';
import { LOAD_MODES } from './consts';
import type { LoadMode, Settings } from './types';

/**
 * 获取字符的 Unicode 码点（十进制）
 */
export function getCodePoint(char: string): number {
  return char.codePointAt(0) || 0;
}

/**
 * 获取字符的十六进制 Unicode 值
 */
export function getHexCodePoint(char: string): string {
  return getCodePoint(char).toString(16).toUpperCase();
}

/**
 * 把来源不可信的对象整理成合法的设置
 *
 * localStorage 里可能是旧版本写入的、被手改过的，或字体已从清单移除的值；
 * 逐项校验，不合法的一律回退到默认值，避免把坏值一路传到字体应用与设置对话框。
 */
export function sanitizeSettings(raw: unknown, defaults: Settings): Settings {
  const input = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  return {
    enabled: bool(input.enabled, defaults.enabled),
    useWebfont: bool(input.useWebfont, defaults.useWebfont),
    loadMode: LOAD_MODES.includes(input.loadMode as LoadMode)
      ? (input.loadMode as LoadMode)
      : defaults.loadMode,
    selectedFont:
      typeof input.selectedFont === 'string' && getFont(input.selectedFont)
        ? input.selectedFont
        : defaults.selectedFont,
  };
}

/**
 * 从 localStorage 获取设置
 */
export function getSettings(key: string, defaults: Settings): Settings {
  try {
    const stored = localStorage.getItem(key);
    return sanitizeSettings(stored ? JSON.parse(stored) : null, defaults);
  } catch {
    return { ...defaults };
  }
}

/**
 * 保存设置到 localStorage
 */
export function saveSettings(key: string, settings: Settings): void {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}
