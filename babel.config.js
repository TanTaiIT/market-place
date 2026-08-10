module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 dùng plugin của react-native-worklets. Phải để CUỐI CÙNG.
    plugins: ['react-native-worklets/plugin'],
  };
};
