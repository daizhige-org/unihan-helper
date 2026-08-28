/**
 * Unihan Helper Settings - 设置对话框
 */

import { createMwApp } from 'vue';
import { CdxDialog, CdxField, CdxLabel, CdxRadio, CdxToggleSwitch } from '@wikimedia/codex';
import { batchConv } from 'ext.gadget.HanAssist';
import type { FontInfo, Settings } from './types';

// 设置多语言消息
mw.messages.set(
  batchConv({
    'unihan-settings-title': { hans: '僻字辅助工具设置', hant: '僻字輔助工具設定' },
    'unihan-enable': { hans: '启用僻字辅助工具', hant: '啟用僻字輔助工具' },
    'unihan-enable-desc': {
      hans: '如要完全关闭，请登录后在参数设置取消勾选本小工具。',
      hant: '如要完全關閉，請登入後在偏好設定取消勾選本小工具。',
    },
    'unihan-use-webfont': { cn: '使用网络字形', hk: '使用網絡字型', tw: '使用網路字型' },
    'unihan-use-webfont-desc': {
      cn: '使用网络字形显示罕用字。启用本选项，视为您同意《<a href="https://wikitech.wikimedia.org/wiki/Wikitech:Cloud_Services_End_User_Terms_of_use" target="_blank" rel="noopener noreferrer">维基媒体云服务最终用户使用条款</a>》。',
      hk: '使用網絡字型顯示罕用字。啟用本選項，視為您同意《<a href="https://wikitech.wikimedia.org/wiki/Wikitech:Cloud_Services_End_User_Terms_of_use" target="_blank" rel="noopener noreferrer">維基媒體雲端服務最終用戶使用條款</a>》。',
      tw: '使用網路字型顯示罕用字。啟用本選項，視為您同意《<a href="https://wikitech.wikimedia.org/wiki/Wikitech:Cloud_Services_End_User_Terms_of_use" target="_blank" rel="noopener noreferrer">維基媒體雲端服務最終使用者條款</a>》。'
    },
    'unihan-load-mode': { cn: '网络字形加载模式', hk: '網絡字型載入模式', tw: '網路字型載入模式' },
    'unihan-load-mode-fallback': { hans: '优先使用系统字形', hant: '優先使用系統字型' },
    'unihan-load-mode-fallback-desc': {
      cn: '仅当系统无法正确显示时获取网络字形。',
      hk: '僅當系統無法正確顯示時取得網絡字型。',
      tw: '僅當系統無法正確顯示時取得網路字型。',
    },
    'unihan-load-mode-always': { hans: '总是覆盖系统字形', hant: '總是覆蓋系統字型' },
    'unihan-load-mode-always-desc': {
      cn: '总是使用网络字形显示罕用字。',
      hk: '總是使用網絡字型顯示罕用字。',
      tw: '總是使用網路字型顯示罕用字。',
    },
    'unihan-preferred-font': { hans: '偏好字体', hant: '偏好字型' },
    'unihan-enable-webfont-to-show-fonts': { cn: '启用网络字形以显示可用字体。', hk: '啟用網絡字型以顯示可用字型。', tw: '啟用網路字型以顯示可用字型。' },
    'unihan-loading-fonts': { hans: '加载可用字体中……', hant: '載入可用字型中……' },
    'unihan-font-load-failed': { cn: '网络字体加载失败。', hk: '網絡字型載入失敗。', tw: '網路字型載入失敗。' },
    'unihan-version': { hans: '版本：', hant: '版本：' },
    'unihan-close': { hans: '关闭', hant: '關閉' },
    'unihan-save': { hans: '确定', hant: '確定' },
    'unihan-help': { hans: '帮助', hant: '說明' },
  })
);

let app: any = null;
let mountPoint: HTMLElement | null = null;

/**
 * 解析 MediaWiki 格式的链接
 */
