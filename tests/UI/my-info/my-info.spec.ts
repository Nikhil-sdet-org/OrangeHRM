import { expect, test } from '@playwright/test'
import { LoginPage } from '../../../playwright-utils/UI/pages/auth/login-page'
import { SideNavComponent } from '../../../playwright-utils/UI/pages/navigation/side-nav-component'
import { PersonalDetailsPage } from '../../../playwright-utils/UI/pages/my-info/personal-details-page'
import { ContactDetailsPage } from '../../../playwright-utils/UI/pages/my-info/contact-details-page'
import { EmergencyContactsPage } from '../../../playwright-utils/UI/pages/my-info/emergency-contacts-page'
import { testData } from '../../../playwright-utils/UI/test-data/my-info.data'

test.describe('My Info', () => {
  let personalDetailsPage: PersonalDetailsPage

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    const sideNavComponent = new SideNavComponent(page)
    personalDetailsPage = new PersonalDetailsPage(page)

    await test.step('Log in to OrangeHRM', async () => {
      await loginPage.open(process.env.BASE_URL!)
      await loginPage.login(process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!)
      await expect(sideNavComponent.menu).toBeVisible()
    })

    await test.step('Open My Info from the side navigation', async () => {
      const sectionsLoaded = personalDetailsPage.waitForSectionsToLoad()
      await sideNavComponent.openMyInfo()
      await sectionsLoaded
      await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+$/)
      await expect(personalDetailsPage.heading).toBeVisible()
    })
  })

  test('QA-101 | User can update personal details, custom fields, attachments and contact details from My Info', { tag: '@regression' }, async ({ page }) => {
    const contactDetailsPage = new ContactDetailsPage(page)
    let employeeFullName = ''

    await test.step('Fill every personal detail with unique values and save', async () => {
      const personalDetails = testData['QA-101'].personalDetails
      const employeeName = await personalDetailsPage.fillEmployeeName()
      const identification = await personalDetailsPage.fillIdentification(
        personalDetails.employeeIdPrefix,
        personalDetails.otherIdPrefix,
        personalDetails.licenseNumberPrefix,
        personalDetails.licenseExpiryDate,
      )
      await personalDetailsPage.fillPersonalInformation(
        personalDetails.nationality,
        personalDetails.maritalStatus,
        personalDetails.dateOfBirth,
        personalDetails.gender,
      )
      await personalDetailsPage.savePersonalDetails()
      await expect(personalDetailsPage.personalDetailsUpdatedMessage).toBeVisible()
      await expect(personalDetailsPage.firstNameInput).toHaveValue(employeeName.firstName)
      await expect(personalDetailsPage.middleNameInput).toHaveValue(employeeName.middleName)
      await expect(personalDetailsPage.lastNameInput).toHaveValue(employeeName.lastName)
      await expect(personalDetailsPage.employeeIdInput).toHaveValue(identification.employeeId)
      await expect(personalDetailsPage.otherIdInput).toHaveValue(identification.otherId)
      await expect(personalDetailsPage.licenseNumberInput).toHaveValue(identification.licenseNumber)
      await expect(personalDetailsPage.licenseExpiryDateInput).toHaveValue(personalDetails.licenseExpiryDate)
      await expect(personalDetailsPage.nationalitySelect).toHaveText(personalDetails.nationality)
      await expect(personalDetailsPage.maritalStatusSelect).toHaveText(personalDetails.maritalStatus)
      await expect(personalDetailsPage.dateOfBirthInput).toHaveValue(personalDetails.dateOfBirth)
      await expect(personalDetailsPage.genderRadio(personalDetails.gender)).toBeChecked()
      employeeFullName = `${employeeName.firstName} ${employeeName.lastName}`
    })

    await test.step('Fill the custom fields and save', async () => {
      const customFields = testData['QA-101'].customFields
      const customTextValue = await personalDetailsPage.fillCustomFields(customFields.bloodType, customFields.textFieldLabel, customFields.textValuePrefix)
      await personalDetailsPage.saveCustomFields()
      await expect(personalDetailsPage.customFieldsSavedMessage).toBeVisible()
      await expect(personalDetailsPage.bloodTypeSelect).toHaveText(customFields.bloodType)
      await expect(personalDetailsPage.customTextInput(customFields.textFieldLabel)).toHaveValue(customTextValue)
    })

    await test.step('Replace every attachment with two new files', async () => {
      await personalDetailsPage.deleteAllAttachments()
      await expect(personalDetailsPage.attachmentsRecordsFoundLabel).toHaveText('No Records Found')

      const attachments = testData['QA-101'].attachments
      const uploadedFileNames = await personalDetailsPage.uploadAttachments(attachments.fileNamePrefix, attachments.fileCount)
      for (const fileName of uploadedFileNames) {
        await expect(personalDetailsPage.attachmentRow(fileName)).toBeVisible()
      }
    })

    await test.step('Open Contact Details from the personal details tabs', async () => {
      const contactDetailsLoaded = contactDetailsPage.waitForContactDetailsToLoad()
      await personalDetailsPage.openContactDetails()
      await contactDetailsLoaded
      await expect(page).toHaveURL(/\/pim\/contactDetails\/empNumber\/\d+$/)
      await expect(contactDetailsPage.heading).toBeVisible()
      await expect(contactDetailsPage.employeeNameHeading(employeeFullName)).toBeVisible()
    })

    await test.step('Fill every contact detail and save', async () => {
      const contactDetails = testData['QA-101'].contactDetails
      await contactDetailsPage.fillAddress(
        contactDetails.street1,
        contactDetails.street2,
        contactDetails.city,
        contactDetails.stateProvince,
        contactDetails.zipPostalCode,
        contactDetails.country,
      )
      await contactDetailsPage.fillTelephones(contactDetails.homePhone, contactDetails.mobilePhone, contactDetails.workPhone)
      await contactDetailsPage.fillEmails(contactDetails.workEmail, contactDetails.otherEmail)
      await contactDetailsPage.saveContactDetails()
      await expect(contactDetailsPage.contactDetailsUpdatedMessage).toBeVisible()
      await expect(contactDetailsPage.street1Input).toHaveValue(contactDetails.street1)
      await expect(contactDetailsPage.street2Input).toHaveValue(contactDetails.street2)
      await expect(contactDetailsPage.cityInput).toHaveValue(contactDetails.city)
      await expect(contactDetailsPage.stateProvinceInput).toHaveValue(contactDetails.stateProvince)
      await expect(contactDetailsPage.zipPostalCodeInput).toHaveValue(contactDetails.zipPostalCode)
      await expect(contactDetailsPage.countrySelect).toHaveText(contactDetails.country)
      await expect(contactDetailsPage.homePhoneInput).toHaveValue(contactDetails.homePhone)
      await expect(contactDetailsPage.mobilePhoneInput).toHaveValue(contactDetails.mobilePhone)
      await expect(contactDetailsPage.workPhoneInput).toHaveValue(contactDetails.workPhone)
      await expect(contactDetailsPage.workEmailInput).toHaveValue(contactDetails.workEmail)
      await expect(contactDetailsPage.otherEmailInput).toHaveValue(contactDetails.otherEmail)
    })
  })

  test('QA-102 | User can add an emergency contact from My Info', { tag: '@sanity' }, async ({ page }) => {
    const emergencyContactsPage = new EmergencyContactsPage(page)
    const emergencyContact = testData['QA-102'].emergencyContact
    let emergencyContactName = ''

    await test.step('Open Emergency Contacts from the My Info tabs', async () => {
      await personalDetailsPage.openEmergencyContacts()
      await expect(page).toHaveURL(/\/pim\/viewEmergencyContacts\/empNumber\/\d+$/)
      await expect(emergencyContactsPage.heading).toBeVisible()
    })

    await test.step('Open the Save Emergency Contact form', async () => {
      await emergencyContactsPage.openAddEmergencyContact()
      await expect(emergencyContactsPage.saveEmergencyContactHeading).toBeVisible()
    })

    await test.step('Fill the mandatory fields and save the emergency contact', async () => {
      emergencyContactName = await emergencyContactsPage.addEmergencyContact(
        emergencyContact.namePrefix,
        emergencyContact.relationship,
        emergencyContact.mobile,
      )
      await expect(emergencyContactsPage.emergencyContactSavedMessage).toBeVisible()
      await expect(emergencyContactsPage.saveEmergencyContactHeading).toBeHidden()
      await expect(emergencyContactsPage.emergencyContactRow(emergencyContactName)).toContainText(emergencyContact.relationship)
      await expect(emergencyContactsPage.emergencyContactRow(emergencyContactName)).toContainText(emergencyContact.mobile)    })

    await test.step('Delete the emergency contact', async () => {
      await emergencyContactsPage.deleteEmergencyContact(emergencyContactName)
      await expect(emergencyContactsPage.emergencyContactDeletedMessage).toBeVisible()
      await expect(emergencyContactsPage.emergencyContactRow(emergencyContactName)).toHaveCount(0)
    })
  })

  test.afterEach(async ({ page }) => {
    await page.close()
  })
  
})
