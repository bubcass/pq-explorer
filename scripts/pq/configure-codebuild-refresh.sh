#!/usr/bin/env bash
set -euo pipefail

aws_refresh() {
  aws --profile "${AWS_PROFILE:-aws-starter}" --region eu-north-1 --no-cli-pager "$@"
}

project=pq-explorer-publish-pilot
schedule=pq-explorer-daily-refresh
role=PQExplorerRefreshScheduler
account=$(aws_refresh sts get-caller-identity --query Account --output text)
if [[ "$account" != 716904822267 ]]; then
  echo "Expected the PQ Explorer pilot AWS account." >&2
  exit 1
fi

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
aws_refresh codebuild batch-get-projects --names "$project" --output json > "$work_dir/current.json"

python3 - "$work_dir" "$account" "$project" "$schedule" "$role" <<'PY'
import json
import re
import sys
from pathlib import Path

directory, account, project, schedule, role = sys.argv[1:]
directory = Path(directory)

def save(filename, value):
    (directory / filename).write_text(json.dumps(value))

projects = json.loads((directory / "current.json").read_text())["projects"]
if len(projects) != 1 or projects[0]["source"]["type"] != "NO_SOURCE":
    raise SystemExit("Expected the existing CodeBuild pilot with an inline buildspec.")

source = projects[0]["source"]
buildspec = source["buildspec"]
repository = "https://github.com/bubcass/pq-explorer.git"
fetch = f"git fetch --depth 1 {repository} refs/heads/main"
checkout = "git checkout --detach FETCH_HEAD"
log = 'echo "PQ Explorer snapshot $(git rev-parse HEAD)"'

if fetch not in buildspec:
    pattern = rf"git fetch --depth 1 {re.escape(repository)} [0-9a-f]{{7,40}}"
    buildspec, count = re.subn(pattern, fetch, buildspec)
    if count != 1:
        raise SystemExit("Could not locate a single pinned PQ Explorer checkout.")
if log not in buildspec:
    if buildspec.count(checkout) != 1:
        raise SystemExit("Could not locate a single detached checkout.")
    buildspec = buildspec.replace(checkout, f"{checkout}\n      - >-\n        {log}")
save("project.json", {"name": project, "source": {**source, "buildspec": buildspec}})

region = "eu-north-1"
project_arn = f"arn:aws:codebuild:{region}:{account}:project/{project}"
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
    "ScheduleExpression": "cron(0 14 * * ? *)",
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
