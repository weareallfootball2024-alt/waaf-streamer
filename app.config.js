/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const vkAppId = process.env.EXPO_PUBLIC_VK_APP_ID;
const schemes = ['waafstreamer'];
if (vkAppId) {
  schemes.push(`vk${vkAppId}`);
}

module.exports = {
  expo: {
    ...appJson.expo,
    scheme: schemes.length === 1 ? schemes[0] : schemes,
  },
};
