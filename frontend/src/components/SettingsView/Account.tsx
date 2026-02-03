import { createSignal, onMount } from "solid-js";
import { api } from "~/lib/api";

export default function Account() {
  const [username, setUsername] = createSignal<string | null>(null);

  onMount(async () => {
    // Get current username from API
    const currentUsername = await api.getUsername();
    setUsername(currentUsername);
  });

  return (
    <div class="space-y-4">
      <div class="bg-neutral-800 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-white mb-4">Profile</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-300 mb-2">
              Username
            </label>
            <div class="text-neutral-100">{username() || "Loading..."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
