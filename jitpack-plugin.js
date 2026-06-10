const { withSettingsGradle, withProjectBuildGradle } = require('@expo/config-plugins');

function addJitpack(content) {
  if (content.includes('jitpack.io')) return content;
  return content.replace(
    /repositories\s*\{/,
    `repositories {
        maven { url 'https://jitpack.io' }`,
  );
}

module.exports = function withJitpack(config) {
  config = withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = addJitpack(cfg.modResults.contents);
    return cfg;
  });
  config = withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addJitpack(cfg.modResults.contents);
    return cfg;
  });
  return config;
};