import { APIRequestContext, APIResponse, test } from '@playwright/test'
import { APILogger } from './logger'

type FormValues = Record<string, string | number | boolean>

/**
 * The fluent HTTP builder. A call is described with the builder methods, then ended with
 * the verb plus the expected status code. State is cleared after every call, so one
 * handler is safe to chain repeatedly within a test.
 *
 * OrangeHRM authenticates with a session cookie held by the APIRequestContext, not with a
 * token, so there is no auth header to inject and no clearAuth(): an unauthenticated call
 * is made through a handler over a context that never signed in.
 */
export class RequestHandler {
  private request: APIRequestContext
  private logger: APILogger
  private defaultBaseUrl: string
  private baseUrl: string | undefined
  private apiPath = ''
  private queryParams: Record<string, string | number | boolean> = {}
  private apiHeaders: Record<string, string> = {}
  private apiBody: object | undefined
  private apiForm: FormValues | undefined

  constructor(request: APIRequestContext, apiBaseUrl: string, logger: APILogger) {
    this.request = request
    this.defaultBaseUrl = apiBaseUrl
    this.logger = logger
  }

  url(url: string) {
    this.baseUrl = url
    return this
  }

  path(path: string) {
    this.apiPath = path
    return this
  }

  params(params: Record<string, string | number | boolean>) {
    this.queryParams = params
    return this
  }

  headers(headers: Record<string, string>) {
    this.apiHeaders = headers
    return this
  }

  body(body: object) {
    this.apiBody = body
    return this
  }

  form(form: FormValues) {
    this.apiForm = form
    return this
  }

  async getRequest(statusCode: number) {
    return this.send('GET', statusCode, this.getRequest)
  }

  async postRequest(statusCode: number) {
    return this.send('POST', statusCode, this.postRequest)
  }

  async putRequest(statusCode: number) {
    return this.send('PUT', statusCode, this.putRequest)
  }

  async deleteRequest(statusCode: number): Promise<void> {
    await this.send('DELETE', statusCode, this.deleteRequest)
  }

  private async send(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    expectedStatus: number,
    callingFunction: Function,
  ): Promise<any> {
    const url = this.getUrl()
    const headers = { ...this.apiHeaders }
    const body = this.apiBody
    const form = this.apiForm
    this.cleanUpFields()

    if (body !== undefined && form !== undefined) {
      throw new Error(`${method} ${url}: .body() and .form() were both given; send one or the other`)
    }

    let responseBody: unknown
    await test.step(`${method} ${url}`, async () => {
      this.logger.logRequest(method, url, headers, form ?? body)
      const response = await this.request.fetch(url, {
        method,
        headers,
        ...(form !== undefined ? { form } : {}),
        ...(body !== undefined ? { data: body } : {}),
      })

      const actualStatus = response.status()
      responseBody = await readBody(response)
      this.logger.logResponse(actualStatus, responseBody)
      this.statusCodeValidator(actualStatus, expectedStatus, callingFunction)
    })
    return responseBody
  }

  private getUrl(): string {
    const url = new URL(`${this.baseUrl ?? this.defaultBaseUrl}${this.apiPath}`)
    for (const [key, value] of Object.entries(this.queryParams)) {
      url.searchParams.append(key, String(value))
    }
    return url.toString()
  }

  private statusCodeValidator(actualStatus: number, expectedStatus: number, callingFunction: Function) {
    if (actualStatus !== expectedStatus) {
      const logs = this.logger.getRecentLogs()
      const error = new Error(
        `Expected status ${expectedStatus} but got ${actualStatus}.\n\nRecent API Activity:\n${logs}`,
      )
      Error.captureStackTrace(error, callingFunction)
      throw error
    }
  }

  private cleanUpFields() {
    this.baseUrl = undefined
    this.apiPath = ''
    this.queryParams = {}
    this.apiHeaders = {}
    this.apiBody = undefined
    this.apiForm = undefined
  }
}

// OrangeHRM answers JSON from /api/v2 and HTML from its pages. An unconditional .json()
// would throw before the status is compared and hide every failure behind a parse error.
async function readBody(response: APIResponse): Promise<unknown> {
  const text = await response.text()
  const contentType = response.headers()['content-type'] ?? ''
  if (contentType.includes('application/json') && text.length > 0) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}
