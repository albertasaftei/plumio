import type { EditorProps } from "~/types/Editor.types";

export default function Editor(props: EditorProps) {
  let textareaRef: HTMLTextAreaElement | undefined;

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
    <div class="flex-1 flex flex-col w-5xl max-w-5xl mx-auto bg-neutral-900">
      <textarea
        ref={textareaRef}
        value={props.content}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        class="flex-1 w-full p-3 sm:p-6 bg-neutral-900 text-neutral-100 font-mono text-sm sm:text-base resize-none focus:outline-none"
        placeholder="Start writing your markdown..."
        spellcheck={false}
      />
    </div>
  );
}
