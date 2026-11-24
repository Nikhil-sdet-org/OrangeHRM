import { type Locator, type Page } from '@playwright/test'

export class LoginPage {
  public readonly usernameInput: Locator
  public readonly passwordInput: Locator
  public readonly loginButton: Locator

  constructor(private page: Page) {
    this.usernameInput = this.page.getByRole('textbox', { name: 'Username' })
    this.passwordInput = this.page.getByRole('textbox', { name: 'Password' })
    this.loginButton = this.page.getByRole('button', { name: 'Login', exact: true })
  }

  async open(url: string) {
    await this.page.goto(url)
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.loginButton.click()
  }
}
