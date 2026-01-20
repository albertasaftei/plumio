import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { marked } from "marked";
import type { Tokens } from "marked";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import "highlight.js/styles/github-dark.css";

// Register languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Set up custom renderer for code blocks with syntax highlighting
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);
renderer.code = function (token: Tokens.Code) {
  const { text, lang } = token;
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    } catch (err) {
      console.error(err);
    }
  }
  return originalCode(token);
};

marked.use({ renderer });

import type { EditorProps } from "~/types/Editor.types";

export default function Editor(props: EditorProps) {
  const [viewMode, setViewMode] = createSignal<"split" | "editor" | "preview">(
    "split",
  );
  let textareaRef: HTMLTextAreaElement | undefined;

  const renderMarkdown = (): string => {
    try {
      return marked.parse(props.content, { async: false }) as string;
    } catch (error) {
      console.error("Markdown parsing error:", error);
      return "<p>Error parsing markdown</p>";
    }
  };

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLTextAreaElement;
    props.onChange(target.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue =
        props.content.substring(0, start) + "  " + props.content.substring(end);
      props.onChange(newValue);

      // Set cursor position after the inserted tab
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div class="flex-1 flex flex-col bg-neutral-900">
      {/* Toolbar */}
      <div class="h-12 border-b border-neutral-800 flex items-center px-4 gap-2 bg-neutral-950">
        <div class="flex items-center gap-1 border border-neutral-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("editor")}
            class={`px-3 py-1.5  transition-colors ${
              viewMode() === "editor"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            <div class="i-carbon-edit inline-block w-4 h-4 mr-1" />
            Editor
          </button>
          <button
            onClick={() => setViewMode("split")}
            class={`px-3 py-1.5  transition-colors ${
              viewMode() === "split"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            <div class="i-carbon-split-screen inline-block w-4 h-4 mr-1" />
            Split
          </button>
          <button
            onClick={() => setViewMode("preview")}
            class={`px-3 py-1.5  transition-colors ${
              viewMode() === "preview"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            <div class="i-carbon-view inline-block w-4 h-4 mr-1" />
            Preview
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div class="flex-1 flex overflow-hidden">
        {/* Text Editor */}
        <Show when={viewMode() !== "preview"}>
          <div
            class={`flex-1 flex flex-col ${viewMode() === "split" ? "border-r border-neutral-800" : ""}`}
          >
            <textarea
              ref={textareaRef}
              value={props.content}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              class="flex-1 w-full p-6 bg-neutral-900 text-neutral-100 font-mono  resize-none focus:outline-none"
              placeholder="Start writing your markdown..."
              spellcheck={false}
            />
          </div>
        </Show>

        {/* Preview */}
        <Show when={viewMode() !== "editor"}>
          <div class="flex-1 overflow-auto">
            <div
              class="prose prose-invert max-w-none p-6 prose-pre:bg-neutral-950 prose-pre:border prose-pre:border-neutral-800"
              innerHTML={renderMarkdown()}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
