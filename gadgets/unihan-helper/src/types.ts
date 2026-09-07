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
 * 设置类型
 */
export interface Settings {
  enabled: boolean;
  useWebfont: boolean;
  loadMode: 'fallback' | 'always';
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
