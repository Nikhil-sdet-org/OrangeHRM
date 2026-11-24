import { APIRequestContext, test as base } from '@playwright/test'
import { apiConfig } from '../api-config'
import { setCustomExpectLogger } from '../core/custom-expect'
import { APILogger } from '../core/logger'
import { RequestHandler } from '../core/request-handler'
import { createSession } from '../helpers/create-session'

type Credentials = { username: string; password: string }

export type ApiTestFixtures = {
  // Shared by api and guestApi, so one failure message carries every call the test made
  apiLogger: APILogger
  // Signed in as the environment's user, through the worker's session
  api: RequestHandler
  // Never signed in: a fresh cookie jar per test, for driving sign-in itself
  guestApi: RequestHandler
  credentials: Credentials
  config: typeof apiConfig
}

export type ApiWorkerFixtures = {
  authContext: APIRequestContext
}

function readCredentials(): Credentials {
  const username = process.env.TEST_USERNAME
  const password = process.env.TEST_PASSWORD
  if (!username || !password) {
    throw new Error('TEST_USERNAME and TEST_PASSWORD must be set in the env file playwright.config.ts loads')
  }
  return { username, password }
}

export const test = base.extend<ApiTestFixtures, ApiWorkerFixtures>({
  authContext: [
    async ({}, use) => {
      const { username, password } = readCredentials()
      const context = await createSession(apiConfig.baseUrl, username, password)
      await use(context)
      await context.dispose()
    },
    { scope: 'worker' },
  ],

  apiLogger: async ({}, use) => {
    const logger = new APILogger()
    setCustomExpectLogger(logger)
    await use(logger)
  },

  api: async ({ authContext, apiLogger }, use) => {
    await use(new RequestHandler(authContext, apiConfig.baseUrl, apiLogger))
  },

  guestApi: async ({ request, apiLogger }, use) => {
    await use(new RequestHandler(request, apiConfig.baseUrl, apiLogger))
  },

  credentials: async ({}, use) => {
    await use(readCredentials())
  },

  config: async ({}, use) => {
    await use(apiConfig)
  },
})
