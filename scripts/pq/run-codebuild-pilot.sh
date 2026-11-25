#!/usr/bin/env bash
set -euo pipefail

aws_pilot() {
  aws --profile aws-starter --region eu-north-1 --no-cli-pager "$@"
}

account=716904822267
project=pq-explorer-publish-pilot
role=PQExplorerCodeBuildPilot
snapshot=$(git rev-parse '463e6e7^{commit}')
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

if [[ "$(aws_pilot sts get-caller-identity --query Account --output text)" != "$account" ]]; then
  echo "The aws-starter profile must authenticate to account $account." >&2
  exit 1
fi

python3 - "$temp_dir" "$account" "$project" "$role" "$snapshot" <<'PY'
import json
from pathlib import Path
import sys

output, account, project, role, snapshot = sys.argv[1:]
bucket = f"arn:aws:s3:::pq-explorer-test-{account}-20261116"
prefix = "insights-pilot/pq-explorer"
log_group = f"arn:aws:logs:eu-north-1:{account}:log-group:/aws/codebuild/{project}"

def save(name, data):
    Path(output, name + ".json").write_text(json.dumps(data))

save("trust", {
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "codebuild.amazonaws.com"},
        "Action": "sts:AssumeRole",
        "Condition": {"StringEquals": {
            "aws:SourceAccount": account,
            "aws:SourceArn": f"arn:aws:codebuild:eu-north-1:{account}:project/{project}",
        }},
    }],
})

save("publish", {
    "Version": "2012-10-17",
    "Statement": [
        {"Effect": "Allow", "Action": "s3:ListBucket", "Resource": bucket,
         "Condition": {"StringLike": {"s3:prefix": [prefix, prefix + "/*"]}}},
        {"Effect": "Allow", "Action": ["s3:PutObject", "s3:AbortMultipartUpload"],
         "Resource": f"{bucket}/{prefix}/*"},
        {"Effect": "Allow", "Action": "cloudfront:CreateInvalidation",
         "Resource": f"arn:aws:cloudfront::{account}:distribution/E18L5O4CYRKV4Y"},
        {"Effect": "Allow", "Action": "logs:CreateLogGroup", "Resource": log_group},
        {"Effect": "Allow", "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
         "Resource": log_group + ":log-stream:*"},
    ],
})

buildspec = f"""version: 0.2
env:
  variables:
    INSIGHTS_TARGET: aws
phases:
  install:
    runtime-versions:
      nodejs: 22
  build:
    commands:
      - git init site
      - cd site
      - git fetch --depth 1 https://github.com/bubcass/pq-explorer.git {snapshot}
      - git checkout --detach FETCH_HEAD
      - npm ci
      - npm run build
      - node scripts/pq/copy-deputy-json-to-dist.js
      - test -s dist/index.html
      - test -s dist/deputies.html
      - test -s dist/constituencies.html
      - test -s dist/parties.html
      - aws s3 sync dist/ s3://pq-explorer-test-{account}-20261116/{prefix}/ --exclude '*.html' --only-show-errors
      - aws s3 sync dist/ s3://pq-explorer-test-{account}-20261116/{prefix}/ --exclude '*' --include '*.html' --only-show-errors
      - aws cloudfront create-invalidation --distribution-id E18L5O4CYRKV4Y --paths '/pq-explorer' '/pq-explorer/*'
"""

save("project", {
    "name": project,
    "source": {"type": "NO_SOURCE", "buildspec": buildspec},
    "artifacts": {"type": "NO_ARTIFACTS"},
    "environment": {
        "type": "LINUX_CONTAINER",
        "image": "aws/codebuild/standard:7.0",
        "computeType": "BUILD_GENERAL1_SMALL",
    },
    "serviceRole": f"arn:aws:iam::{account}:role/{role}",
    "timeoutInMinutes": 10,
    "queuedTimeoutInMinutes": 5,
    "autoRetryLimit": 0,
})
PY

aws_pilot iam create-role --role-name "$role" \
  --assume-role-policy-document "file://$temp_dir/trust.json" --query Role.Arn --output text
aws_pilot iam put-role-policy --role-name "$role" --policy-name PublishPQExplorer \
  --policy-document "file://$temp_dir/publish.json"
aws_pilot codebuild create-project --cli-input-json "file://$temp_dir/project.json" \
  --query project.name --output text
aws_pilot codebuild start-build --project-name "$project" --query build.id --output text
