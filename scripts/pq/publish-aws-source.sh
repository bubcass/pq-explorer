#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
source_ref=${1:-HEAD}
source_sha=$(git -C "$repo_root" rev-parse "$source_ref^{commit}")
bucket=pq-explorer-test-716904822267-20261116
source_prefix=aws-build-source/pq-explorer
profile=${AWS_PROFILE:-aws-starter}
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

git -C "$repo_root" archive --format=tar --prefix=site/ "$source_sha" \
  .nvmrc package.json package-lock.json observablehq.config.js scripts/pq src \
  ':(exclude,glob)src/data/pq/**' \
  ':(exclude,glob)src/static/data/pq/**' \
  ':(exclude,glob)src/.observablehq/**' \
  | tar -xf - -C "$temp_dir"

printf '%s\n' "$source_sha" > "$temp_dir/site/AWS_SOURCE_REVISION"
tar -czf "$temp_dir/pq-explorer-aws-source.tar.gz" -C "$temp_dir" site

aws --profile "$profile" --region eu-north-1 --no-cli-pager s3 cp \
  "$temp_dir/pq-explorer-aws-source.tar.gz" \
  "s3://$bucket/$source_prefix/$source_sha.tar.gz" --only-show-errors
aws --profile "$profile" --region eu-north-1 --no-cli-pager s3 cp \
  "$temp_dir/pq-explorer-aws-source.tar.gz" \
  "s3://$bucket/$source_prefix/current.tar.gz" --only-show-errors

echo "Published AWS source revision $source_sha"
