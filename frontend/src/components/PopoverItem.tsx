import React from "react";
import { JSX } from "solid-js";

interface PopoverItemProps {
  onClick: (e: MouseEvent) => void;
  children: JSX.Element;
}

const PopoverItem = ({ onClick, children }: PopoverItemProps) => {
  return (
    <button
      onClick={onClick}
      class="w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center gap-2 cursor-pointer"
    >
      {children}
    </button>
  );
};

export default PopoverItem;
