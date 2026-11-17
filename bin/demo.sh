#!/bin/sh
CLI="$(dirname "$0")/tasks-panel"
"$CLI" set stalled-demo --desc "Upload render frames to the shared storage bucket" --step 3 --total 40 --machine gpu-box --stale-after 20
"$CLI" set demo --desc "Render demo sequence with ten second progress updates" --step 0 --total 30
i=1
while [ $i -le 30 ]; do
  sleep 10
  "$CLI" set demo --step $i
  i=$((i + 1))
done
"$CLI" done demo
