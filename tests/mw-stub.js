/**
 * 供煙霧測試用的最小 MediaWiki 環境
 *
 * 只模擬小工具真正用到的 mw.* 與 ResourceLoader require，讓 dist/ 裡的
 * 建置產物能在普通頁面上執行。設定模組以樁取代：openDialog 的參數與
 * onSave 回呼記錄在 window 上，由測試腳本直接呼叫。
 */
(function () {
  const messages = {};
  // 以繁體優先的選擇函式模擬 HanAssist（wgUserLanguage 為 zh-tw）
  const pick = (c) => c.hant ?? c.tw ?? c.hk ?? c.hans ?? c.cn ?? c.other ?? Object.values(c)[0];
  const HanAssist = {
    conv: pick,
    batchConv: (dict) =>
      Object.fromEntries(
        Object.entries(dict).map(([k, v]) => [k, typeof v === 'string' ? v : pick(v)])
      ),
  };

  window.__openDialogCalls = [];
  window.__onSave = null;
  const settingsModule = {
    openDialog(fonts, settings, onSave) {
      window.__openDialogCalls.push({ fonts, settings });
      window.__onSave = onSave;
    },
  };

  const rlRequire = (name) => {
    if (name === 'ext.gadget.HanAssist') return HanAssist;
    if (name === 'ext.gadget.unihan-helper-settings') return settingsModule;
    throw new Error('unknown module ' + name);
  };

  // 建置產物為 CJS 包裝
  window.require = rlRequire;
  window.module = { exports: {} };
  window.exports = window.module.exports;

  const hooks = {};
  window.mw = {
    messages: { set: (o) => Object.assign(messages, o) },
    msg: (k) => messages[k] ?? '<' + k + '>',
    config: { get: (k) => ({ wgUserLanguage: 'zh-tw' })[k] },
    util: {
      getParamValue: () => null,
      getUrl: (t) => '/wiki/' + t,
      addPortletLink(portlet, href, text, id) {
        const ul = document.querySelector('#' + portlet + ' ul');
        if (!ul) return null;
        const li = document.createElement('li');
        li.id = id;
        const a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        li.appendChild(a);
        ul.appendChild(li);
        return li;
      },
    },
    cookie: { get: () => null, set: () => {} },
    notify: () => {},
    loader: { using: async () => rlRequire },
    // 與 mw.hook 一樣是「記憶型」：晚註冊的處理器會立即收到最後一次 fire 的參數
    hook(name) {
      const h = hooks[name] ?? (hooks[name] = { handlers: [], last: undefined });
      return {
        add(fn) {
          h.handlers.push(fn);
          if (h.last !== undefined) fn(...h.last);
          return this;
        },
        fire(...args) {
          h.last = args;
          h.handlers.forEach((fn) => fn(...args));
          return this;
        },
      };
    },
  };

  // 模擬 mediawiki.page.ready 已先於小工具觸發過一次
  window.mw.hook('wikipage.content').fire([document.getElementById('mw-content-text')]);
})();
