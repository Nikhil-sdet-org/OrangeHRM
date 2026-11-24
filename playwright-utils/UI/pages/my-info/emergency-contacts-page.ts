import { type Locator, type Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { labelledField } from '../../helpers/methods'

export class EmergencyContactsPage {
  public readonly heading: Locator
  // The Attachments section on this tab has an Add button too; the heading and its
  // Add button are siblings in the section header, so the heading text scopes it
  public readonly addButton: Locator
  // Attachments renders a second unnamed table on this tab; this one is told apart by its Relationship column
  public readonly emergencyContactsTable: Locator
  // Only rendered while a row is selected, and only one row is ever selected here
  public readonly deleteSelectedButton: Locator
  public readonly confirmDeleteButton: Locator

  public readonly saveEmergencyContactHeading: Locator
  // The form is the heading's sibling, not its descendant, so `has` cannot scope it
  public readonly saveEmergencyContactForm: Locator
  public readonly nameInput: Locator
  public readonly relationshipInput: Locator
  public readonly mobileInput: Locator
  public readonly saveButton: Locator
  // Toasts render in an aria-live region with no role; the region plus its text identifies one
  public readonly emergencyContactSavedMessage: Locator
  public readonly emergencyContactDeletedMessage: Locator

  constructor(private page: Page) {
    this.heading = this.page.getByRole('heading', { name: 'Assigned Emergency Contacts', level: 6 })
    this.addButton = this.page.locator('xpath=//h6[normalize-space()="Assigned Emergency Contacts"]/following-sibling::button')
    this.emergencyContactsTable = this.page.getByRole('table').filter({ has: this.page.getByRole('columnheader', { name: 'Relationship' }) })
    this.deleteSelectedButton = this.page.getByRole('button', { name: 'Delete Selected' })
    this.confirmDeleteButton = this.page.getByRole('dialog').getByRole('button', { name: 'Yes, Delete' })

    this.saveEmergencyContactHeading = this.page.getByRole('heading', { name: 'Save Emergency Contact', level: 6 })
    this.saveEmergencyContactForm = this.page.locator('xpath=//h6[normalize-space()="Save Emergency Contact"]/following-sibling::form')
    this.nameInput = labelledField(this.saveEmergencyContactForm, 'Name').locator('input')
    this.relationshipInput = labelledField(this.saveEmergencyContactForm, 'Relationship').locator('input')
    this.mobileInput = labelledField(this.saveEmergencyContactForm, 'Mobile').locator('input')
    this.saveButton = this.saveEmergencyContactForm.getByRole('button', { name: 'Save' })
    this.emergencyContactSavedMessage = this.page.locator('[aria-live="assertive"]', { hasText: 'Successfully Saved' })
    this.emergencyContactDeletedMessage = this.page.locator('[aria-live="assertive"]', { hasText: 'Successfully Deleted' })
  }

  emergencyContactRow(name: string): Locator {
    return this.emergencyContactsTable.getByRole('row').filter({ has: this.page.getByRole('cell', { name, exact: true }) })
  }

  // The row's own delete button has no accessible name (an icon only), so the row is
  // selected instead. Its checkbox input is covered by a styled span that takes the
  // click, so the cell that wraps it is the click target.
  emergencyContactSelectCell(name: string): Locator {
    return this.emergencyContactRow(name).getByRole('cell').filter({ has: this.page.getByRole('checkbox') })
  }

  async openAddEmergencyContact() {
    await this.addButton.click()
  }

  // The demo employee is shared, and a failed run leaves its contact behind, so the name
  // is completed per run to keep this run's row identifiable. Besides Name and Relationship, the app
  // rejects the save with "At least one phone number is required", so Mobile is filled.
  async addEmergencyContact(namePrefix: string, relationship: string, mobile: string) {
    const name = `${namePrefix} ${faker.person.lastName()} ${faker.string.numeric(4)}`
    await this.nameInput.fill(name)
    await this.relationshipInput.fill(relationship)
    await this.mobileInput.fill(mobile)
    await this.saveButton.click()
    return name
  }

  async deleteEmergencyContact(name: string) {
    await this.emergencyContactSelectCell(name).click()
    await this.deleteSelectedButton.click()
    await this.confirmDeleteButton.click()
  }
}
