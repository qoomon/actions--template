import * as core from '@actions/core'
import {InputOptions} from '@actions/core'
import * as _exec from '@actions/exec'
import {z, ZodSchema} from 'zod'
import {Context} from "@actions/github/lib/context";
import process from "node:process";
import {getFlatValues, JsonObject, JsonObjectSchema, JsonTransformer} from './common.js';
import * as github from "@actions/github";

export const context = enhancedContext()

/**
 * GitHub Actions bot user
 */
export const bot = {
  name: 'github-actions[bot]',
  email: '41898282+github-actions[bot]@users.noreply.github.com',
} as const

/**
 * Run action and catch errors
 * @param action - action to run
 * @returns void
 */
export function run(action: () => Promise<void>): void {
  action().catch(async (error: unknown) => {
    let failedMessage = 'Unhandled error, see job logs'
    if (error != null && typeof error === 'object' &&
        'message' in error && error.message != null) {
      failedMessage = error.message.toString()
    }
    core.setFailed(failedMessage)

    if (error != null && typeof error === 'object' &&
        'stack' in error) {
      console.error(error.stack)
    }
  })
}

/**
 * Gets string value of an input.
 *
 * @param name - input name
 * @param options - input options
 * @returns input value or undefined if value is not set or empty
 */
export function getInput(name: string, options?: core.InputOptions): string | undefined
/**
 * Gets string value of an input.
 *
 * @param name - input name
 * @param schema - input schema
 * @param options - input options
 * @returns parsed input value or undefined if value is not set or empty
 */
export function getInput<T extends ZodSchema>(name: string, schema: T, options?: InputOptions): z.infer<T> | undefined
export function getInput<T extends ZodSchema>(name: string, schema_options?: T | InputOptions , options?: InputOptions): string | z.infer<T> | undefined {
  let schema: T | undefined
  if(schema_options instanceof ZodSchema){
    schema = schema_options
  } else {
    options = schema_options
  }

  const input = core.getInput(name, options)
  if (!input) return undefined
  if (!schema) return input

  const parseResult = schema.safeParse(input)
  if (parseResult.error) {
    const issues = parseResult.error.issues.map(formatZodIssue)
    throw new Error(`Invalid value for input '${name}': ${input}\n` +
        issues.map((it) => `  - ${it}`).join('\n'))
  }

  return parseResult.data

  // --- zod utils ---

  /**
   * This function will format a zod issue
   * @param issue - zod issue
   * @return formatted issue
   */
  function formatZodIssue(issue: z.ZodIssue): string {
    if (issue.path.length === 0) return issue.message
    return `${issue.path.join('.')}: ${issue.message}`
  }
}

/**
 * Execute a command and get the output.
 * @param commandLine - command to execute (can include additional args). Must be correctly escaped.
 * @param args - optional command arguments.
 * @param options - optional exec options. See ExecOptions
 * @returns status, stdout and stderr
 */
export async function exec(commandLine: string, args?: string[], options?: _exec.ExecOptions): Promise<ExecResult> {
  const stdoutChunks = [] as Buffer[]
  const stderrChunks = [] as Buffer[]
  const status = await _exec.exec(commandLine, args, {
    ...options,
    listeners: {
      stdout(data) {
        stdoutChunks.push(data)
      },
      stderr(data) {
        stderrChunks.push(data)
      },
    },
  })
  return {
    status,
    stdout: Buffer.concat(stdoutChunks as Uint8Array[]),
    stderr: Buffer.concat(stderrChunks as Uint8Array[]),
  }
}

export interface ExecResult {
  status: number
  stdout: Buffer
  stderr: Buffer
}

