/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    scheme: 'waafstreamer',
  },
};
