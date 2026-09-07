/**
 * Unihan Helper - 生僻字 Webfont 显示小工具
 * 为生僻字提供字体支持和交互提示
 */

import './styles.less';
import { applyWebFont, clearAppliedFonts } from './webfont';
import { Tooltip } from './tooltip';
import { getSettings, saveSettings } from './utils';
import type { Settings } from './types';
import {
  STORAGE_KEY,
  DEFAULT_SETTINGS,
  CLASSES,
  TIMINGS,
  IS_TOUCHSCREEN,
  FONTS,
  PORTLET_LINK_ID,
} from './consts';
import { batchConv } from 'ext.gadget.HanAssist';

export type { FontInfo, Settings, LoadMode } from './types';

// 注册国际化消息
mw.messages.set(
  batchConv({
    'unihan-settings': { hans: '设置', hant: '設定' },
    'unihan-settings-portlet': { hans: '僻字辅助工具设置', hant: '僻字輔助工具設定' },
    'unihan-settings-load-failed': { hans: '无法加载设置模块', hant: '無法載入設定模組' },
  })
);

/** 设置模块（ext.gadget.unihan-helper-settings）的导出 */
type SettingsModule = typeof import('ext.gadget.unihan-helper-settings');

/** 单个生僻字元素上的绑定：tooltip 及解除绑定的方法 */
interface Binding {
  tooltip: Tooltip;
  unbind: () => void;
}

/**
 * 全局状态
 */
let settings: Settings = getSettings(STORAGE_KEY, DEFAULT_SETTINGS);
const bindings = new Map<HTMLElement, Binding>();

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
 * 隐藏所有 tooltip（可排除一个）
 */
function hideAllTooltips(except?: HTMLElement): void {
  bindings.forEach((binding, element) => {
    if (element !== except) {
      binding.tooltip.hide();
    }
  });
}

/**
 * 小工具停用后，tooltip 连同其中的设置按钮一起消失，用户将无处再把它打开。
 * 故停用期间在工具菜单挂一个设置入口；重新启用后移除。
 */
function addPortletLink(): void {
  if (document.getElementById(PORTLET_LINK_ID)) {
    return;
  }
  const link = mw.util.addPortletLink(
    'p-tb',
    '#',
    mw.msg('unihan-settings-portlet'),
    PORTLET_LINK_ID
  );
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      void openSettings();
    });
  }
}

function removePortletLink(): void {
  document.getElementById(PORTLET_LINK_ID)?.remove();
}

/**
 * 应用并保存新设置
 */
function applySettings(newSettings: Settings): void {
  settings = newSettings;
  saveSettings(STORAGE_KEY, settings);

  // 先还原再按需重新应用，覆盖字体切换、模式切换与关闭三种情形
  clearAppliedFonts();
  if (settings.enabled && settings.useWebfont) {
    applyWebFont(settings.selectedFont, settings.loadMode);
  }

  if (settings.enabled) {
    removePortletLink();
    bindContent(document);
  } else {
    unbindAll();
    addPortletLink();
  }
}

/**
 * 打开设置对话框
 */
async function openSettings(): Promise<void> {
  try {
    // 动态加载设置模块；using() 兑现的 require 才能取到懒加载模块的导出
    const req = await mw.loader.using('ext.gadget.unihan-helper-settings');
    const settingsModule: SettingsModule = req('ext.gadget.unihan-helper-settings');
    // 字体清单是编译期常量（分片为静态产物），直接传入即可
    settingsModule.openDialog(FONTS, settings, applySettings);
  } catch (error) {
    console.error('[unihan-helper] Failed to load settings module:', error);
    mw.notify(mw.msg('unihan-settings-load-failed'), { type: 'error' });
  }
}

/**
 * 为单个生僻字元素绑定 tooltip
 */
