// Get environment from process.env. TEST_ENV selects the data set and defaults to qa.
const ENV = process.env.TEST_ENV || 'qa'

// QA environment test data
const qaTestData = {
  // Login cases
  'QA-302': {
    errorMessage: 'Invalid credentials',
    // What /api/v2 answers a request that carries no session
    noSessionMessage: 'Session expired',
    attempts: [
      { scenario: 'a wrong password', username: 'Admin', password: 'not-the-password' },
      { scenario: 'an unknown username', username: 'qa-no-such-user', password: 'not-the-password' },
    ],
  },
}

// RC environment test data
const rcTestData: typeof qaTestData = {
  'QA-302': {
    errorMessage: 'Invalid credentials',
    noSessionMessage: 'Session expired',
    attempts: [
      { scenario: 'a wrong password', username: 'Admin', password: 'not-the-password' },
      { scenario: 'an unknown username', username: 'rc-no-such-user', password: 'not-the-password' },
    ],
  },
}

// Regression environment test data
const regressionTestData: typeof qaTestData = {
  'QA-302': {
    errorMessage: 'Invalid credentials',
    noSessionMessage: 'Session expired',
    attempts: [
      { scenario: 'a wrong password', username: 'Admin', password: 'not-the-password' },
      { scenario: 'an unknown username', username: 'reg-no-such-user', password: 'not-the-password' },
    ],
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
