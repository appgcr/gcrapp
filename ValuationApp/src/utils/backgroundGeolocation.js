import { registerPlugin } from '@capacitor/core';

// One shared instance — registering the native plugin twice logs an error on Android
export const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
