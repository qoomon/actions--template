import * as core from '@actions/core'
// import * as github from '@actions/github'
import {HttpClient} from '@actions/http-client'
// see https://github.com/actions/toolkit for more GitHub actions libraries
import {action, context, getInput} from '../lib/actions.js'
import {z} from 'zod'
import {fileURLToPath} from 'url'

export const run = action(async () => {
  core.info(`Repository: ${context.repository}`)

  const inputs = {
    token: getInput('token', {required: true}, z.string().startsWith('g')),
    string: getInput('stringInput'),
    object: getInput('yamlInput', z.optional(z.array(z.string())).default([])),
  }

  core.info(`Hello ${inputs.string ?? 'world'}!`)

  // const octokit = github.getOctokit(inputs.token)
  //
  // await octokit.rest.issues.create({
  //   owner: context.repo.owner,
  //   repo: context.repo.repo,
  //   title: 'New issue',
  //   body: 'This is a new issue',
  // })

  const httpClient = new HttpClient()
  const response = await httpClient.getJson('https://api.github.com', {
    'User-Agent': '@actions/http-client',
  })
  core.info(`Response Status: ${response.statusCode}`)

  // const result = await exec('echo', ['Hello world!'])
  //     .then(({stdout}) => stdout.toString())

  // core.startGroup('Group title')
  // core.info(result)
  // core.endGroup()

  // core.setSecret(value)

  // core.setFailed('This is a failure')

  // core.setOutput(key,value)
})

// Execute the action, if running as the main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await run()
}
