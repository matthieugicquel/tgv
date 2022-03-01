mkdir -p dist

sucrase ./src -d ./dist --transforms typescript --quiet

# ./node_modules/.bin/esbuild src/dev-server-command.ts \
#   --bundle \
#   --outfile=./dist/dev-server-command.js\
#   --platform=node \
#   --format=esm \
#   --external:esbuild \
#   --external:@swc/core \
#   --banner:js="import { createRequire as globalCreateRequire } from 'module';const require = globalCreateRequire(import.meta.url);" \



# ./node_modules/.bin/esbuild src/prod-bundler-command.ts \
#   --bundle \
#   --outfile=./dist/prod-bundler-command.js\
#   --platform=node \
#   --format=esm \
#   --external:esbuild \
#   --external:@swc/core \
#   --banner:js="import { createRequire as globalCreateRequire } from 'module';const require = globalCreateRequire(import.meta.url);" \

# TODO: transpile and copy workers

echo '{"type": "module"}' > ./dist/package.json