function parseWikiLink(title: string): { text: string; url: string; isExternal: boolean } {
  // 匹配 [[页面|文本]] 或 [[页面]]
  const wikiLinkMatch = title.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (wikiLinkMatch) {
    const page = wikiLinkMatch[1];
    const text = wikiLinkMatch[2] || page;
    return {
      text,
      url: mw.util.getUrl(page),
      isExternal: false,
    };
  }

  // 匹配 [URL 文本]
  const externalLinkMatch = title.match(/^\[([^\s]+)\s+([^\]]+)\]$/);
  if (externalLinkMatch) {
    return {
      text: externalLinkMatch[2],
      url: externalLinkMatch[1],
      isExternal: true,
    };
  }

  // 纯文本
  return {
    text: title,
    url: '',
    isExternal: false,
  };
}

/**
 * 打开设置对话框
 */
export function openDialog(
  fonts: FontInfo[] | null,
  currentSettings: Settings,
  onSave: (newSettings: Settings) => void,
  onLoadFonts?: () => Promise<FontInfo[]>,
  initialLoadError?: boolean
): void {
  // 四款字体都已按「排除系统通常已有的码位」切片，思源黑体所剩的也都是
  // 系统未必有的字，故不再隐藏。
  const visibleFonts = fonts ?? [];

  // 如果已经有实例，先销毁
  if (app && mountPoint) {
    app.unmount();
    mountPoint.remove();
    app = null;
    mountPoint = null;
  }

  // 创建挂载点
  mountPoint = document.createElement('div');
  document.body.appendChild(mountPoint);

  // 创建 Vue 应用
  app = createMwApp({
    data() {
      return {
        showDialog: true,
        enabled: currentSettings.enabled,
        useWebfont: currentSettings.useWebfont,
        loadMode: currentSettings.loadMode,
        selectedFontId: currentSettings.selectedFont,
        fonts: visibleFonts,
        fontsLoading: false,
        fontsLoaded: fonts !== null,
        fontsLoadError: initialLoadError || false,
        // 原始设置，用于检测变更
        originalSettings: { ...currentSettings },
      };
    },
    watch: {
      useWebfont(newVal: boolean) {
        // 当用户开启网络字形且字体未加载时，加载字体列表
        if (newVal && !this.fontsLoaded && !this.fontsLoading && onLoadFonts) {
          this.loadFonts();
        }
      },
    },
    computed: {
      fontOptions() {
        const lang = mw.config.get('wgUserLanguage');
        const isHans = lang === 'zh-hans' || lang === 'zh-cn';

        return this.fonts.map((font: FontInfo) => ({
          id: font.id,
          label: isHans ? font.name['zh-hans'] : font.name['zh-hant'],
          value: font.id,
          version: font.version,
          title: isHans ? font.title['zh-hans'] : font.title['zh-hant'],
        }));
      },
      // 检测设置是否有变更
      hasChanges() {
        return (
          this.enabled !== this.originalSettings.enabled ||
          this.useWebfont !== this.originalSettings.useWebfont ||
          this.loadMode !== this.originalSettings.loadMode ||
          this.selectedFontId !== this.originalSettings.selectedFont
        );
      },
    },
    methods: {
      async loadFonts() {
        if (!onLoadFonts || this.fontsLoading || this.fontsLoaded) {
          return;
        }
        this.fontsLoading = true;
        this.fontsLoadError = false;
        try {
          this.fonts = await onLoadFonts();
          this.fontsLoaded = true;
        } catch (error) {
          console.error('Failed to load fonts:', error);
          this.fontsLoadError = true;
          this.fontsLoaded = false;
          this.fonts = [];
        } finally {
          this.fontsLoading = false;
        }
      },
      closeDialog() {
        this.showDialog = false;
        setTimeout(() => {
          if (app && mountPoint) {
            app.unmount();
            mountPoint.remove();
            app = null;
            mountPoint = null;
          }
        }, 300);
      },
      saveSettings() {
        const newSettings: Settings = {
          enabled: this.enabled,
          useWebfont: this.useWebfont,
          loadMode: this.loadMode,
          selectedFont: this.selectedFontId,
        };
        onSave(newSettings);
        this.closeDialog();
      },
      parseWikiLink,
    },
    template: `
      <cdx-dialog
        v-model:open="showDialog"
        :title="$root.msg('unihan-settings-title')"
        :close-button-label="$root.msg('unihan-close')"
        :primary-action="{ 
          label: $root.msg('unihan-save'), 
          actionType: 'progressive',
          disabled: !hasChanges 
        }"
        @primary="saveSettings"
      >
        <div style="display: flex; flex-direction: column; gap: 1.5em;">
          <!-- 启用僻字辅助工具 -->
          <div>
            <cdx-toggle-switch v-model="enabled">
              {{ $root.msg('unihan-enable') }}
              <template #description>
                {{ $root.msg('unihan-enable-desc') }}
              </template>
            </cdx-toggle-switch>
          </div>

          <!-- 使用网络字形 -->
          <div>
            <cdx-toggle-switch v-model="useWebfont" :disabled="!enabled">
              {{ $root.msg('unihan-use-webfont') }}
              <template #description>
                <span v-html="$root.msg('unihan-use-webfont-desc')"></span>
              </template>
            </cdx-toggle-switch>
          </div>

          <!-- 网络字形加载模式 -->
          <cdx-field :is-fieldset="true" :disabled="!enabled || !useWebfont">
            <template #label>{{ $root.msg('unihan-load-mode') }}</template>
            <cdx-radio
              v-model="loadMode"
              name="load-mode"
              input-value="fallback"
            >
              {{ $root.msg('unihan-load-mode-fallback') }}
              <template #description>
                {{ $root.msg('unihan-load-mode-fallback-desc') }}
              </template>
            </cdx-radio>
            <cdx-radio
              v-model="loadMode"
              name="load-mode"
              input-value="always"
            >
              {{ $root.msg('unihan-load-mode-always') }}
              <template #description>
                {{ $root.msg('unihan-load-mode-always-desc') }}
              </template>
            </cdx-radio>
          </cdx-field>

          <!-- 偏好字体 -->
          <cdx-field :is-fieldset="true" :disabled="!enabled || !useWebfont">
            <template #label>{{ $root.msg('unihan-preferred-font') }}</template>
            
            <!-- 未启用网络字形时的提示 -->
            <cdx-label v-if="!useWebfont" :disabled="true">
              <template #description>
                {{ $root.msg('unihan-enable-webfont-to-show-fonts') }}
              </template>
            </cdx-label>
            
            <!-- 加载中 -->
            <cdx-label v-else-if="fontsLoading">
              <template #description>
                {{ $root.msg('unihan-loading-fonts') }}
              </template>
            </cdx-label>

            <!-- 字体选项 -->
            <template v-else-if="fontsLoaded && fonts.length > 0">
              <cdx-radio
                v-for="font in fontOptions"
                :key="font.value"
                v-model="selectedFontId"
                name="font-selection"
                :input-value="font.value"
              >
                <a 
                  v-if="parseWikiLink(font.title).url"
                  :href="parseWikiLink(font.title).url" 
                  :target="parseWikiLink(font.title).isExternal ? '_blank' : '_self'"
                  :rel="parseWikiLink(font.title).isExternal ? 'noopener noreferrer' : ''"
                >
                  {{ parseWikiLink(font.title).text }}
                </a>
                <span v-else>{{ parseWikiLink(font.title).text }}</span>
                <template #description>
                  {{ $root.msg('unihan-version') }}{{ font.version }}
                </template>
              </cdx-radio>
            </template>

            <!-- 字体选项加载失败 -->
            <cdx-label v-else>
              <template #description>
                {{ $root.msg('unihan-font-load-failed') }}
              </template>
            </cdx-label>
          </cdx-field>

          <!-- 帮助链接 -->
          <p style="margin: 0;">
            <a :href="$root.wikiUrl('Wikipedia:Unicode扩展汉字')" target="_blank">
              {{ $root.msg('unihan-help') }}
            </a>
          </p>
        </div>
      </cdx-dialog>
    `,
  });

  app.config.globalProperties.msg = mw.msg.bind(mw);
  app.config.globalProperties.wikiUrl = mw.util.getUrl.bind(mw.util);
  app.component('cdx-dialog', CdxDialog);
  app.component('cdx-radio', CdxRadio);
  app.component('cdx-field', CdxField);
  app.component('cdx-label', CdxLabel);
  app.component('cdx-toggle-switch', CdxToggleSwitch);

  app.mount(mountPoint);
}
