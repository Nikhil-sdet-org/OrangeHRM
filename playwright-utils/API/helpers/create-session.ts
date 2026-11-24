import { APIRequestContext, request } from '@playwright/test'
import { AuthApi } from '../clients/auth/auth-api'
import { EmployeesApi } from '../clients/pim/employees-api'
import { APILogger } from '../core/logger'
import { RequestHandler } from '../core/request-handler'

/**
 * Signs in on a context of its own and returns that context; the session cookie lives in
 * its jar. The caller owns the context afterwards and disposes it. On failure it is
 * disposed here, because nothing else will ever hold it.
 */
export async function createSession(
  baseUrl: string,
  username: string,
  password: string,
): Promise<APIRequestContext> {
  const context = await request.newContext()
  const api = new RequestHandler(context, baseUrl, new APILogger())
  try {
    const loginResult = await new AuthApi(api).login(username, password)
    if (!loginResult.signedIn) {
      throw new Error(`Sign-in as "${username}" was rejected: ${loginResult.errorMessage || 'no message'}`)
    }
    // The landing page is the application's word; a session-only endpoint answering 200
    // is the proof the cookie actually carries a session
    await new EmployeesApi(api).getMyself(200)
    return context
  } catch (error) {
    await context.dispose()
    Error.captureStackTrace(error as Error, createSession)
    throw error
  }
}
