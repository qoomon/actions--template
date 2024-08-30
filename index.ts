import * as core from '@actions/core'
import * as github from '@actions/github'
import {HttpClient} from '@actions/http-client'
// see https://github.com/actions/toolkit for more GitHub actions libraries
import {exec, getInput, run} from './lib/actions.js'
import {z} from 'zod'
import {fileURLToPath} from 'url'
import {YamlTransformer} from './lib/common'

export const action = () => run(async () => {
  const context = github.context
  const inputs = {
    token: getInput('token', {required: true})!,
    string: getInput('stringInput'),
    yaml: z.optional(z.array(z.string())).default([])
        .parse(getInput('yamlInput', YamlTransformer)),
  }
  const octokit = github.getOctokit(inputs.token)

  await octokit.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: 'New issue',
    body: 'This is a new issue',
  })

  const httpClient = new HttpClient()
  httpClient.get('https://api.github.com').then((response) => {
    core.info(`HTTP response: ${response.message.statusCode}`)
  })

  const result = await exec('echo', ['Hello world!'])
      .then(({stdout}) => stdout.toString())

  // core.setSecret(value) will mask the value in logs
  core.setSecret('secretXXX')
  core.info(result)

  core.startGroup('Group title')
  core.info(result)
  core.endGroup()

  // core.setFailed('This is a failure')
  // core.setOutput(key,value) will set the value of an output
  core.setOutput('stringOutput', result)
})

// Execute the action, if running as the main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  action()
}