function enhancedContext() {
  const context = github.context

  const additionalContext = {
    repository: `${context.repo.owner}/${context.repo.repo}`,
    runAttempt: parseInt(process.env.GITHUB_RUN_ATTEMPT!, 10),
    runnerName: process.env.RUNNER_NAME!,
    runnerTemp: process.env.RUNNER_TEMP!,
  };

  return new Proxy(context, {
    get(context, prop, receiver) {
      return prop in context
          // @ts-ignore
          ? context[prop]
          // @ts-ignore
          : additionalContext[prop];
    },
  }) as Context & typeof additionalContext
}

function getAbsoluteJobName({job, matrix, workflowContextChain}: {
  job: string
  matrix?: JsonObject | null
  workflowContextChain?: WorkflowContext[]
}) {
  let actualJobName = job
  if (matrix) {
    const flatValues = getFlatValues(matrix)
    if (flatValues.length > 0) {
      actualJobName = `${actualJobName} (${flatValues.join(', ')})`
    }
  }

  workflowContextChain?.forEach((workflowContext) => {
    const contextJob = getAbsoluteJobName(workflowContext)
    actualJobName = `${contextJob} / ${actualJobName}`
  })

  return actualJobName
}

const JobMatrixParser = JsonTransformer.pipe(JsonObjectSchema.nullable())

const WorkflowContextSchema = z.object({
  job: z.string(),
  matrix: JsonObjectSchema.nullable(),
}).strict()

type WorkflowContext = z.infer<typeof WorkflowContextSchema>

const WorkflowContextParser = z.string()
    .transform((str, ctx) => JsonTransformer.parse(`[${str}]`, ctx))
    .pipe(z.array(z.union([z.string(), JsonObjectSchema]).nullable()))
    .transform((contextChainArray, ctx) => {
      const contextChain: unknown[] = []
      while (contextChainArray.length > 0) {
        const job = contextChainArray.shift()
        if (typeof job !== 'string') {
          ctx.addIssue({
            code: 'custom',
            message: `Value must match the schema: "<JOB_NAME>", [<MATRIX_JSON>], [<JOB_NAME>", [<MATRIX_JSON>], ...]`,
          })
          return z.NEVER
        }
        let matrix;
        if (typeof contextChainArray[0] === 'object') {
          matrix = contextChainArray.shift()
        }
        contextChain.push({job, matrix})
      }
      return contextChain
    })
    .pipe(z.array(WorkflowContextSchema))


/**
 * Get the current job from the workflow run
 * @returns the current job
 */
export async function getJobObject(): Promise<Exclude<typeof jobObject, undefined>> {
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN!);

  const workflowRunJobs = await octokit.paginate(octokit.rest.actions.listJobsForWorkflowRunAttempt, {
    ...context.repo,
    run_id: context.runId,
    attempt_number: context.runAttempt,
  }).catch((error) => {
    if (error.status === 403) {
      throwPermissionError({scope: 'actions', permission: 'read'}, error)
    }
    throw error
  })

  const absoluteJobName = getAbsoluteJobName({
    job: context.job,
    matrix: getInput('matrix', JobMatrixParser),
    workflowContextChain: getInput('workflow-context', WorkflowContextParser),
  })

  const jobObject = workflowRunJobs.find((job) => job.name === absoluteJobName)
  if (!jobObject) {
    throw new Error(`Current job '${absoluteJobName}' could not be found in workflow run.\n` +
        'If this action is used within a reusable workflow, ensure that ' +
        'action input \'workflow-context\' is set correctly and ' +
        'the \'workflow-context\' job name matches the job name of the job name that uses the reusable workflow.')
  }
  return jobObject
}

/**
 * Throw a permission error
 * @param permission - GitHub Job permission
 * @param options - error options
 * @returns void
 */
export function throwPermissionError(permission: { scope: string; permission: string }, options?: ErrorOptions): never {
  throw new Error(
      `Ensure that GitHub job has permission: \`${permission.scope}: ${permission.permission}\`. ` +
      // eslint-disable-next-line max-len
      'https://docs.github.com/en/actions/security-guides/automatic-token-authentication#modifying-the-permissions-for-the-github_token',
      options)
}


// TODO function to store and read job state
