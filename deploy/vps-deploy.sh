#!/usr/bin/env sh
set -eu

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <image> <version> <commit-sha>" >&2
  exit 64
fi

image=$1
version=$2
commit_sha=$3
deploy_dir=${DEPLOY_DIR:-/opt/antlysis-loyalty}

case "$image" in
  ghcr.io/aminhaiqal/loyalty-program-assessment:sha-[0-9a-f]*) ;;
  *) echo "Refusing unexpected image reference: $image" >&2; exit 64 ;;
esac
case "$version" in
  *[!0-9A-Za-z.+-]*|'') echo "Refusing invalid version: $version" >&2; exit 64 ;;
esac
case "$commit_sha" in
  *[!0-9a-f]*|'') echo "Refusing invalid commit SHA" >&2; exit 64 ;;
esac

cd "$deploy_dir"
test -f .env
test -f compose.yaml
test -f compose.vps.yaml

get_env() {
  sed -n "s/^$1=//p" .env | tail -n 1
}

put_env() {
  key=$1
  value=$2
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*$|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

previous_image=$(get_env APP_IMAGE)
previous_version=$(get_env APP_VERSION)
previous_commit_sha=$(get_env APP_COMMIT_SHA)
previous_image=${previous_image:-loyalty-program:local}
previous_version=${previous_version:-dev}
previous_commit_sha=${previous_commit_sha:-local}

rollback() {
  echo "Deployment health check failed; restoring ${previous_version}." >&2
  put_env APP_IMAGE "$previous_image"
  put_env APP_VERSION "$previous_version"
  put_env APP_COMMIT_SHA "$previous_commit_sha"
  docker compose --env-file .env -f compose.yaml -f compose.vps.yaml up -d --no-build --remove-orphans
}

put_env APP_IMAGE "$image"
put_env APP_VERSION "$version"
put_env APP_COMMIT_SHA "$commit_sha"

docker compose --env-file .env -f compose.yaml -f compose.vps.yaml pull app app-init
if ! docker compose --env-file .env -f compose.yaml -f compose.vps.yaml up -d --no-build --remove-orphans --wait --wait-timeout 120; then
  rollback
  exit 1
fi

health=$(curl --fail --silent --show-error http://127.0.0.1:3102/api/health) || {
  rollback
  exit 1
}

printf '%s' "$health" | grep -F "\"version\":\"${version}\"" >/dev/null || {
  rollback
  exit 1
}
printf '%s' "$health" | grep -F "\"commit\":\"${commit_sha}\"" >/dev/null || {
  rollback
  exit 1
}

echo "Deployed ${version} (${commit_sha}) successfully."
