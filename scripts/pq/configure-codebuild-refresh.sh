#!/usr/bin/env bash
set -euo pipefail

aws_refresh() {
  aws --profile "${AWS_PROFILE:-aws-starter}" --region eu-north-1 --no-cli-pager "$@"
}

project=pq-explorer-publish-pilot
schedule=pq-explorer-daily-refresh
role=PQExplorerRefreshScheduler
build_role=PQExplorerCodeBuildPilot
bucket=pq-explorer-test-716904822267-20261116
source_key=aws-build-source/pq-explorer/current.tar.gz
account=$(aws_refresh sts get-caller-identity --query Account --output text)
if [[ "$account" != 716904822267 ]]; then
  echo "Expected the PQ Explorer pilot AWS account." >&2
  exit 1
fi

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
aws_refresh codebuild batch-get-projects --names "$project" --output json > "$work_dir/current.json"

python3 - "$work_dir" "$account" "$project" "$schedule" "$role" "$build_role" "$bucket" "$source_key" <<'PY'
import json
import sys
from pathlib import Path

directory, account, project, schedule, role, build_role, bucket, source_key = sys.argv[1:]
directory = Path(directory)

def save(filename, value):
    (directory / filename).write_text(json.dumps(value))

projects = json.loads((directory / "current.json").read_text())["projects"]
if len(projects) != 1 or projects[0]["source"]["type"] != "NO_SOURCE":
    raise SystemExit("Expected the existing CodeBuild pilot with an inline buildspec.")

source = projects[0]["source"]
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
      - mkdir -p /tmp/pq-explorer-source
      - aws s3 cp s3://{bucket}/{source_key} /tmp/pq-explorer-source.tar.gz
      - tar -xzf /tmp/pq-explorer-source.tar.gz -C /tmp/pq-explorer-source --strip-components=1
      - cd /tmp/pq-explorer-source
      - echo "AWS site source revision $(cat AWS_SOURCE_REVISION)"
      - npm ci
      - npm run build:data
      - npm run build
      - node scripts/pq/copy-deputy-json-to-dist.js
      - test -s dist/index.html
      - test -s dist/deputies.html
      - test -s dist/constituencies.html
      - test -s dist/parties.html
      - aws s3 sync dist/ s3://{bucket}/insights-pilot/pq-explorer/ --exclude '*.html' --only-show-errors
      - aws s3 sync dist/ s3://{bucket}/insights-pilot/pq-explorer/ --exclude '*' --include '*.html' --only-show-errors
      - aws cloudfront create-invalidation --distribution-id E18L5O4CYRKV4Y --paths '/pq-explorer' '/pq-explorer/*'
"""
save("project.json", {"name": project, "source": {**source, "buildspec": buildspec}})

region = "eu-north-1"
project_arn = f"arn:aws:codebuild:{region}:{account}:project/{project}"
bucket_arn = f"arn:aws:s3:::{bucket}"
log_group = f"arn:aws:logs:{region}:{account}:log-group:/aws/codebuild/{project}"
save("publish.json", {
    "Version": "2012-10-17",
    "Statement": [
        {"Effect": "Allow", "Action": "s3:ListBucket", "Resource": bucket_arn,
         "Condition": {"StringLike": {"s3:prefix": ["insights-pilot/pq-explorer", "insights-pilot/pq-explorer/*"]}}},
        {"Effect": "Allow", "Action": ["s3:PutObject", "s3:AbortMultipartUpload"],
         "Resource": f"{bucket_arn}/insights-pilot/pq-explorer/*"},
        {"Effect": "Allow", "Action": "s3:GetObject",
         "Resource": f"{bucket_arn}/{source_key}"},
        {"Effect": "Allow", "Action": "cloudfront:CreateInvalidation",
         "Resource": f"arn:aws:cloudfront::{account}:distribution/E18L5O4CYRKV4Y"},
        {"Effect": "Allow", "Action": "logs:CreateLogGroup", "Resource": log_group},
        {"Effect": "Allow", "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
         "Resource": log_group + ":log-stream:*"},
    ],
})
group_arn = f"arn:aws:scheduler:{region}:{account}:schedule-group/default"
save("trust.json", {
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "scheduler.amazonaws.com"},
        "Action": "sts:AssumeRole",
        "Condition": {"StringEquals": {
            "aws:SourceAccount": account,
            "aws:SourceArn": group_arn,
        }},
    }],
})
save("policy.json", {
    "Version": "2012-10-17",
    "Statement": [{"Effect": "Allow", "Action": "codebuild:StartBuild", "Resource": project_arn}],
})
save("schedule.json", {
    "Name": schedule,
    "ScheduleExpression": "cron(0 12 * * ? *)",
    "ScheduleExpressionTimezone": "Europe/Dublin",
    "FlexibleTimeWindow": {"Mode": "OFF"},
    "Target": {
        "Arn": "arn:aws:scheduler:::aws-sdk:codebuild:startBuild",
        "RoleArn": f"arn:aws:iam::{account}:role/{role}",
        "Input": json.dumps({"ProjectName": project}),
    },
})
PY

aws_refresh codebuild update-project --cli-input-json "file://$work_dir/project.json" --query project.name
aws_refresh iam put-role-policy --role-name "$build_role" --policy-name PublishPQExplorer \
  --policy-document "file://$work_dir/publish.json"
if ! aws_refresh iam get-role --role-name "$role" > /dev/null 2> "$work_dir/role-error"; then
  if ! rg -q 'NoSuchEntity' "$work_dir/role-error"; then
    cat "$work_dir/role-error" >&2
    exit 1
  fi
  aws_refresh iam create-role --role-name "$role" \
    --assume-role-policy-document "file://$work_dir/trust.json" --query Role.Arn
fi
aws_refresh iam put-role-policy --role-name "$role" --policy-name StartPQExplorerBuild \
  --policy-document "file://$work_dir/policy.json"

schedule_action=update-schedule
if ! aws_refresh scheduler get-schedule --name "$schedule" > /dev/null 2> "$work_dir/schedule-error"; then
  if ! rg -q 'ResourceNotFoundException' "$work_dir/schedule-error"; then
    cat "$work_dir/schedule-error" >&2
    exit 1
  fi
  schedule_action=create-schedule
fi
aws_refresh scheduler "$schedule_action" --cli-input-json "file://$work_dir/schedule.json"
if [[ "${1:-}" != "--skip-build" ]]; then
  aws_refresh codebuild start-build --project-name "$project" --query build.id --output text
fi
