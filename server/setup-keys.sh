#!/bin/bash
# One-shot: paste your Alpaca SANDBOX Broker keys when prompted (input is hidden,
# not saved to shell history), writes .env locally, then verifies the connection.
set -e
cd "$(dirname "$0")"

echo "Alpaca Broker API — sandbox key setup"
echo "(input is hidden; nothing is echoed or stored in history)"
echo

read -rs -p "Paste API Key ID:     " KEY_ID; echo
read -rs -p "Paste API Secret Key: " SECRET; echo

cat > .env <<EOF
ALPACA_API_KEY_ID=${KEY_ID}
ALPACA_API_SECRET_KEY=${SECRET}
ALPACA_BASE_URL=https://broker-api.sandbox.alpaca.markets
EOF
chmod 600 .env

echo
echo "Wrote $(pwd)/.env (permissions 600, git-ignored). Verifying..."
echo
NODE="$(command -v node || echo /opt/homebrew/bin/node)"
"$NODE" --env-file=.env check-alpaca.mjs
