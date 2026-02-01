#!/bin/sh
set -eu

node -v >/dev/null

npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

exec node packages/bridge-server/dist/index.js
