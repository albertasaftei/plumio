import { createSignal } from "solid-js";

const VIM_MODE_KEY = "plumio-vim-mode";

function readVimMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(VIM_MODE_KEY) === "true";
}

const [vimMode, setVimModeSignal] = createSignal<boolean>(readVimMode());

export function getVimMode(): boolean {
  return vimMode();
}

export function setVimMode(enabled: boolean): void {
  localStorage.setItem(VIM_MODE_KEY, enabled ? "true" : "false");
  setVimModeSignal(enabled);
}
