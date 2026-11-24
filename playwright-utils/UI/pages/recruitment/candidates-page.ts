import { type Locator, type Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { chooseDropdownOption, labelledField } from '../../helpers/methods'

// The Recruitment > Candidates screens: the list, the Add Candidate form, and the
// candidate profile a saved candidate lands on
export class CandidatesPage {
  public readonly candidatesHeading: Locator
  public readonly addButton: Locator
  public readonly candidateNameInput: Locator
  public readonly searchButton: Locator
  public readonly recordsFoundLabel: Locator

  public readonly addCandidateHeading: Locator
  public readonly addCandidateForm: Locator
  public readonly firstNameInput: Locator
  public readonly middleNameInput: Locator
  public readonly lastNameInput: Locator
  public readonly vacancySelect: Locator
  public readonly emailInput: Locator
  public readonly contactNumberInput: Locator
  public readonly resumeFileInput: Locator
  public readonly keywordsInput: Locator
  public readonly dateOfApplicationInput: Locator
  public readonly notesInput: Locator
  public readonly consentCheckbox: Locator
  public readonly saveCandidateButton: Locator
  public readonly candidateSavedMessage: Locator

  public readonly applicationStageForm: Locator
  public readonly applicationStageName: Locator
  public readonly applicationStageVacancy: Locator
  public readonly applicationStageHiringManager: Locator
  public readonly candidatesLink: Locator
  public readonly vacanciesLink: Locator

  constructor(private page: Page) {
    this.candidatesHeading = this.page.getByRole('heading', { name: 'Candidates', level: 5 })
    // The button's accessible name carries an icon glyph before "Add", so exact matching
    // fails; it is the only button on the list page whose name contains "Add"
    this.addButton = this.page.getByRole('button', { name: 'Add' })
    // The filter's label is not tied to its input; the placeholder is unique on the page
    this.candidateNameInput = this.page.getByPlaceholder('Type for hints...')
    this.searchButton = this.page.getByRole('button', { name: 'Search', exact: true })
    this.recordsFoundLabel = this.page.getByText(/Records? Found$/)

    this.addCandidateHeading = this.page.getByRole('heading', { name: 'Add Candidate', level: 6 })
    // The form is the heading's sibling, not its descendant, so `has` cannot scope it.
    // Anchored on the heading text; there is no role, label or test id on the form.
    this.addCandidateForm = this.page.locator('xpath=//h6[normalize-space()="Add Candidate"]/following-sibling::form')
    this.firstNameInput = this.addCandidateForm.getByRole('textbox', { name: 'First Name' })
    this.middleNameInput = this.addCandidateForm.getByRole('textbox', { name: 'Middle Name' })
    this.lastNameInput = this.addCandidateForm.getByRole('textbox', { name: 'Last Name' })
    // The custom select is a focusable div with no role; tabindex is the only authored hook on it
    this.vacancySelect = labelledField(this.addCandidateForm, 'Vacancy').locator('[tabindex="0"]')
    this.emailInput = labelledField(this.addCandidateForm, 'Email').locator('input')
    this.contactNumberInput = labelledField(this.addCandidateForm, 'Contact Number').locator('input')
    this.resumeFileInput = labelledField(this.addCandidateForm, 'Resume').locator('input[type="file"]')
    this.keywordsInput = labelledField(this.addCandidateForm, 'Keywords').locator('input')
    this.dateOfApplicationInput = labelledField(this.addCandidateForm, 'Date of Application').locator('input')
    this.notesInput = labelledField(this.addCandidateForm, 'Notes').locator('textarea')
    // The checkbox input is covered by a styled span that takes the click; its wrapping
    // <label> has no text, so it is reached through the field's visible label
    this.consentCheckbox = labelledField(this.addCandidateForm, 'Consent to keep data').locator('label')
    this.saveCandidateButton = this.addCandidateForm.getByRole('button', { name: 'Save' })
    // Toasts render in an aria-live region with no role; the region plus its text identifies one
    this.candidateSavedMessage = this.page.locator('[aria-live="assertive"]', { hasText: 'Successfully Saved' })

    this.applicationStageForm = this.page.locator('form', { has: this.page.getByRole('heading', { name: 'Application Stage', level: 6 }) })
    this.applicationStageName = labelledField(this.applicationStageForm, 'Name')
    this.applicationStageVacancy = labelledField(this.applicationStageForm, 'Vacancy')
    this.applicationStageHiringManager = labelledField(this.applicationStageForm, 'Hiring Manager')
    this.candidatesLink = this.page.getByRole('navigation', { name: 'Topbar Menu' }).getByRole('link', { name: 'Candidates' })
    this.vacanciesLink = this.page.getByRole('navigation', { name: 'Topbar Menu' }).getByRole('link', { name: 'Vacancies' })
  }

  candidateRow(fullName: string): Locator {
    return this.page.getByRole('row').filter({ has: this.page.getByRole('cell', { name: fullName, exact: true }) })
  }

  candidateNameOption(fullName: string): Locator {
    return this.page.getByRole('listbox').getByRole('option', { name: fullName, exact: true })
  }

  async openVacancies() {
    await this.vacanciesLink.click()
  }

  async openAddCandidate() {
    await this.addButton.click()
  }

  // First names start with a data prefix so runs are recognisable; the rest is random
  // so every run creates a candidate the name search can find uniquely
  async fillCandidateName(firstNamePrefix: string) {
    const firstName = `${firstNamePrefix}${faker.string.alpha(6).toLowerCase()}`
    const middleName = faker.person.middleName()
    const lastName = faker.person.lastName()
    await this.firstNameInput.fill(firstName)
    await this.middleNameInput.fill(middleName)
    await this.lastNameInput.fill(lastName)
    return { firstName, middleName, lastName, fullName: `${firstName} ${middleName} ${lastName}` }
  }

  async selectVacancy(vacancy: string) {
    await chooseDropdownOption(this.page, this.vacancySelect, vacancy)
  }

  async fillContactDetails(emailDomain: string) {
    const email = `${faker.string.alphanumeric(10).toLowerCase()}@${emailDomain}`
    const contactNumber = faker.string.numeric(10)
    await this.emailInput.fill(email)
    await this.contactNumberInput.fill(contactNumber)
    return { email, contactNumber }
  }

  async uploadResume(fileNamePrefix: string) {
    const fileName = `${fileNamePrefix}${faker.string.alphanumeric(8)}.txt`
    await this.resumeFileInput.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(faker.lorem.paragraph()),
    })
    return fileName
  }

  async fillApplicationDetails(keywords: string, dateOfApplication: string, notes: string) {
    await this.keywordsInput.fill(keywords)
    await this.dateOfApplicationInput.fill(dateOfApplication)
    await this.notesInput.fill(notes)
  }

  async giveConsentAndSave() {
    await this.consentCheckbox.click()
    await this.saveCandidateButton.click()
  }

  async openCandidates() {
    await this.candidatesLink.click()
  }

  // The hint search matches on the start of a name, not the full name with spaces,
  // so the first name is typed and the full name is picked from the suggestions
  async searchByCandidateName(firstName: string, fullName: string) {
    await this.candidateNameInput.pressSequentially(firstName)
    await this.candidateNameOption(fullName).click()
    await this.searchButton.click()
  }
}
