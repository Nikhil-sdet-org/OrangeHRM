import { expect, test } from '@playwright/test'
import { LoginPage } from '../../../playwright-utils/UI/pages/auth/login-page'
import { SideNavComponent } from '../../../playwright-utils/UI/pages/navigation/side-nav-component'
import { CandidatesPage } from '../../../playwright-utils/UI/pages/recruitment/candidates-page'
import { VacanciesPage } from '../../../playwright-utils/UI/pages/recruitment/vacancies-page'
import { testData } from '../../../playwright-utils/UI/test-data/recruitment.data'

test.describe('Recruitment', () => {
  test('QA-201 | User can add a candidate and find it in the candidates list', { tag: '@sanity' }, async ({ page }) => {
    const loginPage = new LoginPage(page)
    const sideNavComponent = new SideNavComponent(page)
    const candidatesPage = new CandidatesPage(page)
    const vacanciesPage = new VacanciesPage(page)
    let vacancyName = ''
    let hiringManagerName = ''
    let candidateFirstName = ''
    let candidateFullName = ''

    await test.step('Log in to OrangeHRM', async () => {
      await loginPage.open(process.env.BASE_URL!)
      await loginPage.login(process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!)
      await expect(sideNavComponent.menu).toBeVisible()
    })

    await test.step('Open Recruitment from the side navigation', async () => {
      await sideNavComponent.openRecruitment()
      await expect(page).toHaveURL(/\/recruitment\/viewCandidates$/)
      await expect(candidatesPage.candidatesHeading).toBeVisible()
    })

    await test.step('Create a vacancy for the candidate to apply to', async () => {
      const vacancyData = testData['QA-201'].vacancy
      await candidatesPage.openVacancies()
      await expect(vacanciesPage.vacanciesHeading).toBeVisible()
      await vacanciesPage.openAddVacancy()
      await expect(vacanciesPage.addVacancyHeading).toBeVisible()
      vacancyName = await vacanciesPage.fillVacancyName(vacancyData.namePrefix)
      await vacanciesPage.selectJobTitle(vacancyData.jobTitle)
      hiringManagerName = await vacanciesPage.chooseHiringManager(vacancyData.hiringManagerHint)
      await vacanciesPage.saveVacancy()
      await expect(page).toHaveURL(/\/recruitment\/addJobVacancy\/\d+$/)
      await expect(vacanciesPage.editVacancyHeading).toBeVisible()
      await expect(vacanciesPage.savedVacancyNameInput).toHaveValue(vacancyName)
    })

    await test.step('Open the Add Candidate form', async () => {
      await vacanciesPage.openCandidates()
      await expect(candidatesPage.candidatesHeading).toBeVisible()
      await candidatesPage.openAddCandidate()
      await expect(candidatesPage.addCandidateHeading).toBeVisible()
    })

    await test.step('Fill every candidate detail with unique values and save', async () => {
      const candidateData = testData['QA-201'].candidate
      const candidateName = await candidatesPage.fillCandidateName(candidateData.firstNamePrefix)
      await candidatesPage.selectVacancy(vacancyName)
      await candidatesPage.fillContactDetails(candidateData.emailDomain)
      await candidatesPage.uploadResume(candidateData.resumeFileNamePrefix)
      await candidatesPage.fillApplicationDetails(candidateData.keywords, candidateData.dateOfApplication, candidateData.notes)
      await candidatesPage.giveConsentAndSave()
      candidateFirstName = candidateName.firstName
      candidateFullName = candidateName.fullName
      await expect(candidatesPage.candidateSavedMessage).toBeVisible()
      await expect(page).toHaveURL(/\/recruitment\/addCandidate\/\d+$/)
      await expect(candidatesPage.applicationStageName).toHaveText(candidateName.fullName)
      await expect(candidatesPage.applicationStageVacancy).toHaveText(vacancyName)
      await expect(candidatesPage.applicationStageHiringManager).toHaveText(hiringManagerName)
    })

    await test.step('Find the new candidate in the candidates list', async () => {
      await candidatesPage.openCandidates()
      await candidatesPage.searchByCandidateName(candidateFirstName, candidateFullName)
      await expect(candidatesPage.recordsFoundLabel).toHaveText('(1) Record Found')
      await expect(candidatesPage.candidateRow(candidateFullName)).toContainText(vacancyName)
    })
  })
})
