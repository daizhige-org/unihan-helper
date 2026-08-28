/**
 * Unihan Helper - 生僻字 Webfont 显示小工具
 * 为生僻字提供字体支持和交互提示
 */

import './styles.less';
import { fetchFontList } from './api';
import { processUnihanChars, clearAppliedFonts } from './webfont';
import { Tooltip } from './tooltip';
import { getSettings, saveSettings } from './utils';
import type { Settings } from './types';
import {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    CLASSES,
    TIMINGS,
    IS_TOUCHSCREEN,
} from './consts';
import type { FontInfo } from './types';

// 注册国际化消息
const { batchConv } = require('ext.gadget.HanAssist');
mw.messages.set(
    batchConv({
        'unihan-settings': { hans: '设置', hant: '設定' },
    })
);

/**
 * 全局状态
 */
let availableFonts: FontInfo[] | null = null;
let settings: Settings = getSettings(STORAGE_KEY, DEFAULT_SETTINGS);
const tooltips = new Map<HTMLElement, Tooltip>();

/**
 * 检查是否禁用小工具
 */
function checkDisabled(): boolean {
    const ep = mw.util.getParamValue('UTdontload');
    if (ep && !isNaN(Number(ep))) {
        // mw.cookie 的 expires 以秒计，而 $.cookie 用的是天，故乘 86400。
        // prefix 传空串以写裸 cookie 名：mw.cookie 默认会加上本 wiki 的
        // $wgCookiePrefix，而 UTdontload 是各小工具共用的约定名。
        mw.cookie.set('UTdontload', '1', {
            path: '/',
            prefix: '',
            expires: parseInt(ep, 10) * 86400,
        });
    }
    return mw.cookie.get('UTdontload', '') === '1';
}

/**
 * 初始化 overlay 容器
 */
function initOverlay(): void {
    const overlay = document.createElement('div');
    overlay.className = CLASSES.OVERLAY;
    document.body.appendChild(overlay);
}

/**
 * 打开设置对话框
 */
async function openSettings(): Promise<void> {
    try {
        // 动态加载设置模块
        await mw.loader.using('ext.gadget.unihan-helper-settings');

        // 调用设置模块的打开函数
        const settingsModule = require('ext.gadget.unihan-helper-settings');
        if (settingsModule && typeof settingsModule.openDialog === 'function') {
            // 字体清单是编译期常量（分片为静态产物），取不到列表这件事已不会发生，
            // 但保留错误分支以免设置对话框的接口改动。
            const fontLoadError = false;
            if (availableFonts === null) {
                availableFonts = await fetchFontList();
            }

            settingsModule.openDialog(
                availableFonts,
                settings,
                (newSettings: Settings) => {
                    // 保存新设置
                    settings = newSettings;
                    saveSettings(STORAGE_KEY, settings);

                    // 如果启用且使用网络字形，重新应用字体
                    if (settings.enabled && settings.useWebfont) {
                        clearAppliedFonts();
                        processUnihanChars(settings.selectedFont, settings.loadMode);
                    } else {
                        // 禁用时清除字体
                        clearAppliedFonts();
                    }

                    // 设置已保存，不显示通知
                },
                // 提供字体加载函数
                async () => {
                    if (availableFonts === null) {
                        availableFonts = await fetchFontList();
                    }
                    return availableFonts;
                },
                // 传递初始加载错误状态
                fontLoadError
            );
        }
    } catch (error) {
        console.error('Failed to load settings module:', error);
        mw.notify('无法加载设置模块', { type: 'error' });
    }
}

/**
 * 绑定交互事件
 */
function bindInteractions(): void {
    // 如果功能被禁用，不绑定交互
    if (!settings.enabled) {
        return;
    }

    const elements = document.querySelectorAll(`.${CLASSES.INLINE_UNIHAN}`);

    elements.forEach((el) => {
        const element = el as HTMLElement;
        const tooltipText = element.getAttribute('title');
        if (!tooltipText) return; // If there's no title attribute or it's empty, don't proceed

        element.removeAttribute('title');

        const tooltip = new Tooltip(element, tooltipText, openSettings);
        tooltips.set(element, tooltip);

        let showTimer: number | null = null;
        let hideTimer: number | null = null;

        // 提供清除外部定时器的方法给 tooltip
        tooltip.clearExternalTimers = () => {
            if (showTimer !== null) {
                clearTimeout(showTimer);
                showTimer = null;
            }
            if (hideTimer !== null) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        };

        const show = () => {
            if (showTimer !== null) {
                clearTimeout(showTimer);
                showTimer = null;
            }
            if (hideTimer !== null) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            tooltip.show();
        };

        const hide = () => {
            if (showTimer !== null) {
                clearTimeout(showTimer);
                showTimer = null;
            }
            if (hideTimer !== null) {
                clearTimeout(hideTimer);
            }
            // 延迟隐藏，给用户时间移动鼠标到 tooltip 上
            hideTimer = window.setTimeout(() => {
                tooltip.hide();
                hideTimer = null;
            }, TIMINGS.HIDE_DELAY);
        };

        if (IS_TOUCHSCREEN) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 隐藏其他所有 tooltip
                tooltips.forEach((t, el2) => {
                    if (el2 !== element) {
                        t.hide();
                    }
                });

                // 切换当前 tooltip
                if (tooltip.isVisible()) {
                    tooltip.hide();
                } else {
                    show();
                }
            });
        } else {
            element.addEventListener('mouseenter', () => {
                showTimer = window.setTimeout(() => show(), TIMINGS.HOVER_DELAY);
            });

            element.addEventListener('mouseleave', hide);
        }
    });

    // 触摸屏：点击其他地方关闭所有 tooltip
    if (IS_TOUCHSCREEN) {
        document.addEventListener('click', (e) => {
            const clickedTooltip = (e.target as HTMLElement).closest('.unihan-tooltip');
            const clickedTrigger = (e.target as HTMLElement).closest(`.${CLASSES.INLINE_UNIHAN}`);

            if (!clickedTooltip && !clickedTrigger) {
                tooltips.forEach((tooltip) => {
                    tooltip.hide();
                });
            }
        });
    }
}

/**
 * 初始化
 */
async function init(): Promise<void> {
    // 检查是否禁用
    if (checkDisabled()) {
        return;
    }

    // 初始化 overlay
    initOverlay();

    // 如果启用且使用网络字形，挂上分片样式表
    if (settings.enabled && settings.useWebfont) {
        processUnihanChars(settings.selectedFont, settings.loadMode);
    }

    // 绑定交互
    bindInteractions();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    void init();
}
