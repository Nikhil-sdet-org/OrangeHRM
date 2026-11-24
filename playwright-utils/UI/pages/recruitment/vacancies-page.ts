import { type Locator, type Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { chooseDropdownOption, labelledField } from '../../helpers/methods'

// The Recruitment > Vacancies screens: the list, the Add Vacancy form, and the
// Edit Vacancy page a saved vacancy lands on
export class VacanciesPage {
  public readonly vacanciesHeading: Locator
  public readonly addButton: Locator

  public readonly addVacancyHeading: Locator
  public readonly addVacancyForm: Locator
  public readonly vacancyNameInput: Locator
  public readonly jobTitleSelect: Locator
  public readonly hiringManagerInput: Locator
  public readonly hiringManagerSuggestions: Locator
  public readonly saveVacancyButton: Locator

  public readonly editVacancyHeading: Locator
  public readonly editVacancyForm: Locator
  public readonly savedVacancyNameInput: Locator
  public readonly candidatesLink: Locator

  constructor(private page: Page) {
    this.vacanciesHeading = this.page.getByRole('heading', { name: 'Vacancies', level: 5 })
    // The button's accessible name carries an icon glyph before "Add", so exact matching
    // fails; it is the only button on the list page whose name contains "Add"
    this.addButton = this.page.getByRole('button', { name: 'Add' })

    this.addVacancyHeading = this.page.getByRole('heading', { name: 'Add Vacancy', level: 6 })
    // The form is the heading's sibling, not its descendant, so `has` cannot scope it.
    // Anchored on the heading text; there is no role, label or test id on the form.
    this.addVacancyForm = this.page.locator('xpath=//h6[normalize-space()="Add Vacancy"]/following-sibling::form')
    this.vacancyNameInput = labelledField(this.addVacancyForm, 'Vacancy Name').locator('input')
    // The custom select is a focusable div with no role; tabindex is the only authored hook on it
    this.jobTitleSelect = labelledField(this.addVacancyForm, 'Job Title').locator('[tabindex="0"]')
    this.hiringManagerInput = labelledField(this.addVacancyForm, 'Hiring Manager').locator('input')
    // The listbox shows a "Searching...." placeholder before results arrive, and
    // "No Records Found" when nothing matches; neither is an employee
    this.hiringManagerSuggestions = this.page.getByRole('listbox').getByRole('option').filter({ hasNotText: /^(Searching\.*|No Records Found)$/ })
    this.saveVacancyButton = this.addVacancyForm.getByRole('button', { name: 'Save' })

    this.editVacancyHeading = this.page.getByRole('heading', { name: 'Edit Vacancy', level: 6 })
    // Same shape as Add Vacancy: the form is the heading's sibling, anchored on its text
    this.editVacancyForm = this.page.locator('xpath=//h6[normalize-space()="Edit Vacancy"]/following-sibling::form')
    this.savedVacancyNameInput = labelledField(this.editVacancyForm, 'Vacancy Name').locator('input')
    this.candidatesLink = this.page.getByRole('navigation', { name: 'Topbar Menu' }).getByRole('link', { name: 'Candidates' })
  }

  async openAddVacancy() {
    await this.addButton.click()
  }

  // Vacancy names are unique per directory; the data holds the prefix and the run adds the rest
  async fillVacancyName(namePrefix: string) {
    const vacancyName = `${namePrefix}${faker.string.alphanumeric(8)}`
    await this.vacancyNameInput.fill(vacancyName)
    return vacancyName
  }

  async selectJobTitle(jobTitle: string) {
    await chooseDropdownOption(this.page, this.jobTitleSelect, jobTitle)
  }

  // Any employee is a valid hiring manager, and the shared demo's employees are added,
  // renamed and deleted by other visitors, so no name can be pinned in data. The hint
  // only has to match someone; the first suggestion is taken and its name returned.
  async chooseHiringManager(hint: string) {
    await this.hiringManagerInput.pressSequentially(hint)
    await this.hiringManagerSuggestions.first().waitFor()
    const hiringManagerName = (await this.hiringManagerSuggestions.first().textContent())?.trim() ?? ''
    await this.hiringManagerSuggestions.first().click()
    return hiringManagerName
  }

  async saveVacancy() {
    await this.saveVacancyButton.click()
  }

  async openCandidates() {
    await this.candidatesLink.click()
  }
}
