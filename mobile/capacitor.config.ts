import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.plumio.mobile",
  appName: "Plumio",
  webDir: "dist-cap",
  // No server.url — the connect screen determines the target server at runtime.
  // After the user provides a server URL, the WebView navigates to it.
  server: {
    // Allow navigating to any URL within the WebView (the user provides
    // the server URL at runtime, so we can't restrict to a known domain).
    allowNavigation: ["*"],
    // Allow cleartext (HTTP) traffic for local network / development use.
    // Self-hosters often run on http://192.168.x.x:3000 or http://localhost:3000.
    cleartext: true,
  },
  android: {
    // Allow mixed content so the secure WebView origin can fetch HTTP URLs.
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
    },
  },
};

export default config;
