require('esbuild-register');

module.exports = {
  commands: [
    {
      name: 'tgv-start',
      description: 'starts the TGV dev server',
      func: async () => {
        const { tgv_start } = require('./src/dev-server-command');
        await tgv_start({ port: 8081, entryPoint: 'index.js' });
      },
      // TODO: options
    },
    {
      name: 'tgv-bundle',
      description: 'Bundle with TGV',
      func: (...args) => {
        const { tgv_bundle } = require('./src/prod-bundler-command');
        return tgv_bundle(...args);
      },
      options: require('./src/prod-bundler/cli-args').bundle_cli_args,
    },
  ],
};
