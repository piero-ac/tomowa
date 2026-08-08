#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

set -a
source "$SCRIPT_DIR/../.env"
set +a

case "$SUPABASE_URL" in
	http://127.0.0.1:* | http://localhost:*)
		;;
	*)
		echo "Refusing to send credentials to a non-local Supabase URL." >&2
		exit 1
		;;
esac

EMAIL="${1:-}"

if [[ -z "$EMAIL" ]]; then
	read -r -p "Email: " EMAIL
fi

read -r -s -p "Password: " PASSWORD
echo >&2

RESPONSE="$(
	curl -sS \
		-X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
		-H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
		-H "Content-Type: application/json" \
		-d "$(
			jq -n \
				--arg email "$EMAIL" \
				--arg password "$PASSWORD" \
				'{ email: $email, password: $password }'
		)"
)"

TOKEN="$(
	printf '%s' "$RESPONSE" |
		jq -er '.access_token'
)" || {
	echo "Failed to obtain an access token:" >&2
	printf '%s' "$RESPONSE" | jq >&2
	exit 1
}

printf '%s\n' "$TOKEN"