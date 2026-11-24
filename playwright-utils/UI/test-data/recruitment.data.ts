// Get environment from process.env. TEST_ENV selects the data set and defaults to qa.
const ENV = process.env.TEST_ENV || 'qa'

// QA environment test data
const qaTestData = {
  // Candidates cases
  'QA-201': {
    vacancy: {
      namePrefix: 'QA Vacancy ',
      jobTitle: 'QA Engineer',
      // Any employee will do as hiring manager; the hint only has to match one
      hiringManagerHint: 'a',
    },
    candidate: {
      firstNamePrefix: 'Qa',
      emailDomain: 'example.com',
      resumeFileNamePrefix: 'qa-resume-',
      keywords: 'playwright, automation, typescript',
      // OrangeHRM's demo is localized to yyyy-dd-mm
      dateOfApplication: '2026-10-11',
      notes: 'Created by the QA-201 automation run',
    },
  },
}

// RC environment test data
const rcTestData: typeof qaTestData = {
  'QA-201': {
    vacancy: {
      namePrefix: 'RC Vacancy ',
      jobTitle: 'QA Engineer',
      // Any employee will do as hiring manager; the hint only has to match one
      hiringManagerHint: 'a',
    },
    candidate: {
      firstNamePrefix: 'Rc',
      emailDomain: 'example.com',
      resumeFileNamePrefix: 'rc-resume-',
      keywords: 'playwright, automation, typescript',
      dateOfApplication: '2026-10-11',
      notes: 'Created by the QA-201 automation run',
    },
  },
}

// Regression environment test data
const regressionTestData: typeof qaTestData = {
  'QA-201': {
    vacancy: {
      namePrefix: 'RG Vacancy ',
      jobTitle: 'QA Engineer',
      // Any employee will do as hiring manager; the hint only has to match one
      hiringManagerHint: 'a',
    },
    candidate: {
      firstNamePrefix: 'Rg',
      emailDomain: 'example.com',
      resumeFileNamePrefix: 'reg-resume-',
      keywords: 'playwright, automation, typescript',
      dateOfApplication: '2026-10-11',
      notes: 'Created by the QA-201 automation run',
    },
  },
}

// Export test data based on environment
let testData = qaTestData
if (ENV === 'qa') {
  testData = qaTestData
}
if (ENV === 'rc') {
  testData = rcTestData
}
if (ENV === 'regression') {
  testData = regressionTestData
}

export { testData }
