/**
 * Webfont 管理
 *
 * 分片样式表由 webfont-zh-static 预先生成，每个 @font-face 覆盖 32 个连续码位，
 * 浏览器按 unicode-range 只下载页面上真正出现的那几片。所以取字体这件事不再
 * 需要遍历文本、也不需要按字发请求，这里只负责两件事：
 *   1. 把所选字体（及其 fallback）的样式表挂上去；
 *   2. 把这些字体插进每个 .inline-unihan 的 font-family。
 *
 * 第 2 步必须改元素的行内 style，不能靠样式表规则：{{僻字}} 生成的 span 自带
 *     style="…; font-family: sans-serif, 'FZSongS-Extended', …, 'Plangothic P2';"
 * 行内声明在层叠中压过任何作者样式表规则（除非用 !important），样式表规则
 * 因而完全不生效，一个分片都不会加载。
 */

import { buildFontCssUrl, getFont } from './api';
import { CLASSES } from './consts';
import type { FontInfo } from './types';

const LINK_ID_PREFIX = 'unihan-webfont-';

/** {{僻字}} 的 NotUnicode 分支：字符不在 Unicode 内，另有一套 PUA 字体机制，
 *  外层 span 的 id 如下。这类元素不能碰，否则会盖掉它本来的字形。 */
const PUA_WRAPPERS = '#glyphwebfont, #glyphwebfont-one';

/** 已挂上的样式表，key 为字体 id */
const loadedSheets = new Set<string>();

/** 元素原本的 font-family，用于切换字体与关闭时还原 */
const originalFamily = new WeakMap<HTMLElement, string>();

/** 已处理过的元素，切换字体时要重算，故与 originalFamily 分开 */
const touched = new Set<HTMLElement>();

/** 当前生效的设置，供 MutationObserver 处理后插入的元素 */
let active: { families: string; loadMode: 'fallback' | 'always' } | null = null;

let observer: MutationObserver | null = null;

/**
 * 挂上某字体的分片样式表（重复调用无副作用）
 */
function loadStylesheet(fontId: string): void {
    if (loadedSheets.has(fontId)) {
        return;
    }
    loadedSheets.add(fontId);

    const id = LINK_ID_PREFIX + fontId;
    if (document.getElementById(id)) {
        return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = buildFontCssUrl(fontId);
    document.head.appendChild(link);
}

/**
 * 所选字体加其 fallback 链，去重后按序返回
 */
function resolveChain(fontId: string): FontInfo[] {
    const chain: FontInfo[] = [];
    const seen = new Set<string>();

    const push = (id: string): void => {
        if (seen.has(id)) return;
        const font = getFont(id);
        if (!font) return;
        seen.add(id);
        chain.push(font);
    };

    push(fontId);
    // 只展开所选字体自身声明的 fallback，不再递归——四款互为 fallback，
    // 递归下去等于把全部样式表都挂上。
    (chain[0]?.fallback ?? []).forEach(push);

    return chain;
}

/**
 * 元素是否该被处理
 */
function isEligible(element: HTMLElement): boolean {
    return !element.closest(PUA_WRAPPERS);
}

/**
 * 把 webfont 插进单个元素的 font-family
 */
function applyTo(element: HTMLElement): void {
    if (!active || !isEligible(element)) {
        return;
    }

    if (!originalFamily.has(element)) {
        originalFamily.set(element, element.style.fontFamily || '');
    }
    const base = originalFamily.get(element) as string;
    const { families, loadMode } = active;

    // fallback：排在模板给的字体栈之后，本机装了其中任一款且有该字形时就用本机的，
    // 浏览器也不会去下载对应分片。always：排在最前，覆盖本机字形。
    let stack: string;
    if (!base) {
        stack = `${families}, serif`;
    } else if (loadMode === 'fallback') {
        stack = `${base}, ${families}`;
    } else {
        stack = `${families}, ${base}`;
    }

    element.style.fontFamily = stack;
    touched.add(element);
}

/**
 * 处理当前文档里所有 .inline-unihan
 */
function applyAll(): void {
    document
        .querySelectorAll<HTMLElement>(`.${CLASSES.INLINE_UNIHAN}`)
        .forEach(applyTo);
}

/**
 * 监听后续插入的生僻字（预览、动态加载的内容等）
 */
function startObserver(): void {
    if (observer || typeof MutationObserver === 'undefined') {
        return;
    }
    observer = new MutationObserver((records) => {
        if (!active) return;
        records.forEach((record) => {
            record.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (node.classList.contains(CLASSES.INLINE_UNIHAN)) {
                    applyTo(node);
                }
                node
                    .querySelectorAll<HTMLElement>(`.${CLASSES.INLINE_UNIHAN}`)
                    .forEach(applyTo);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * 应用所选字体
 *
 * @param fontId   字体 id
 * @param loadMode always 覆盖本机字形；fallback 则本机有该字形时优先用本机的
 */
export function applyWebFont(fontId: string, loadMode: 'fallback' | 'always' = 'always'): void {
    const chain = resolveChain(fontId);
    if (chain.length === 0) {
        console.warn(`[unihan-helper] 未知字体：${fontId}`);
        return;
    }

    chain.forEach((font) => loadStylesheet(font.id));
    active = {
        families: chain.map((font) => `"${font.font_family}"`).join(', '),
        loadMode,
    };

    applyAll();
    startObserver();
}

/**
 * 处理页面中所有生僻字
 *
 * 保留此名以免调用方改动；分片按 unicode-range 自动匹配，无需再逐字处理。
 */
export function processUnihanChars(fontId: string, loadMode: 'fallback' | 'always' = 'always'): void {
    applyWebFont(fontId, loadMode);
}

/**
 * 还原所有已处理元素的 font-family
 *
 * 样式表本身留着：切回同一字体时不必重新下载，而没有任何元素引用的
 * @font-face 不会触发分片请求。
 */
export function clearAppliedFonts(): void {
    active = null;
    touched.forEach((element) => {
        element.style.fontFamily = originalFamily.get(element) ?? '';
    });
    touched.clear();
}
