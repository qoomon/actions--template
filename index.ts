import * as core from '@actions/core'
import * as github from '@actions/github'
import {HttpClient} from '@actions/http-client'
import * as action from './lib/actions'
// see https://github.com/actions/toolkit for more github actions libraries
import {z} from 'zod'

const context = github.context
const input = {
  token: core.getInput('token', {required: true})!,
  string: core.getInput('stringInput'),
  yaml: z.optional(z.array(z.string())).default([])
      .parse(action.getYamlInput('yamlInput')),
}
const octokit = github.getOctokit(input.token)

action.run(async () => {
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

  const result = await action.exec('echo', ['Hello world!'])
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
