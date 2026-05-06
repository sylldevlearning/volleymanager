const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/metro-plugin');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');

module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './tamagui.config.ts',
});
