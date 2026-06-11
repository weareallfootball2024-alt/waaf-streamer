const { withSettingsGradle, withProjectBuildGradle } = require('@expo/config-plugins');

function addJitpack(content) {
  if (content.includes('jitpack.io')) return content;
  return content.replace(
    /repositories\s*\{/,
    `repositories {
        maven { url 'https://jitpack.io' }`,
  );
}

function addLocalMaven(content) {
  if (content.includes('local-maven')) return content;
  return content.replace(
    /repositories\s*\{/,
    `repositories {
        maven { url uri("\${rootDir}/local-maven") }`,
  );
}

const KOTLIN_FIX_BLOCK = `
subprojects { subproject ->
  subproject.configurations.configureEach {
    resolutionStrategy {
      force 'org.jetbrains.kotlin:kotlin-stdlib:2.1.20'
      force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.1.20'
      force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.1.20'
    }
  }
  subproject.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    compilerOptions {
      freeCompilerArgs.add("-Xskip-metadata-version-check")
    }
  }
}
`;

function addKotlinCompatFix(content) {
  if (content.includes('Xskip-metadata-version-check')) return content;
  return content.replace(
    /apply plugin: "expo-root-project"/,
    `${KOTLIN_FIX_BLOCK}\napply plugin: "expo-root-project"`,
  );
}

module.exports = function withJitpack(config) {
  config = withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = addJitpack(cfg.modResults.contents);
    return cfg;
  });
  config = withProjectBuildGradle(config, (cfg) => {
    let contents = addJitpack(cfg.modResults.contents);
    contents = addLocalMaven(contents);
    contents = addKotlinCompatFix(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });
  return config;
};