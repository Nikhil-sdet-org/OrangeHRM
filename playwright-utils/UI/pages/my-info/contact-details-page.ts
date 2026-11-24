import {  Locator, Page } from '@playwright/test'
import { chooseDropdownOption, labelledField } from '../../helpers/methods'

export class ContactDetailsPage {
  public readonly heading: Locator
  public readonly form: Locator
  public readonly street1Input: Locator
  public readonly street2Input: Locator
  public readonly cityInput: Locator
  public readonly stateProvinceInput: Locator
  public readonly zipPostalCodeInput: Locator
  public readonly countrySelect: Locator
  public readonly homePhoneInput: Locator
  public readonly mobilePhoneInput: Locator
  public readonly workPhoneInput: Locator
  public readonly workEmailInput: Locator
  public readonly otherEmailInput: Locator
  public readonly saveButton: Locator
  public readonly contactDetailsUpdatedMessage: Locator

  constructor(private page: Page) {
    this.heading = this.page.getByRole('heading', { name: 'Contact Details', level: 6 })
    // Same shape as Personal Details: the form is the heading's sibling, anchored on its text
    this.form = this.page.locator('xpath=//h6[normalize-space()="Contact Details"]/following-sibling::form')
    this.street1Input = labelledField(this.form, 'Street 1').locator('input')
    this.street2Input = labelledField(this.form, 'Street 2').locator('input')
    this.cityInput = labelledField(this.form, 'City').locator('input')
    this.stateProvinceInput = labelledField(this.form, 'State/Province').locator('input')
    this.zipPostalCodeInput = labelledField(this.form, 'Zip/Postal Code').locator('input')
    // The custom select is a focusable div with no role; tabindex is the only authored hook on it
    this.countrySelect = labelledField(this.form, 'Country').locator('[tabindex="0"]')
    this.homePhoneInput = labelledField(this.form, 'Home').locator('input')
    this.mobilePhoneInput = labelledField(this.form, 'Mobile').locator('input')
    this.workPhoneInput = labelledField(this.form, 'Work').locator('input')
    this.workEmailInput = labelledField(this.form, 'Work Email').locator('input')
    this.otherEmailInput = labelledField(this.form, 'Other Email').locator('input')
    this.saveButton = this.form.getByRole('button', { name: 'Save' })
    // Toasts render in an aria-live region with no role; the region plus its text identifies one
    this.contactDetailsUpdatedMessage = this.page.locator('[aria-live="assertive"]', { hasText: 'Successfully Updated' })
  }

  // The employee header is re-read from the server on every tab, so the saved
  // name showing here proves the Personal Details save persisted
  employeeNameHeading(fullName: string): Locator {
    return this.page.getByRole('heading', { name: fullName, level: 6, exact: true })
  }

  // The form renders before the employee's contact record arrives, and the record
  // overwrites anything typed ahead of it. Arm this before the click that opens the tab.
  async waitForContactDetailsToLoad() {
    await this.page.waitForResponse(
      (response) => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/contact-details') && response.ok(),
    )
  }

  async fillAddress(street1: string, street2: string, city: string, stateProvince: string, zipPostalCode: string, country: string) {
    await this.street1Input.fill(street1)
    await this.street2Input.fill(street2)
    await this.cityInput.fill(city)
    await this.stateProvinceInput.fill(stateProvince)
    await this.zipPostalCodeInput.fill(zipPostalCode)
    await chooseDropdownOption(this.page, this.countrySelect, country)
  }

  async fillTelephones(homePhone: string, mobilePhone: string, workPhone: string) {
    await this.homePhoneInput.fill(homePhone)
    await this.mobilePhoneInput.fill(mobilePhone)
    await this.workPhoneInput.fill(workPhone)
  }

  async fillEmails(workEmail: string, otherEmail: string) {
    await this.workEmailInput.fill(workEmail)
    await this.otherEmailInput.fill(otherEmail)
  }

  async saveContactDetails() {
    await this.saveButton.click()
  }
}
