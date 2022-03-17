import chalk from 'chalk';

import { pause_spinner } from './console.js';

const SEPARATOR = ', ';

let verbose = process.env.DEBUG ? true : false;
let disabled = false;

const formatMessages = (messages: Array<string>) => chalk.reset(messages.join(SEPARATOR));

const log_pause_spinner = (text: string) => {
  pause_spinner(() => {
    console.log(text);
  });
};

const success = (...messages: Array<string>) => {
  if (!disabled) {
    log_pause_spinner(`${chalk.green.bold('success')} ${formatMessages(messages)}`);
  }
};

const info = (...messages: Array<string>) => {
  if (!disabled) {
    log_pause_spinner(`${chalk.cyan.bold('info')} ${formatMessages(messages)}`);
  }
};

const warn = (...messages: Array<string>) => {
  if (!disabled) {
    console.warn(`${chalk.yellow.bold('warn')} ${formatMessages(messages)}`);
  }
};

const error = (...messages: Array<string>) => {
  if (!disabled) {
    pause_spinner(() => {
      console.error(`${chalk.red.bold('error')} ${formatMessages(messages)}`);
    });
  }
};

const debug = (...messages: Array<string>) => {
  if (verbose && !disabled) {
    log_pause_spinner(`${chalk.gray.bold('debug')} ${formatMessages(messages)}`);
  }
};

const log = (...messages: Array<string>) => {
  if (!disabled) {
    log_pause_spinner(`${formatMessages(messages)}`);
  }
};

const setVerbose = (level: boolean) => {
  verbose = level;
};

const isVerbose = () => verbose;

const disable = () => {
  disabled = true;
};

const enable = () => {
  disabled = false;
};

export default {
  success,
  info,
  warn,
  error,
  debug,
  log,
  setVerbose,
  isVerbose,
  disable,
  enable,
};
