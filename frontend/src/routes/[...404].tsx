import { A } from "@solidjs/router";
import Logo from "~/components/Logo";

export default function NotFound() {
  return (
    <main class="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] p-4">
      <div class="flex flex-col items-center gap-6 max-w-sm w-full text-center">
        <div class="text-8xl font-bold text-[var(--color-bg-elevated)] select-none leading-none">
          404
        </div>
        <div class="flex flex-col gap-2">
          <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">
            Page not found
          </h1>
          <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div class="w-full h-px bg-[var(--color-border-subtle)]" />

        <div class="flex items-center gap-3 w-full">
          <A
            href="/"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-medium transition-colors duration-150"
          >
            <span class="i-carbon-home w-4 h-4" />
            Go home
          </A>
          <button
            onClick={() => history.back()}
            class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] text-sm font-medium transition-colors duration-150"
          >
            <span class="i-carbon-arrow-left w-4 h-4" />
            Go back
          </button>
        </div>
      </div>
    </main>
  );
}
