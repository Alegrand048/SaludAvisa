import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saludavisa.app',
  appName: 'SaludAvisa',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.supabase.co',
      '*.supabase.com',
    ],
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#1f2937',
    },
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
