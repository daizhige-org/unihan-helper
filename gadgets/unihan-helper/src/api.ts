/**
 * 字体清单与静态分片 URL
 *
 * 分片是预先切好的静态产物，托管在 Toolforge 的静态文件服务器上，
 * 因此这里不再有任何网络请求：清单是编译期常量，URL 由规则拼出。
 */

import { STATIC_BASE, CHUNK_SIZE, FONTS } from './consts';
import type { FontInfo } from './types';

/**
 * 获取可用字体列表
 *
 * 保留 async 签名，以免调用方（含设置对话框的 onLoadFonts 回调）需要改动。
 */
export async function fetchFontList(): Promise<FontInfo[]> {
    return FONTS;
}

/**
 * 按 id 取字体信息
 */
export function getFont(fontId: string): FontInfo | undefined {
    return FONTS.find((font) => font.id === fontId);
}

/**
 * 某字体的分片样式表 URL
 */
export function buildFontCssUrl(fontId: string): string {
    return `${STATIC_BASE}/${fontId}/${fontId}-${CHUNK_SIZE}.css`;
}
