#!/bin/bash
# Captures your Alpaca keys straight from the macOS clipboard (pbpaste) so nothing
# can be mistyped or mangled by an editor. You just Copy each value, then press Enter.
set -e
cd "$(dirname "$0")"

echo "── Alpaca sandbox key capture (clipboard-based) ──"
echo
echo "STEP 1: In the Alpaca /dev popup, click Copy on the API KEY ID."
read -r -p "        Done? Press Enter to grab it from your clipboard... " _
KEY_ID="$(pbpaste | tr -d '[:space:]')"
echo "        Captured Key ID (${#KEY_ID} chars): ${KEY_ID:0:3}…${KEY_ID: -3}"
echo
echo "STEP 2: Now click Copy on the API SECRET."
read -r -p "        Done? Press Enter to grab it from your clipboard... " _
SECRET="$(pbpaste | tr -d '[:space:]')"
echo "        Captured Secret (${#SECRET} chars): ${SECRET:0:3}…${SECRET: -3}"
echo

if [ "$KEY_ID" = "$SECRET" ]; then
  echo "⚠️  Key ID and Secret came out identical — you probably copied the same one twice."
  echo "    Re-run and make sure you Copy the SECRET at step 2."
  exit 1
fi

cat > .env <<EOF
ALPACA_API_KEY_ID=${KEY_ID}
ALPACA_API_SECRET_KEY=${SECRET}
ALPACA_BASE_URL=https://broker-api.sandbox.alpaca.markets
EOF
chmod 600 .env

echo "Wrote .env. Verifying against Alpaca sandbox..."
echo
NODE="$(command -v node || echo /opt/homebrew/bin/node)"
"$NODE" --env-file=.env check-alpaca.mjs
