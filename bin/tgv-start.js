#!/usr/bin/env node

// This is just a way to start the server while avoiding react-native-cli overhead, for profiling

const rn_config_path = require.resolve('./react-native.config.js', { paths: [process.cwd()] });

const { commands } = require(rn_config_path);

commands[0].func();
