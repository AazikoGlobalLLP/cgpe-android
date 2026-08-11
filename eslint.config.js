// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // src/ui/vendor/* is generated, verbatim third-party source (see scripts/vendor-leaflet.mjs).
    ignores: ["dist/*", "src/ui/vendor/*"],
  }
]);
