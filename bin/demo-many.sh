#!/bin/sh
CLI="$(dirname "$0")/tasks-panel"
set -- \
  "bake|Bake lighting for the main hall scene|gpu-box|40" \
  "train|Train LoRA on product shots dataset|render-node|60" \
  "encode|Encode hero video in four resolutions|laptop|24" \
  "upload|Upload render frames to shared storage|gpu-box|50" \
  "build|Build production bundle for the client site|laptop|12" \
  "thumbs|Generate thumbnails for the whole media library|render-node|80" \
  "deploy|Deploy staging stack and invalidate CloudFront|laptop|10" \
  "comfy|Run ComfyUI batch for campaign key visuals|gpu-box|30" \
  "sitemap|Regenerate sitemap and translated slugs|laptop|8" \
  "backup|Back up DynamoDB tables to cold storage|render-node|20"
for spec in "$@"; do
  IFS='|' read -r id desc machine total <<SPEC
$spec
SPEC
  "$CLI" set "$id" --desc "$desc" --machine "$machine" --step 0 --total "$total"
done
tick=0
while [ $tick -lt 90 ]; do
  sleep 10
  tick=$((tick + 1))
  for spec in "$@"; do
    IFS='|' read -r id desc machine total <<SPEC
$spec
SPEC
    case $id in upload) [ $tick -gt 2 ] && continue ;; esac
    step=$tick
    if [ $step -ge "$total" ]; then "$CLI" done "$id"; else "$CLI" set "$id" --step $step; fi
  done
done
