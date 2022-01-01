sucrase ./src -d ./dist --transforms typescript --quiet

echo '{"type": "module"}' > ./dist/package.json
