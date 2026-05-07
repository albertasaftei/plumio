// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, viewport-fit=cover"
          />
          <meta name="theme-color" content="#0a0a0a" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="black-translucent"
          />
          <link rel="icon" href="/favicon-primary.svg" />
          <link
            rel="icon"
            href="/favicon-dark.svg"
            media="(prefers-color-scheme: light)"
          />
          <link
            rel="icon"
            href="/favicon-light.svg"
            media="(prefers-color-scheme: dark)"
          />
          <link rel="apple-touch-icon" href="/web-app-manifest-192x192.png" />
          <link rel="manifest" href="/site.webmanifest" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
