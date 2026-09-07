/**
 * 工具函数
 */

import type { Settings } from './types';

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
 * 从 localStorage 获取设置
 */
export function getSettings(key: string, defaults: Settings): Settings {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
    return defaults;
  } catch {
    return defaults;
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
