import { RequestHandler } from '../../core/request-handler'
import { hasComponent, readComponentProp } from '../../helpers/html-form'

const LOGIN_COMPONENT = 'auth-login'

export type LoginResult = {
  // The application served the login form again instead of letting the user in
  signedIn: boolean
  // The message the re-rendered login form carries, '' when it carries none
  errorMessage: string
}

/**
 * The OrangeHRM sign-in round trip, as the browser performs it:
 *   GET  /auth/login     — 200 HTML; sets the `orangehrm` session cookie and renders
 *                          the CSRF token as the <auth-login :token> prop
 *   POST /auth/validate  — form-encoded _token, username, password; answers 302 either
 *                          way: to /dashboard/index when accepted, back to /auth/login
 *                          (now carrying :error) when rejected
 *
 * The redirect is followed, so the status is 200 for both outcomes and the landing page
 * is what tells them apart. The session lives in the cookie jar of the context behind
 * the handler, so every later call through that handler is signed in.
 */
export class AuthApi {
  constructor(private api: RequestHandler) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const loginPage: string = await this.api.path('/auth/login').getRequest(200)
    const csrfToken = readComponentProp(loginPage, LOGIN_COMPONENT, 'token')

    const landingPage: string = await this.api
      .path('/auth/validate')
      .form({ _token: String(csrfToken ?? ''), username, password })
      .postRequest(200)

    const loginError = readComponentProp(landingPage, LOGIN_COMPONENT, 'error') as
      | { message?: string }
      | null
      | undefined

    return {
      signedIn: !hasComponent(landingPage, LOGIN_COMPONENT),
      errorMessage: loginError?.message ?? '',
    }
  }
}
