import * as core from '@actions/core'
import {exec, getInput, getYamlInput, run} from './lib/actions'
import * as github from '@actions/github'
// see https://github.com/actions/toolkit for more github actions libraries
import {z} from 'zod'

const context = github.context
const input = {
  token: getInput('token', {required: true})!,
  string: getInput('stringInput'),
  yaml: z.optional(z.array(z.string())).default([])
      .parse(getYamlInput('yamlInput')),
}
const octokit = github.getOctokit(input.token)

run(async () => {
  await octokit.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: 'New issue',
    body: 'This is a new issue',
  })

  await exec('echo')
      .then(({stdout}) => stdout.trim())

  core.setSecret('secret')
  core.setOutput('foo', 'bar')
  core.info('Hello world!')
  // core.setFailed('This is a failure')
})
