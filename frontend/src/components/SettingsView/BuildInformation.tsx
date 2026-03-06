const BuildInformation = () => {
  return (
    <div class="space-y-4">
      <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
        <h3 class="text-lg font-semibold text-body mb-4">
          Build Information
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              Version
            </label>
            <div class="text-body">
              {import.meta.env.VITE_APP_VERSION}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              Git Commit
            </label>
            <div class="text-body">
              {import.meta.env.VITE_GIT_COMMIT}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              Git Branch
            </label>
            <div class="text-body">
              {import.meta.env.VITE_GIT_BRANCH}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              Build Date
            </label>
            <div class="text-body">
              {import.meta.env.VITE_BUILD_DATE}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildInformation;
