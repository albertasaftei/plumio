interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function Toggle(props: ToggleProps) {
  return (
    <button
      onClick={() => !props.disabled && props.onChange(!props.enabled)}
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-800 light:focus:ring-offset-white"
      classList={{
        "bg-primary cursor-pointer": props.enabled && !props.disabled,
        "bg-neutral-600 dark:bg-neutral-600 light:bg-neutral-300 cursor-pointer":
          !props.enabled && !props.disabled,
        "opacity-50 cursor-not-allowed": !!props.disabled,
      }}
      aria-checked={props.enabled}
      role="switch"
      type="button"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        classList={{
          "translate-x-6": props.enabled,
          "translate-x-1": !props.enabled,
        }}
      />
    </button>
  );
}
