#!/usr/bin/env bash
# Publishes the site + the configurator to sayanmramor.ru (reg.ru hosting, account u1248418).
# Takes what is PUBLISHED on GitHub (site origin/master, configurator
# origin/rate-catalog-subcategories), builds it for the domain (scripts/build_domain.js),
# uploads it next to the live folder and swaps the folders, so the site is never half-copied.
#
#   bash scripts/deploy_regru.sh             build, upload, swap
#   bash scripts/deploy_regru.sh --build     only build into ./dist-domain (look before uploading)
#   bash scripts/deploy_regru.sh --rollback  put the previous version back
#
# On the hosting (~/www): sayanmramor.ru = live, sayanmramor.ru.prev = the one before.
# The very first run moves the old Bitrix site to sayanmramor.ru.bitrix-old (archived on the
# owner's PC in D:\sayanmramor-old-site; delete it on the hosting once the new site is checked).
# Only these folders are touched: the account holds the owner's other sites too.
set -euo pipefail

HOST=u1248418@server93.hosting.reg.ru
KEY="$HOME/.ssh/sayanmramor_regru"
LIVE=www/sayanmramor.ru
SITE_REPO="$(cd "$(dirname "$0")/.." && pwd)"
CALC_REPO="${CALC_REPO:-D:/calculator/.worktrees/rate-catalog-subcategories}"
SITE_REF="${SITE_REF:-origin/master}"
CALC_REF="${CALC_REF:-origin/rate-catalog-subcategories}"
ssh_() { ssh -i "$KEY" -o BatchMode=yes -o IdentitiesOnly=yes -o ServerAliveInterval=30 "$HOST" "$@"; }

if [ "${1:-}" = "--rollback" ]; then
  ssh_ "set -e; cd ~/www; test -d sayanmramor.ru.prev || { echo 'no previous version'; exit 1; };
        mv sayanmramor.ru sayanmramor.ru.rolled-back-\$(date +%Y%m%d-%H%M%S); mv sayanmramor.ru.prev sayanmramor.ru; echo 'previous version is live'"
  exit 0
fi

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
git -C "$SITE_REPO" fetch -q origin
git -C "$CALC_REPO" fetch -q origin
mkdir -p "$work/site" "$work/calc"
git -C "$SITE_REPO" archive "$SITE_REF" | tar -x -C "$work/site"
git -C "$CALC_REPO" archive "$CALC_REF" | tar -x -C "$work/calc"
echo "site $(git -C "$SITE_REPO" rev-parse --short "$SITE_REF"), configurator $(git -C "$CALC_REPO" rev-parse --short "$CALC_REF")"

out="$work/dist"
[ "${1:-}" = "--build" ] && out="$SITE_REPO/dist-domain"
node "$SITE_REPO/scripts/build_domain.js" --site "$work/site" --calc "$work/calc" --out "$out"
if [ "${1:-}" = "--build" ]; then echo "built into $out (nothing uploaded)"; exit 0; fi

echo "uploading..."
tar -C "$out" -czf - . | ssh_ "set -e; rm -rf ~/$LIVE.next; mkdir -p ~/$LIVE.next; tar -xzf - -C ~/$LIVE.next; find ~/$LIVE.next -type d -exec chmod 755 {} +; find ~/$LIVE.next -type f -exec chmod 644 {} +"
ssh_ "set -e; cd ~/www
  if [ -d sayanmramor.ru/bitrix ]; then
    test -e sayanmramor.ru.bitrix-old && { echo 'sayanmramor.ru.bitrix-old already exists, stop'; exit 1; }
    mv sayanmramor.ru sayanmramor.ru.bitrix-old; echo 'old Bitrix site moved to sayanmramor.ru.bitrix-old'
  else
    rm -rf sayanmramor.ru.prev; mv sayanmramor.ru sayanmramor.ru.prev
  fi
  mv sayanmramor.ru.next sayanmramor.ru
  echo \"live: \$(find sayanmramor.ru -type f | wc -l) files\""
echo "done: https://sayanmramor.ru/"
