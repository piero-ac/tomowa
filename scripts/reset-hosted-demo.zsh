#!/bin/zsh

set -euo pipefail

print -r -- "This will replace the shared Tomowa demo profiles, sessions, and requests."
print -r -- "Supabase Auth users and passwords will not be changed."
print

read -r "confirmation?Type RESET to continue: "

if [[ "$confirmation" != "RESET" ]]; then
	print -r -- "Hosted demo reset cancelled."
	exit 1
fi

read -rs "database_url?Hosted Supabase DATABASE_URL: "
print

if [[ -z "$database_url" ]]; then
	print -u2 -r -- "Hosted DATABASE_URL is required."
	exit 1
fi

DATABASE_URL="$database_url" \
	DEMO_RESET_TARGET=hosted \
	DEMO_RESET_CONFIRMATION=RESET_TOMOWA_DEMO_DATA \
	npm run demo:reset
