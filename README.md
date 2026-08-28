# Unihan Helper

中文维基百科僻字模板Webfont显示和提示小工具。

## 特性

- 为生僻字提供网络字体支持，字体分片来自 [webfont-zh-static](https://tools-static.wmflabs.org/webfont-zh-static/)：
  每 32 个连续码位预先切成一个 woff2 分片，浏览器按 `unicode-range` 只下载页面上真正出现的那几片。
  分片是静态产物，取字体不经过任何服务端进程。
- 与其他MediaWiki工具统一的Codex弹窗外观
- 自定义设置与多种字体选择
- 动态豆腐块算法（WIP）

## 开发

### 安装依赖

```bash
pnpm install
```

### 构建产物

```bash
pnpm run build
```

### 代码检查

```bash
pnpm run lint
pnpm run lint:fix
```

## 部署方法
因为构建目标为ES2017，小工具兼容的最低MediaWiki版本为[1.45.0-wmf.6](https://www.mediawiki.org/wiki/Project:Tech_News#Tech_News:_2025-23)。仓库中含有两个包，unihan-helper包含了小工具除设置窗口外的所有代码；unihan-helper-settings提供的设置窗口在需要时动态加载。

在MediaWiki:Gadgets-definition中加入：
```
* unihan-helper[ResourceLoader|package|dependencies=ext.gadget.HanAssist]|unihan-helper.js|unihan-helper.css
* unihan-helper-settings[ResourceLoader|package|hidden|dependencies=ext.gadget.HanAssist,ext.gadget.unihan-helper,vue,@wikimedia/codex]|unihan-helper-settings.js
```
复制 `dist` 目录下的构建产物。

## 字体

| id | font-family | 授权 |
| --- | --- | --- |
| `Plangothic` | Plangothic | SIL OFL 1.1 |
| `JigmoTC` | Jigmo TC | CC0 1.0 |
| `WenJinMincho` | WenJinMincho | SIL OFL 1.1 |
| `SourceHanSans` | Source Han Sans | SIL OFL 1.1 |

四款均已按「排除系统通常已有的码位」切片。所选字体缺字时，会按其 `fallback` 链
回落到其余字体——例如 Plangothic 未收扩展 A 区的 `䓪`、`㐀`，由 Jigmo TC 补上。

## 鸣谢
- 感谢[diskdance](https://github.com/diskdance)阁下创作的卓越的[跨语言链接增强小工具](https://github.com/wikimedia-gadgets/ilhpp)，为本项目的架构、实现提供了启发，也使本人受益良多。

## 授权协议
GNU GPL-3.0