function bindElement(element: HTMLElement): void {
  if (bindings.has(element)) {
    return;
  }

  const tooltipText = element.getAttribute('title');
  if (!tooltipText) {
    // 没有 title 就没有可提示的内容
    return;
  }

  element.removeAttribute('title');

  const tooltip = new Tooltip(element, tooltipText, openSettings);

  let showTimer: number | null = null;
  let hideTimer: number | null = null;

  const clearTimers = () => {
    if (showTimer !== null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  // 提供清除外部定时器的方法给 tooltip
  tooltip.clearExternalTimers = clearTimers;

  const show = () => {
    clearTimers();
    tooltip.show();
  };

  const hide = () => {
    clearTimers();
    // 延迟隐藏，给用户时间移动鼠标到 tooltip 上
    hideTimer = window.setTimeout(() => {
      tooltip.hide();
      hideTimer = null;
    }, TIMINGS.HIDE_DELAY);
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    hideAllTooltips(element);

    // 切换当前 tooltip
    if (tooltip.isVisible()) {
      tooltip.hide();
    } else {
      show();
    }
  };

  const onMouseEnter = () => {
    clearTimers();
    showTimer = window.setTimeout(show, TIMINGS.HOVER_DELAY);
  };

  if (IS_TOUCHSCREEN) {
    element.addEventListener('click', onClick);
  } else {
    element.addEventListener('mouseenter', onMouseEnter);
    element.addEventListener('mouseleave', hide);
  }

  bindings.set(element, {
    tooltip,
    unbind: () => {
      clearTimers();
      element.removeEventListener('click', onClick);
      element.removeEventListener('mouseenter', onMouseEnter);
      element.removeEventListener('mouseleave', hide);
      tooltip.destroy();
      // 还原原生提示
      if (!element.hasAttribute('title')) {
        element.setAttribute('title', tooltip.text);
      }
    },
  });
}

/**
 * 为一段内容里的所有生僻字绑定 tooltip
 *
 * 可重复调用：已绑定的元素跳过；已从文档移除的元素（预览刷新、翻页等）
 * 顺便清理，以免 Map 无限增长。
 */
function bindContent(root: ParentNode): void {
  bindings.forEach((binding, element) => {
    if (!element.isConnected) {
      binding.unbind();
      bindings.delete(element);
    }
  });

  if (root instanceof HTMLElement && root.classList.contains(CLASSES.INLINE_UNIHAN)) {
    bindElement(root);
  }
  root.querySelectorAll<HTMLElement>(`.${CLASSES.INLINE_UNIHAN}`).forEach(bindElement);
}

/**
 * 解除全部绑定，并还原元素的 title
 */
function unbindAll(): void {
  bindings.forEach((binding) => binding.unbind());
  bindings.clear();
}

/**
 * 与具体元素无关的全局交互，只注册一次
 */
function bindGlobalInteractions(): void {
  // 触摸屏：点击其他地方关闭所有 tooltip
  if (IS_TOUCHSCREEN) {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const clickedTooltip = target?.closest(`.${CLASSES.TOOLTIP}`);
      const clickedTrigger = target?.closest(`.${CLASSES.INLINE_UNIHAN}`);

      if (!clickedTooltip && !clickedTrigger) {
        hideAllTooltips();
      }
    });
  }

  // Esc 关闭所有 tooltip
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideAllTooltips();
    }
  });

  // 视口尺寸变化后，重新定位正在显示的 tooltip
  let resizeScheduled = false;
  window.addEventListener('resize', () => {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      bindings.forEach((binding) => binding.tooltip.reposition());
    });
  });
}

/**
 * 初始化
 */
function init(): void {
  // 检查是否禁用
  if (checkDisabled()) {
    return;
  }

  // 如果启用且使用网络字形，挂上分片样式表
  if (settings.enabled && settings.useWebfont) {
    applyWebFont(settings.selectedFont, settings.loadMode);
  }

  bindGlobalInteractions();

  if (settings.enabled) {
    // 先扫整个文档：{{僻字}} 也会出现在正文之外，如 DISPLAYTITLE 改写的标题
    bindContent(document);
  } else {
    addPortletLink();
  }

  // 正文被替换时（预览、可视化编辑器保存、动态加载的内容等）为新内容绑定。
  // 该 hook 会带着当前内容立即触发一次，已绑定的元素会被跳过。
  mw.hook('wikipage.content').add(($content) => {
    if (settings.enabled && $content[0]) {
      bindContent($content[0]);
    }
  });
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
