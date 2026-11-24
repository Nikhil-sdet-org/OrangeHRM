import { expect as baseExpect } from '@playwright/test'
import type { MatcherReturnType } from '@playwright/test'
import { APILogger } from './logger'
import { validateSchema } from './schema-validator'

let apiLogger: APILogger | undefined

export const setCustomExpectLogger = (logger: APILogger) => {
  apiLogger = logger
}

declare global {
  namespace PlaywrightTest {
    interface Matchers<R, T> {
      shouldEqual(expected: T): R
      shouldMatch(expected: RegExp): R
      shouldBeLessThanOrEqual(expected: number): R
      shouldMatchSchema(dirName: string, fileName: string): Promise<R>
    }
  }
}

function recentLogs(): string {
  return apiLogger?.getRecentLogs() ?? '(no API logger registered for this test)'
}

type MatcherContext = {
  isNot: boolean
  utils: {
    matcherHint: (name: string, received?: string, expected?: string, options?: { isNot?: boolean }) => string
    printExpected: (value: unknown) => string
    printReceived: (value: unknown) => string
  }
}

// Runs the built-in assertion and, on any outcome the caller will see as a failure,
// appends the recent API activity so the report names the call that produced the value.
function wrapBuiltIn(
  context: MatcherContext,
  name: string,
  received: unknown,
  expected: unknown,
  assertion: () => void,
): MatcherReturnType {
  let pass: boolean
  try {
    assertion()
    pass = true
  } catch {
    pass = false
  }
  const failed = pass === context.isNot
  const message =
    context.utils.matcherHint(name, undefined, undefined, { isNot: context.isNot }) +
    '\n\n' +
    `Expected: ${context.isNot ? 'not ' : ''}${context.utils.printExpected(expected)}\n` +
    `Received: ${context.utils.printReceived(received)}\n\n` +
    (failed ? `Recent API Activity:\n${recentLogs()}` : '')
  return { message: () => message, pass, name, expected, actual: received }
}

export const expect = baseExpect.extend({
  shouldEqual(received: unknown, expected: unknown) {
    return wrapBuiltIn(this, 'shouldEqual', received, expected, () => baseExpect(received).toEqual(expected))
  },

  shouldMatch(received: string, expected: RegExp) {
    return wrapBuiltIn(this, 'shouldMatch', received, expected, () => baseExpect(received).toMatch(expected))
  },

  shouldBeLessThanOrEqual(received: number, expected: number) {
    return wrapBuiltIn(this, 'shouldBeLessThanOrEqual', received, expected, () =>
      baseExpect(received).toBeLessThanOrEqual(expected),
    )
  },

  async shouldMatchSchema(received: unknown, dirName: string, fileName: string) {
    let pass: boolean
    let detail: string
    try {
      await validateSchema(dirName, fileName, received)
      pass = true
      detail = `Response matches ${dirName}/${fileName}_schema.json`
    } catch (error) {
      pass = false
      detail = (error as Error).message
    }
    const failed = pass === this.isNot
    const message = failed ? `${detail}\n\nRecent API Activity:\n${recentLogs()}` : detail
    return { message: () => message, pass, name: 'shouldMatchSchema' }
  },
})
