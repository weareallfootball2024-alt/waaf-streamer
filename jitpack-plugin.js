const { withSettingsGradle } = require('@expo/config-plugins');

module.exports = function withJitpack(config) {
  return withSettingsGradle(config, (config) => {
    if (!config.modResults.contents.includes('https://jitpack.io')) {
      config.modResults.contents = config.modResults.contents.replace(
        /repositories\s*{/g,
        `repositories {
        maven { url 'https://jitpack.io' }`
      );
    }
    return config;
  });
};