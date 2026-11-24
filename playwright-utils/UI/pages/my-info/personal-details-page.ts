import { type Locator, type Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { chooseDropdownOption, labelledField } from '../../helpers/methods'

export class PersonalDetailsPage {
  public readonly heading: Locator
  public readonly contactDetailsTab: Locator
  public readonly emergencyContactsTab: Locator

  public readonly personalDetailsForm: Locator
  public readonly firstNameInput: Locator
  public readonly middleNameInput: Locator
  public readonly lastNameInput: Locator
  public readonly employeeIdInput: Locator
  public readonly otherIdInput: Locator
  public readonly licenseNumberInput: Locator
  public readonly licenseExpiryDateInput: Locator
  public readonly nationalitySelect: Locator
  public readonly maritalStatusSelect: Locator
  public readonly dateOfBirthInput: Locator
  public readonly personalDetailsSaveButton: Locator
  public readonly personalDetailsUpdatedMessage: Locator

  public readonly customFieldsForm: Locator
  public readonly bloodTypeSelect: Locator
  public readonly customFieldsSaveButton: Locator
  public readonly customFieldsSavedMessage: Locator

  public readonly attachmentsSection: Locator
  public readonly addAttachmentButton: Locator
  public readonly attachmentsRecordsFoundLabel: Locator
  public readonly selectAllAttachmentsCheckbox: Locator
  public readonly deleteSelectedAttachmentsButton: Locator
  public readonly confirmDeleteButton: Locator
  public readonly addAttachmentForm: Locator
  public readonly attachmentFileInput: Locator
  public readonly addAttachmentSaveButton: Locator

  constructor(private page: Page) {
    this.heading = this.page.getByRole('heading', { name: 'Personal Details', level: 6 })
    this.contactDetailsTab = this.page.getByRole('tablist').getByRole('link', { name: 'Contact Details' })
    this.emergencyContactsTab = this.page.getByRole('tablist').getByRole('link', { name: 'Emergency Contacts' })

    // The form is the heading's sibling, not its descendant, so `has` cannot scope it.
    // Anchored on the heading text; there is no role, label or test id on the form.
    this.personalDetailsForm = this.page.locator('xpath=//h6[normalize-space()="Personal Details"]/following-sibling::form')
    this.firstNameInput = this.personalDetailsForm.getByRole('textbox', { name: 'First Name' })
    this.middleNameInput = this.personalDetailsForm.getByRole('textbox', { name: 'Middle Name' })
    this.lastNameInput = this.personalDetailsForm.getByRole('textbox', { name: 'Last Name' })
    this.employeeIdInput = labelledField(this.personalDetailsForm, 'Employee Id').locator('input')
    this.otherIdInput = labelledField(this.personalDetailsForm, 'Other Id').locator('input')
    this.licenseNumberInput = labelledField(this.personalDetailsForm, "Driver's License Number").locator('input')
    this.licenseExpiryDateInput = labelledField(this.personalDetailsForm, 'License Expiry Date').locator('input')
    // The custom select is a focusable div with no role; tabindex is the only authored hook on it
    this.nationalitySelect = labelledField(this.personalDetailsForm, 'Nationality').locator('[tabindex="0"]')
    this.maritalStatusSelect = labelledField(this.personalDetailsForm, 'Marital Status').locator('[tabindex="0"]')
    this.dateOfBirthInput = labelledField(this.personalDetailsForm, 'Date of Birth').locator('input')
    this.personalDetailsSaveButton = this.personalDetailsForm.getByRole('button', { name: 'Save' })
    // Toasts render in an aria-live region with no role; the region plus its text identifies one
    this.personalDetailsUpdatedMessage = this.page.locator('[aria-live="assertive"]', { hasText: 'Successfully Updated' })

    this.customFieldsForm = this.page.locator('xpath=//h6[normalize-space()="Custom Fields"]/following-sibling::form')
    this.bloodTypeSelect = labelledField(this.customFieldsForm, 'Blood Type').locator('[tabindex="0"]')
    this.customFieldsSaveButton = this.customFieldsForm.getByRole('button', { name: 'Save' })
    this.customFieldsSavedMessage = this.page.locator('[aria-live="assertive"]', { hasText: 'Successfully Saved' })

    // The section has no role or name; its heading is the only thing that identifies it.
    // Nearest ancestor of the heading that also holds the (div, role="table") grid is the section.
    this.attachmentsSection = this.page.locator('xpath=//h6[normalize-space()="Attachments"]/ancestor::div[.//*[@role="table"]][1]')
    // The heading and its Add button are siblings in the section header
    this.addAttachmentButton = this.page.locator('xpath=//h6[normalize-space()="Attachments"]/following-sibling::button')
    this.attachmentsRecordsFoundLabel = this.attachmentsSection.getByText(/Records? Found$/)
    // The checkbox input is visually covered by a styled span that takes the click,
    // so the header cell that wraps it is the click target
    this.selectAllAttachmentsCheckbox = this.attachmentsSection.getByRole('columnheader').filter({ has: this.page.getByRole('checkbox') })
    this.deleteSelectedAttachmentsButton = this.attachmentsSection.getByRole('button', { name: 'Delete Selected' })
    this.confirmDeleteButton = this.page.getByRole('dialog').getByRole('button', { name: 'Yes, Delete' })
    this.addAttachmentForm = this.page.locator('xpath=//h6[normalize-space()="Add Attachment"]/following-sibling::form')
    this.attachmentFileInput = this.addAttachmentForm.locator('input[type="file"]')
    this.addAttachmentSaveButton = this.addAttachmentForm.getByRole('button', { name: 'Save' })
  }

  genderRadio(gender: string): Locator {
    return this.personalDetailsForm.getByRole('radio', { name: gender, exact: true })
  }

  // The radio input is covered by a styled span that intercepts the click; its
  // wrapping <label> carries the option text and checks the input when clicked
  genderOption(gender: string): Locator {
    return this.personalDetailsForm.locator('label', { hasText: new RegExp(`^${gender}$`) })
  }

  customTextInput(label: string): Locator {
    return labelledField(this.customFieldsForm, label).locator('input')
  }

  // The tab renders its headings before the employee record arrives, and the record
  // overwrites anything typed ahead of it. Armed before the click that opens the tab,
  // this resolves once all three sections the test edits have their data.
  async waitForSectionsToLoad() {
    const loaded = (path: string) =>
      this.page.waitForResponse(
        (response) => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith(path) && response.ok(),
      )
    await Promise.all([loaded('/personal-details'), loaded('/custom-fields'), loaded('/attachments')])
  }

  // Names are random so every run saves values that differ from the last one
  async fillEmployeeName() {
    const firstName = faker.person.firstName()
    const middleName = faker.person.middleName()
    const lastName = faker.person.lastName()
    await this.firstNameInput.fill(firstName)
    await this.middleNameInput.fill(middleName)
    await this.lastNameInput.fill(lastName)
    return { firstName, middleName, lastName }
  }

  // Employee Id is unique across the directory and capped at 10 characters, so the
  // data holds a prefix and the run completes it; the other ids follow the same pattern
  async fillIdentification(employeeIdPrefix: string, otherIdPrefix: string, licenseNumberPrefix: string, licenseExpiryDate: string) {
    const employeeId = `${employeeIdPrefix}${faker.string.numeric(10 - employeeIdPrefix.length)}`
    const otherId = `${otherIdPrefix}${faker.string.alphanumeric(8).toUpperCase()}`
    const licenseNumber = `${licenseNumberPrefix}${faker.string.numeric(8)}`
    await this.employeeIdInput.fill(employeeId)
    await this.otherIdInput.fill(otherId)
    await this.licenseNumberInput.fill(licenseNumber)
    await this.licenseExpiryDateInput.fill(licenseExpiryDate)
    return { employeeId, otherId, licenseNumber }
  }

  async fillPersonalInformation(nationality: string, maritalStatus: string, dateOfBirth: string, gender: string) {
    await chooseDropdownOption(this.page, this.nationalitySelect, nationality)
    await chooseDropdownOption(this.page, this.maritalStatusSelect, maritalStatus)
    await this.dateOfBirthInput.fill(dateOfBirth)
    await this.genderOption(gender).click()
  }

  async savePersonalDetails() {
    await this.personalDetailsSaveButton.click()
  }

  async fillCustomFields(bloodType: string, textFieldLabel: string, textValuePrefix: string) {
    const textValue = `${textValuePrefix}${faker.string.numeric(6)}`
    await chooseDropdownOption(this.page, this.bloodTypeSelect, bloodType)
    await this.customTextInput(textFieldLabel).fill(textValue)
    return textValue
  }

  async saveCustomFields() {
    await this.customFieldsSaveButton.click()
  }

  attachmentRow(fileName: string): Locator {
    return this.attachmentsSection.getByRole('row').filter({ has: this.page.getByRole('cell', { name: fileName, exact: true }) })
  }

  // An empty list offers no Delete Selected button and raises no confirmation,
  // so there is nothing to do when the shared demo record already has no files
  async deleteAllAttachments() {
    await this.attachmentsRecordsFoundLabel.waitFor()
    if ((await this.attachmentsRecordsFoundLabel.textContent())?.trim() === 'No Records Found') {
      return
    }
    await this.selectAllAttachmentsCheckbox.click()
    await this.deleteSelectedAttachmentsButton.click()
    await this.confirmDeleteButton.click()
  }

  async uploadAttachments(fileNamePrefix: string, fileCount: number) {
    const fileNames: string[] = []
    for (let index = 0; index < fileCount; index++) {
      const fileName = `${fileNamePrefix}${faker.string.alphanumeric(8)}.txt`
      // The Add button only exists while the add form is closed, so it also waits out the previous save
      await this.addAttachmentButton.click()
      await this.attachmentFileInput.setInputFiles({
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(faker.lorem.sentence()),
      })
      await this.addAttachmentSaveButton.click()
      fileNames.push(fileName)
    }
    return fileNames
  }

  async openContactDetails() {
    await this.contactDetailsTab.click()
  }

  async openEmergencyContacts() {
    await this.emergencyContactsTab.click()
  }
}
