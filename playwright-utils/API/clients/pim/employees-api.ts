import { RequestHandler } from '../../core/request-handler'

export class EmployeesApi {
  constructor(private api: RequestHandler) {}

  // The employee record linked to the signed-in user. Without a session the application
  // answers 401 with an error body, so the caller states which answer it expects.
  async getMyself(expectedStatus: number) {
    return this.api.path('/api/v2/pim/myself').getRequest(expectedStatus)
  }
}
