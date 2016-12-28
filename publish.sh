#!/bin/bash

rm -rf ./dist

tsc --project tsconfig.json 2> /dev/null

if [ $? -eq 0 ]
then
  echo "Compilation OK, publishing"
  cp README.md ./dist/README.md
  cp package.json ./dist/package.json
  NPM_USER=$(npm whoami 2> /dev/null)
  if [ "${NPM_USER}" != "shlomiassaf" ]; then
    echo "You must be logged in as 'shlomiassaf' to publish. Use 'npm login'."
    exit
  fi

  set -ex

  npm publish --access public ./dist

else
  echo "Compilation failed" >&2
fi
