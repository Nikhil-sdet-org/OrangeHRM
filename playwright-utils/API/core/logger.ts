// An HTML page is tens of kilobytes; logged whole it buries the request that produced it
const MAX_LOGGED_BODY_LENGTH = 2_000

type LogEntry = {
  type: 'Request Details' | 'Response Details'
  data: Record<string, unknown>
}

export class APILogger {
  private recentLogs: LogEntry[] = []

  logRequest(method: string, url: string, headers: Record<string, string>, body?: unknown) {
    this.recentLogs.push({
      type: 'Request Details',
      data: { method, url, headers, body: capBody(body) },
    })
  }

  logResponse(statusCode: number, body?: unknown) {
    this.recentLogs.push({
      type: 'Response Details',
      data: { statusCode, body: capBody(body) },
    })
  }

  getRecentLogs(): string {
    return this.recentLogs
      .map((log) => `=== ${log.type} ===\n${JSON.stringify(log.data, null, 4)}\n`)
      .join('\n\n')
  }
}

function capBody(body: unknown): unknown {
  if (body === undefined) return undefined
  const serialized = typeof body === 'string' ? body : JSON.stringify(body)
  if (serialized.length <= MAX_LOGGED_BODY_LENGTH) return body
  return `${serialized.slice(0, MAX_LOGGED_BODY_LENGTH)}… [truncated ${serialized.length - MAX_LOGGED_BODY_LENGTH} of ${serialized.length} characters]`
}
