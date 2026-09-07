export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-standard-less',
    'stylelint-prettier/recommended',
  ],
  plugins: ['stylelint-less', 'stylelint-no-unsupported-browser-features'],
  rules: {
    'plugin/no-unsupported-browser-features': [
      true,
      {
        severity: 'warning',
      },
    ],
    'selector-class-pattern': null,
    // Codex 设计令牌形如 --color-base--hover，带双连字符修饰符
    'custom-property-pattern': null,
  },
};
