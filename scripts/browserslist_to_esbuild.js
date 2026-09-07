/**
 * Convert the browserslist field in package.json to esbuild compatible array of browsers.
 * From: https://github.com/marcofugaro/browserslist-to-esbuild, licensed under MIT.
 *
 * @param {string[]|string} [browserslistConfig]
 * @returns {string[]}
 */
import browserslist from 'browserslist';

export default function browserslistToEsbuild(browserslistConfig) {
  const esbuildTargets = browserslist(browserslistConfig)
    .map((browser) => {
      const [browserName, browserVersion] = browser.split(' ');

      if (browserName === 'and_chr') {
        return 'chrome' + browserVersion;
      } else if (browserName === 'and_ff') {
        return 'firefox' + browserVersion;
      } else if (browserName === 'ie') {
        return 'ie' + browserVersion;
      } else if (browserName === 'ios_saf') {
        return 'ios' + browserVersion;
      } else if (browserName === 'op_mini') {
        return null;
      } else if (browserName === 'op_mob') {
        return 'opera' + browserVersion;
      } else if (browserName === 'and_qq') {
        return null;
      } else if (browserName === 'and_uc') {
        return null;
      } else if (browserName === 'samsung') {
        return null;
      } else if (browserName === 'kaios') {
        return null;
      } else {
        return browserName + browserVersion;
      }
    })
    .filter(Boolean);

  return esbuildTargets;
}
