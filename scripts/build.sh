mkdir -p dist

sucrase ./src -d ./dist --transforms typescript --quiet

mv dist/commands.js dist/commands.cjs

echo '{"type": "module"}' > ./dist/package.json
