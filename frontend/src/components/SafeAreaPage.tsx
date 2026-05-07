import type { JSX } from "solid-js";

/**
 * Wrapper for full-screen pages (login, register, etc.) that need safe-area
 * inset padding on notched/home-indicator devices (iOS/Android via Capacitor).
 * Resolves to 0px on desktop — no visual difference there.
 */
export default function SafeAreaPage(props: {
  children: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={`min-h-screen bg-base flex items-center justify-center ${props.class ?? ""}`}
      style="padding-top: calc(env(safe-area-inset-top, 0px) + 1rem); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem); padding-left: max(env(safe-area-inset-left, 0px), 1rem); padding-right: max(env(safe-area-inset-right, 0px), 1rem)"
    >
      {props.children}
    </div>
  );
}
