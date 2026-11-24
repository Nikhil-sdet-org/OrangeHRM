import { type Locator, type Page } from '@playwright/test'

export class SideNavComponent {
  public readonly menu: Locator
  public readonly myInfoLink: Locator
  public readonly recruitmentLink: Locator

  constructor(private page: Page) {
    this.menu = this.page.getByRole('navigation', { name: 'Sidepanel' })
    this.myInfoLink = this.menu.getByRole('link', { name: 'My Info' })
    this.recruitmentLink = this.menu.getByRole('link', { name: 'Recruitment' })
  }

  async openMyInfo() {
    await this.myInfoLink.click()
  }

  async openRecruitment() {
    await this.recruitmentLink.click()
  }
}
