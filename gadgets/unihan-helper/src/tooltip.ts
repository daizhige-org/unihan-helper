/**
 * Tooltip 类 - 自定义定位的 tooltip 实现
 * 参考 ReferenceTooltips 和 ilhpp 的实现
 */

import { CLASSES, IS_TOUCHSCREEN, TIMINGS } from './consts';

export class Tooltip {
  private element: HTMLElement;
  /** 提示文本，即元素原本的 title；解除绑定时用于还原 */
  readonly text: string;
  private $tooltip: HTMLElement | null = null;
  private $content: HTMLElement | null = null;
  private $tail: HTMLElement | null = null;
  private isPresent = false;
  private disappearing = false;
  private hideTimer: number | null = null;
  private removeTimer: number | null = null;
  private onSettingsClick: () => Promise<void>;
  private isSettingsLoading = false;
  // 外部定时器清除回调
  public clearExternalTimers: (() => void) | null = null;

  constructor(element: HTMLElement, text: string, onSettingsClick: () => Promise<void>) {
    this.element = element;
    this.text = text;
    this.onSettingsClick = onSettingsClick;
  }

  show(): void {
    // 清除所有定时器
    this.clearTimers();
    this.disappearing = false;

    if (!this.$tooltip) {
      this.create();
    }

    // 移除淡出动画类
    if (this.$tooltip) {
      this.$tooltip.classList.remove(CLASSES.FADE_OUT_UP, CLASSES.FADE_OUT_DOWN);
    }

    if (!this.isPresent && this.$tooltip) {
      document.body.appendChild(this.$tooltip);
      this.isPresent = true;
    }

    this.calculatePosition();
  }

  hide(): void {
    if (!this.$tooltip || !this.isPresent || this.disappearing) {
      return;
    }

    this.disappearing = true;

    // 添加淡出动画类
    if (this.$tooltip.classList.contains(CLASSES.TOOLTIP_ABOVE)) {
      this.$tooltip.classList.remove(CLASSES.FADE_IN_DOWN);
      this.$tooltip.classList.add(CLASSES.FADE_OUT_UP);
    } else {
      this.$tooltip.classList.remove(CLASSES.FADE_IN_UP);
      this.$tooltip.classList.add(CLASSES.FADE_OUT_DOWN);
    }

    // 动画结束后移除元素
    this.removeTimer = window.setTimeout(() => {
      if (this.$tooltip && this.isPresent) {
        this.$tooltip.remove();
        this.isPresent = false;
        this.disappearing = false;
      }
    }, TIMINGS.ANIMATION_DURATION);
  }

  /**
   * 视口尺寸变化后重新定位（仅对正在显示的 tooltip 有效）
   */
  reposition(): void {
    if (this.isVisible()) {
      this.calculatePosition();
    }
  }

