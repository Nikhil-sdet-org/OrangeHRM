import { RequestHandler } from '../../core/request-handler'

export class UsersApi {
  constructor(private api: RequestHandler) {}

  // System user accounts filtered by username, as Admin > User Management searches them
  async findUsers(username: string) {
    return this.api.path('/api/v2/admin/users').params({ username }).getRequest(200)
  }
}
