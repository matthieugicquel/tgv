require('esbuild-register');

const { start_dev } = require('./src/start-dev');

module.exports = {
  commands: [
    {
      name: 'start-tgv',
      description: 'starts the TGV dev server',
      func: async () => {
        await start_dev({
          port: 8081,
          entryPoint: 'index.js',
        });
      },
    },
  ],
};