  private clearTimers(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.removeTimer !== null) {
      clearTimeout(this.removeTimer);
      this.removeTimer = null;
    }
  }

  isVisible(): boolean {
    return this.isPresent && !this.disappearing;
  }

  destroy(): void {
    this.clearTimers();
    if (this.$tooltip) {
      this.$tooltip.remove();
      this.$tooltip = null;
      this.$content = null;
      this.$tail = null;
    }
    this.isPresent = false;
    this.disappearing = false;
  }

  private create(): void {
    // 创建 tooltip 容器
    this.$tooltip = document.createElement('div');
    this.$tooltip.className = CLASSES.TOOLTIP;
    this.$tooltip.setAttribute('role', 'tooltip');

    // 创建内容容器
    this.$content = document.createElement('div');
    this.$content.className = CLASSES.TOOLTIP_CONTENT;

    // 创建设置按钮容器
    const settingsContainer = document.createElement('div');
    settingsContainer.className = CLASSES.SETTINGS_BTN;

    // 创建设置按钮
    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = CLASSES.SETTINGS_BUTTON;
    const settingsLabel = mw.msg('unihan-settings');
    settingsButton.setAttribute('aria-label', settingsLabel);
    settingsButton.setAttribute('title', settingsLabel);

    // 创建设置图标
    const settingsIcon = document.createElement('span');
    settingsIcon.className = CLASSES.SETTINGS_ICON;
    settingsIcon.setAttribute('aria-hidden', 'true');
    settingsButton.appendChild(settingsIcon);

    settingsButton.addEventListener('click', async () => {
      if (this.isSettingsLoading) {
        return;
      }

      this.isSettingsLoading = true;
      settingsButton.disabled = true;

      try {
        await this.onSettingsClick();
      } finally {
        setTimeout(() => {
          this.isSettingsLoading = false;
          settingsButton.disabled = false;
        }, 300);
      }

      this.hide();
    });

    settingsContainer.appendChild(settingsButton);

    // 创建文本内容
    const textDiv = document.createElement('div');
    textDiv.className = CLASSES.TOOLTIP_TEXT;
    textDiv.textContent = this.text;

    this.$content.appendChild(settingsContainer);
    this.$content.appendChild(textDiv);

    // 创建尾巴（箭头）
    this.$tail = document.createElement('div');
    this.$tail.className = CLASSES.TOOLTIP_TAIL;

    this.$tooltip.appendChild(this.$tail);
    this.$tooltip.appendChild(this.$content);

    // 添加鼠标事件（非触摸屏）
    if (!IS_TOUCHSCREEN) {
      this.$tooltip.addEventListener('mouseenter', () => {
        // 鼠标进入 tooltip，清除所有定时器（包括外部的）
        this.clearTimers();
        if (this.clearExternalTimers) {
          this.clearExternalTimers();
        }
        this.disappearing = false;
      });

      this.$tooltip.addEventListener('mouseleave', () => {
        // 鼠标离开 tooltip，延迟隐藏
        this.hideTimer = window.setTimeout(() => {
          this.hide();
        }, TIMINGS.HIDE_DELAY);
      });
    }
  }

  private calculatePosition(): void {
    if (!this.$tooltip || !this.$tail) {
      return;
    }

    const anchorRect = this.element.getBoundingClientRect();
    const tooltipRect = this.$tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // 计算 tooltip 中心应该对齐的位置
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const anchorTop = anchorRect.top + scrollTop;
    const anchorBottom = anchorRect.bottom + scrollTop;

    // 默认尝试显示在上方
    let tooltipTop = anchorTop - tooltipRect.height - 7;
    let tooltipLeft = anchorCenterX - 20; // 20 是尾巴的偏移
    let isAbove = true;

    // 检查是否超出顶部
    if (anchorTop < tooltipRect.height + scrollTop + 6) {
      // 显示在下方
      tooltipTop = anchorBottom + 9;
      isAbove = false;
    }

    // 检查是否超出右侧
    if (tooltipLeft + tooltipRect.width > windowWidth + scrollLeft - 1) {
      tooltipLeft = windowWidth + scrollLeft - tooltipRect.width;
    }

    // 检查是否超出左侧
    if (tooltipLeft < scrollLeft) {
      tooltipLeft = scrollLeft;
    }

    // 应用位置
    this.$tooltip.style.top = `${tooltipTop}px`;
    this.$tooltip.style.left = `${tooltipLeft}px`;

    // 计算尾巴位置
    const tailLeft = anchorCenterX - tooltipLeft - 6; // 6 是尾巴宽度的一半
    this.$tail.style.left = `${tailLeft}px`;

    // 设置方向类和动画
    if (isAbove) {
      this.$tooltip.classList.remove(CLASSES.TOOLTIP_BELOW, CLASSES.FADE_IN_UP);
      this.$tooltip.classList.add(CLASSES.TOOLTIP_ABOVE, CLASSES.FADE_IN_DOWN);
    } else {
      this.$tooltip.classList.remove(CLASSES.TOOLTIP_ABOVE, CLASSES.FADE_IN_DOWN);
      this.$tooltip.classList.add(CLASSES.TOOLTIP_BELOW, CLASSES.FADE_IN_UP);
    }
  }
}
