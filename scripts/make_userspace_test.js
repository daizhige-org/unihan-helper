#!/usr/bin/env node
/**
 * 把 dist/ 的构建产物包装成可贴进自己名字空间的单文件测试脚本。
 *
 * 小工具代码必须放在 MediaWiki: 名字空间，User: 空间不行；而产物是 package
 * 型模块，用了 require('ext.gadget.HanAssist')，直接贴进 common.js 会因为
 * require 未定义而报错。这里用 mw.loader.using(deps).then(require => …)
 * 拿到一个可用的 require，再把产物放进该闭包里执行。
 *
 *   node scripts/make_userspace_test.js > /tmp/unihan-test.js
 *
 * 把输出贴到 User:<你>/unihan-test.js，再在 User:<你>/common.js 里加：
 *   mw.loader.load('/w/index.php?title=User:<你>/unihan-test.js&action=raw&ctype=text/javascript');
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const js = fs.readFileSync(path.join(ROOT, 'dist/Gadget-unihan-helper.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'dist/Gadget-unihan-helper.css'), 'utf8');

// 产物自带 // <nowiki> … // </nowiki>，包装后由外层统一提供，去掉内层的
const body = js.replace(/^\/\/ <nowiki>$/m, '').replace(/^\/\/ <\/nowiki>$/m, '');

process.stdout.write(`// <nowiki>
/**
 * unihan-helper 的用户空间测试版 —— 由 scripts/make_userspace_test.js 生成，请勿手改。
 *
 * 与正式小工具的差别：
 *   - 设置对话框未接入。正式版经 require('ext.gadget.unihan-helper-settings')
 *     取用，而那个模块依赖 ext.gadget.unihan-helper，一旦加载会把 wiki 上
 *     已部署的旧版一并拉起来跑，污染测试。故此处点「设置」只会在控制台提示。
 *   - 改用下面的控制台命令切换字体与加载模式，设置存在同一个 localStorage 键，
 *     与正式版通用：
 *         unihanTest.font('JigmoTC')      // Plangothic | JigmoTC | WenJinMincho | SourceHanSans
 *         unihanTest.mode('fallback')     // always | fallback
 *         unihanTest.off()                // 关掉网络字形
 *     改完刷新页面生效。
 */
( function () {
\t'use strict';

\tvar KEY = 'unihan-settings';

\t// 首次运行给一份便于观察的默认设置：启用、用网络字形、总是覆盖系统字形
\tif ( !localStorage.getItem( KEY ) ) {
\t\tlocalStorage.setItem( KEY, JSON.stringify( {
\t\t\tenabled: true, useWebfont: true, loadMode: 'always', selectedFont: 'Plangothic'
\t\t} ) );
\t}

\tfunction patch( kv ) {
\t\tvar s = JSON.parse( localStorage.getItem( KEY ) || '{}' );
\t\tObject.keys( kv ).forEach( function ( k ) { s[ k ] = kv[ k ]; } );
\t\tlocalStorage.setItem( KEY, JSON.stringify( s ) );
\t\tconsole.log( '[unihan-test] 已保存', s, '——刷新页面生效' );
\t}
\twindow.unihanTest = {
\t\tfont: function ( id ) { patch( { selectedFont: id, useWebfont: true, enabled: true } ); },
\t\tmode: function ( m ) { patch( { loadMode: m } ); },
\t\toff: function () { patch( { useWebfont: false } ); },
\t\tsettings: function () { return JSON.parse( localStorage.getItem( KEY ) || '{}' ); }
\t};

\t// 与 .gadgetdefinition 的 dependencies 保持一致
\tvar DEPS = [ 'ext.gadget.HanAssist', 'mediawiki.cookie', 'mediawiki.util', 'mediawiki.notification' ];

\tmw.loader.using( DEPS ).then( function ( require ) {
\t\tmw.util.addCSS( ${JSON.stringify(css)} );

\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;

\t\t// 设置模块不接入，见文件头说明
\t\tvar realRequire = require;
\t\trequire = function ( name ) {
\t\t\tif ( name === 'ext.gadget.unihan-helper-settings' ) {
\t\t\t\treturn { openDialog: function () {
\t\t\t\t\tconsole.warn( '[unihan-test] 用户空间测试版未接入设置对话框，' +
\t\t\t\t\t\t'请用 unihanTest.font(…) / unihanTest.mode(…) 切换。' );
\t\t\t\t} };
\t\t\t}
\t\t\treturn realRequire( name );
\t\t};

${body.split('\n').map((l) => (l ? '\t\t' + l : '')).join('\n')}

\t\tconsole.log( '[unihan-test] 已加载。当前设置：', window.unihanTest.settings() );
\t} ).catch( function ( e ) {
\t\tconsole.error( '[unihan-test] 依赖加载失败：', e );
\t} );
}() );
// </nowiki>
`);
