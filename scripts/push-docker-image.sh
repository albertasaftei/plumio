if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 2.2.0"
  exit 1
fi

VERSION=$1
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_COMMIT_DATE=$(git show -s --format=%ci HEAD)
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building Plumio version $VERSION..."
echo "Git commit: $GIT_COMMIT"
echo "Git branch: $GIT_BRANCH"
echo "Git commit date: $GIT_COMMIT_DATE"

docker buildx build --build-arg APP_VERSION=$VERSION \
  --build-arg GIT_COMMIT=$GIT_COMMIT \
  --build-arg GIT_BRANCH=$GIT_BRANCH \
  --build-arg "GIT_COMMIT_DATE=$GIT_COMMIT_DATE" \
  --build-arg BUILD_DATE=$BUILD_DATE \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/albertasaftei/plumio:$VERSION \
  -t ghcr.io/albertasaftei/plumio:latest \
  --push "$REPO_ROOT"

echo "Done! Version $VERSION deployed."