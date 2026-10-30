#!/usr/bin/env bash
set -euo pipefail

hallmark_commit=4f6a46c6dc325d40ab268c93e25c7b96676ebccd
hallmark_project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
hallmark_target="$hallmark_project/.agents/skills/hallmark"

if [[ -e "$hallmark_target" || -L "$hallmark_target" ]]; then
  printf 'Skill local já existe em %s; arquivos preservados.\n' "$hallmark_target"
  exit 0
fi

hallmark_tmp="$(mktemp -d)"
trap 'rm -rf -- "$hallmark_tmp"' EXIT

git -C "$hallmark_tmp" init --quiet
git -C "$hallmark_tmp" fetch --quiet --depth=1 https://github.com/Nutlope/hallmark.git "$hallmark_commit"
git -C "$hallmark_tmp" archive FETCH_HEAD -- \
  skills/hallmark/SKILL.md skills/hallmark/LICENSE \
  skills/hallmark/references skills/hallmark/scripts skills/hallmark/agents \
  > "$hallmark_tmp/hallmark.tar"
mkdir -p "$hallmark_tmp/extracted"
tar -xf "$hallmark_tmp/hallmark.tar" -C "$hallmark_tmp/extracted"
mkdir -p "$(dirname -- "$hallmark_target")"
mv -- "$hallmark_tmp/extracted/skills/hallmark" "$hallmark_target"
printf 'Hallmark instalado localmente a partir do commit %s.\n' "$hallmark_commit"
