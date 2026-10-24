#!/usr/bin/env node

const { assertWindows10OrAbove } = require('../src/core/osCheck');

const args = process.argv.slice(2);

// Check if running on supported Windows version (Windows 10+)
assertWindows10OrAbove({ isGui: args.length === 0 });

const { createCli, launchGui } = require('../src/cli');

// If no arguments provided, launch the Desktop Window GUI by default
if (args.length === 0) {
  launchGui();
} else {
  const cli = createCli();
  cli.parse(process.argv);
}
