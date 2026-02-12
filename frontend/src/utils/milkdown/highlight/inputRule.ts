import { markRule } from "@milkdown/prose";
import { $inputRule } from "@milkdown/utils";
import { markSchema } from "./markSchema";

export const markInputRule = $inputRule((ctx) => {
  return markRule(
    /(?:\=\=)(?:\{([^}]+)\})?([^=]+)(?:\=\=)$/,
    markSchema.type(ctx),
    {
      getAttr: (match) => {
        const color = match[1];
        return {
          color: color || null,
        };
      },
    },
  );
});
