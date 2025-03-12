import process from 'node:process';
import {action} from './src/main.js';
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Set Working directory
const workingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'local-action-'));
process.chdir(workingDirectory);
process.env.GITHUB_REPOSITORY = "octokit/sandbox"

// Set action input
setActionInputs({
  token: process.env.GITHUB_TOKEN ?? 'gh_asdf',
});

// Run the action
await action();

/**
 * Set action input environment variables
 * @param inputs - input values
 * @returns void
 */
function setActionInputs(inputs: Record<string, string | undefined>) {
  Object.entries(inputs)
      .filter(([, value]) => value !== undefined)
      .forEach(([name, value]) => {
        process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = value
      })
}
