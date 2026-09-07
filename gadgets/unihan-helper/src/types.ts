/**
 * 字体信息
 */
export interface FontInfo {
  id: string;
  version: string;
  font_family: string;
  license: string;
  fallback: string[];
  name: {
    'zh-hans': string;
    'zh-hant': string;
  };
  title: {
    'zh-hans': string;
    'zh-hant': string;
  };
}

/**
 * 网络字形加载模式：fallback 本机有字形时优先本机；always 总是覆盖本机字形
 */
export type LoadMode = 'fallback' | 'always';

/**
 * 设置类型
 */
export interface Settings {
  enabled: boolean;
  useWebfont: boolean;
  loadMode: LoadMode;
  selectedFont: string;
}

/**
 * Tooltip 位置
 */
export interface TooltipPosition {
  top: number;
  left: number;
  isAbove: boolean;
}

/**
 * 元素位置信息
 */
export interface ElementOffset {
  top: number;
  left: number;
  width: number;
  height: number;
}
