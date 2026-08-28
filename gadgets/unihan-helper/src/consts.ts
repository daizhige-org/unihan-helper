/**
 * 常量定义
 */

import type { FontInfo } from './types';

/**
 * 静态分片的基址。产物由 webfont-zh-static 预先切好并同步到 Toolforge 的
 * 静态文件服务器，取字体不再需要任何服务端进程。
 * 布局：<BASE>/<字体 id>/<字体 id>-<块大小>.css，CSS 内的 src 为相对路径
 * <块大小>/<块起始码位>.<内容哈希>.woff2
 */
export const STATIC_BASE = 'https://tools-static.wmflabs.org/webfont-zh-static';

/** 与产物一致的分块大小（码位/块） */
export const CHUNK_SIZE = 32;

export const IS_TOUCHSCREEN = 'ontouchstart' in document.documentElement;

export const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent) ||
    typeof window.orientation !== 'undefined';

// 存储键
export const STORAGE_KEY = 'unihan-settings';

// 默认设置
export const DEFAULT_FONT = 'Plangothic';
export const DEFAULT_SETTINGS = {
    enabled: true,
    useWebfont: false,
    loadMode: 'always' as 'fallback' | 'always',
    selectedFont: DEFAULT_FONT,
};

/**
 * 可用字体。分片是静态产物，字体清单随之固定，无需再向服务端查询。
 * fallback 为该字体缺字时依次尝试的字体 id；各字体的 CSS 会一并加载，
 * 由 CSS 自身的 font-family 次序完成逐字回落。
 */
export const FONTS: FontInfo[] = [
    {
        id: 'Plangothic',
        version: '6.399',
        font_family: 'Plangothic',
        license: 'SIL Open Font License 1.1',
        fallback: ['JigmoTC', 'WenJinMincho', 'SourceHanSans'],
        name: { 'zh-hans': '遍黑体', 'zh-hant': '遍黑體' },
        title: { 'zh-hans': '[[遍黑體|遍黑体]]', 'zh-hant': '[[遍黑體]]' },
    },
    {
        id: 'JigmoTC',
        version: '2023-06-21',
        font_family: 'Jigmo TC',
        license: 'CC0 1.0',
        fallback: ['Plangothic', 'WenJinMincho', 'SourceHanSans'],
        name: { 'zh-hans': 'Jigmo TC（繁体取向）', 'zh-hant': 'Jigmo TC（繁體取向）' },
        title: {
            'zh-hans': '[https://kamichikoichi.github.io/jigmo/ Jigmo]，涵盖扩展 A–J',
            'zh-hant': '[https://kamichikoichi.github.io/jigmo/ Jigmo]，涵蓋擴展 A–J',
        },
    },
    {
        id: 'WenJinMincho',
        version: '2.001',
        font_family: 'WenJinMincho',
        license: 'SIL Open Font License 1.1',
        fallback: ['Plangothic', 'JigmoTC', 'SourceHanSans'],
        name: { 'zh-hans': '文津宋体', 'zh-hant': '文津明朝' },
        title: {
            'zh-hans': '[https://github.com/takushun-wu/WenJinMincho 文津宋体]',
            'zh-hant': '[https://github.com/takushun-wu/WenJinMincho 文津明朝]',
        },
    },
    {
        id: 'SourceHanSans',
        version: '2.005',
        font_family: 'Source Han Sans',
        license: 'SIL Open Font License 1.1',
        fallback: ['Plangothic', 'JigmoTC', 'WenJinMincho'],
        name: { 'zh-hans': '思源黑体', 'zh-hant': '思源黑體' },
        title: { 'zh-hans': '[[思源黑體|思源黑体]]', 'zh-hant': '[[思源黑體]]' },
    },
];

export const CLASSES = {
    FADE_IN_DOWN: 'unihan-fade-in-down',
    FADE_IN_UP: 'unihan-fade-in-up',
    FADE_OUT_DOWN: 'unihan-fade-out-down',
    FADE_OUT_UP: 'unihan-fade-out-up',
    VISIBLE: 'unihan-visible',
    TOOLTIP: 'unihan-tooltip',
    TOOLTIP_ABOVE: 'unihan-tooltip-above',
    TOOLTIP_BELOW: 'unihan-tooltip-below',
    TOOLTIP_CONTENT: 'unihan-tooltip-content',
    TOOLTIP_TAIL: 'unihan-tooltip-tail',
    SETTINGS_BTN: 'unihan-settings-btn-container',
    OVERLAY: 'unihan-overlay',
    INLINE_UNIHAN: 'inline-unihan',
} as const;

export const TIMINGS = {
    HOVER_DELAY: IS_TOUCHSCREEN ? 0 : 200,
    HIDE_DELAY: 200,
    ANIMATION_DURATION: 200,
} as const;
