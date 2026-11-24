import { test } from '../../../playwright-utils/API/fixtures/api-fixtures'
import { expect } from '../../../playwright-utils/API/core/custom-expect'
import { AuthApi } from '../../../playwright-utils/API/clients/auth/auth-api'
import { EmployeesApi } from '../../../playwright-utils/API/clients/pim/employees-api'
import { UsersApi } from '../../../playwright-utils/API/clients/admin/users-api'
import { testData } from '../../../playwright-utils/API/test-data/auth.api.data'

test.describe('Login API', () => {
  test('QA-301 | User can sign in through the API and the session belongs to that user', async ({
    guestApi,
    credentials,
  }) => {
    const authApi = new AuthApi(guestApi)
    const employeesApi = new EmployeesApi(guestApi)
    const usersApi = new UsersApi(guestApi)

    let signedInEmployeeNumber = 0

    await test.step(`Sign in as "${credentials.username}"`, async () => {
      const loginResult = await authApi.login(credentials.username, credentials.password)

      expect(loginResult.signedIn).shouldEqual(true)
      expect(loginResult.errorMessage).shouldEqual('')
    })

    await test.step('Confirm the session reaches the REST API', async () => {
      const myself = await employeesApi.getMyself(200)

      await expect(myself).shouldMatchSchema('pim', 'GET_myself')
      signedInEmployeeNumber = myself.data.empNumber
    })

    await test.step(`Confirm the session belongs to the "${credentials.username}" account`, async () => {
      const users = await usersApi.findUsers(credentials.username)

      await expect(users).shouldMatchSchema('admin', 'GET_users')
      expect(users.data.map((user: { userName: string }) => user.userName)).shouldEqual([credentials.username])
      expect(users.data[0].employee.empNumber).shouldEqual(signedInEmployeeNumber)
    })
  })

  testData['QA-302'].attempts.forEach(({ scenario, username, password }) => {
    test(`QA-302 | Sign-in with ${scenario} is rejected and opens no session`, async ({ guestApi }) => {
      const authApi = new AuthApi(guestApi)
      const employeesApi = new EmployeesApi(guestApi)

      await test.step(`Attempt to sign in as "${username}"`, async () => {
        const loginResult = await authApi.login(username, password)

        expect(loginResult.signedIn).shouldEqual(false)
        expect(loginResult.errorMessage).shouldEqual(testData['QA-302'].errorMessage)
      })

      await test.step('Confirm the REST API still refuses the cookie', async () => {
        const myself = await employeesApi.getMyself(401)

        expect(myself.error.message).shouldEqual(testData['QA-302'].noSessionMessage)
      })
    })
  })
})
