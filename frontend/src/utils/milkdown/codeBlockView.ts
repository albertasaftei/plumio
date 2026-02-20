import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";

const LANGUAGES = [
  { value: "", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "yaml", label: "YAML" },
  { value: "toml", label: "TOML" },
  { value: "markdown", label: "Markdown" },
  { value: "graphql", label: "GraphQL" },
  { value: "xml", label: "XML" },
  { value: "lua", label: "Lua" },
  { value: "r", label: "R" },
  { value: "dart", label: "Dart" },
  { value: "elixir", label: "Elixir" },
  { value: "scala", label: "Scala" },
  { value: "haskell", label: "Haskell" },
];

/**
 * ProseMirror NodeView plugin for code blocks.
 *
 * Renders code blocks with a header toolbar containing:
 * - A clickable language label (click to edit, Enter to confirm)
 * - A copy button (appears on hover)
 *
 * Using a NodeView prevents the infinite-loop problem that occurs when
 * injecting DOM into ProseMirror-managed nodes via MutationObserver.
 */
export const codeBlockViewPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey("codeBlockView"),
    props: {
      nodeViews: {
        code_block(initialNode, view, getPos) {
          let currentNode = initialNode;

          // ── Wrapper ──
          const wrapper = document.createElement("div");
          wrapper.className = "code-block-wrapper";

          // ── Header toolbar (non-editable) ──
          const header = document.createElement("div");
          header.contentEditable = "false";
          header.className = "code-block-header";

          // Language label
          const langLabel = document.createElement("span");
          langLabel.className = "code-block-lang-label";
          const initLang = initialNode.attrs.language || "";
          langLabel.textContent =
            LANGUAGES.find((l) => l.value === initLang)?.label ||
            initLang ||
            "Plain Text";
          langLabel.title = "Click to change language";

          langLabel.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            const select = document.createElement("select");
            select.className = "code-block-lang-select";

            const currentLang = currentNode.attrs.language || "";

            for (const lang of LANGUAGES) {
              const opt = document.createElement("option");
              opt.value = lang.value;
              opt.textContent = lang.label;
              if (lang.value === currentLang) opt.selected = true;
              select.appendChild(opt);
            }

            // If the current language isn't in our list, add it as an option
            if (
              currentLang &&
              !LANGUAGES.some((l) => l.value === currentLang)
            ) {
              const opt = document.createElement("option");
              opt.value = currentLang;
              opt.textContent = currentLang;
              opt.selected = true;
              select.insertBefore(opt, select.firstChild?.nextSibling || null);
            }

            let finished = false;
            const applyLanguage = () => {
              if (finished) return;
              finished = true;
              const newLang = select.value;
              const displayLabel =
                LANGUAGES.find((l) => l.value === newLang)?.label ||
                newLang ||
                "Plain Text";
              langLabel.textContent = displayLabel;
              if (select.parentElement === header) {
                header.replaceChild(langLabel, select);
              }
              const pos = getPos();
              if (pos != null) {
                view.dispatch(
                  view.state.tr.setNodeMarkup(pos, undefined, {
                    ...currentNode.attrs,
                    language: newLang,
                  }),
                );
              }
            };

            select.onchange = () => applyLanguage();
            select.onblur = () => applyLanguage();
            select.onkeydown = (kev) => {
              if (kev.key === "Escape") {
                kev.preventDefault();
                finished = true;
                if (select.parentElement === header) {
                  header.replaceChild(langLabel, select);
                }
              }
            };

            header.replaceChild(select, langLabel);
            select.focus();
          };

          // Copy button
          const copyBtn = document.createElement("button");
          copyBtn.className = "code-block-copy-btn";
          copyBtn.textContent = "Copy";
          copyBtn.onmousedown = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          };
          copyBtn.onclick = async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const text = code.textContent;
            try {
              await navigator.clipboard.writeText(text || "");
              copyBtn.textContent = "Copied!";
              copyBtn.classList.add("copied");
              setTimeout(() => {
                copyBtn.textContent = "Copy";
                copyBtn.classList.remove("copied");
              }, 2000);
            } catch (err) {
              console.error("Failed to copy:", err);
            }
          };

          header.appendChild(langLabel);
          header.appendChild(copyBtn);

          // ── Pre / Code elements (ProseMirror content goes in <code>) ──
          const pre = document.createElement("pre");
          const code = document.createElement("code");

          if (initialNode.attrs.language) {
            pre.dataset.language = initialNode.attrs.language;
            code.className = `language-${initialNode.attrs.language}`;
          }

          pre.appendChild(code);

          wrapper.appendChild(header);
          wrapper.appendChild(pre);

          return {
            dom: wrapper,
            contentDOM: code,

            update(updatedNode) {
              if (updatedNode.type.name !== "code_block") return false;

              currentNode = updatedNode;
              const lang = updatedNode.attrs.language || "";
              langLabel.textContent =
                LANGUAGES.find((l) => l.value === lang)?.label ||
                lang ||
                "Plain Text";

              if (lang) {
                pre.dataset.language = lang;
                code.className = `language-${lang}`;
              } else {
                delete pre.dataset.language;
                code.className = "";
              }
              return true;
            },

            stopEvent(event) {
              // Don't let ProseMirror handle events on our toolbar elements
              if (header.contains(event.target as Node)) return true;
              return false;
            },

            ignoreMutation(mutation) {
              // Ignore our toolbar DOM changes
              if (header.contains(mutation.target)) return true;
              return false;
            },

            destroy() {
              // Nothing to clean up
            },
          };
        },
      },
    },
  });
});
