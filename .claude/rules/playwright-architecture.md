---
description: Playwright Page Objects, per-spec page object instantiation, fixtures, auth setup, and test organization patterns
paths: [tests/**,playwright-utils/**,playwright.config.ts]
---

# Playwright Architecture

## When to Use What

| Pattern | When | Location |
|---------|------|----------|
| **Page Object** | A page or major component with multi-step user flows | `playwright-utils/UI/pages/` |
| **API Client** | A group of HTTP endpoints a test drives without a browser | `playwright-utils/API/clients/` |
| **Custom Fixture** | Resources needing setup/teardown (auth, API) | `playwright-utils/UI/fixtures/`, `playwright-utils/API/fixtures/` |
| **Helper Function** | Stateless utility, no cleanup needed | `playwright-utils/UI/helpers/`, `playwright-utils/API/helpers/` |
| **Named timeout** | A wait that cannot use the configured default | `playwright-utils/UI/timeouts/` |

`UI/fixtures/` and `UI/timeouts/` are created in the change that first needs them.

## Page Object Conventions

- One TypeScript class per page or major component
- File name: kebab-case (`login-page.ts`, `emergency-contacts-page.ts`)
- Class name: PascalCase + `Page` (or component-appropriate) suffix (`LoginPage`, `SideNavComponent`)
- **Locators are `public readonly` properties assigned in the constructor.** Declare each one on the class, build it in the constructor body, and name it after the element (`usernameInput`, `menu`, `candidateSavedMessage`). `page.locator(...)` builds a descriptor and never touches the DOM, so constructing eagerly costs nothing and resolution still happens at use time
- **No inline locators in methods.** A method uses the properties; it never builds a selector. `await this.nameInput.fill(name)`, never `await this.page.locator('input').nth(2).fill(name)`. One definition per element means one place to fix when the DOM moves
- **The spec asserts on the properties directly**: `await expect(candidatesPage.candidateSavedMessage).toBeVisible()`. Property access, no call parentheses, and the assertion auto-waits exactly as it would on an inline locator
- **No assertions.** A page object never contains `expect()`. Every assertion lives in the spec file (see [Assertions Live in the Spec File](./playwright-scripting.md#assertions-live-in-the-spec-file))
- **A save confirmation belongs to the form that submitted it.** OrangeHRM confirms a
  save with a toast. The toast a save produces is exposed by the page object of the
  form that submitted it: `candidatesPage.candidateSavedMessage`,
  `emergencyContactsPage.emergencyContactSavedMessage`. It is named for *that submit*,
  whichever route ends up rendering it. The list owns what the list shows: a row
  locator identified by the value the module lists on, such as
  `emergencyContactRow(name)` or `candidateRow(fullName)`. Same shape everywhere: the
  form owns `<thing>SavedMessage`, the list owns `<thing>Row(identifier)`
- **A method that creates a record returns what it created**, and the spec finds the
  record with that value, never with a literal. A method that fills a name from a
  prefix returns the full name it generated, so the spec asserts on the row that
  really was created and not on one an earlier run left behind

```typescript
// GOOD: the row asserted is the row this run created
const contactName = await emergencyContactsPage.addEmergencyContact(
  testData['QA-102'].emergencyContact.namePrefix,
  testData['QA-102'].emergencyContact.relationship,
  testData['QA-102'].emergencyContact.mobile,
)
await expect(emergencyContactsPage.emergencyContactSavedMessage).toBeVisible()
await expect(emergencyContactsPage.emergencyContactRow(contactName)).toBeVisible()

// BAD: a literal that also matches a contact some earlier run created
await expect(emergencyContactsPage.emergencyContactRow('QA Contact')).toBeVisible()
```

- **Locators parametrized by runtime data stay methods.** When the selector depends on a value known only during the run (`emergencyContactRow(name)`, `candidateRow(fullName)`) there is nothing to build at construction time. Derive it from a stored property rather than a raw selector string, and never prefix the method with `expect`
- **Compose from the stored parent, except inside `filter({ has })`.** A `has` locator's selector chain is applied *relative to the outer element*, so it must be rooted at `page`. `rows.filter({ has: this.table.getByRole('cell', { name }) })` looks for the table *inside* a row and silently matches nothing
- **No tiny methods.** An action method covers a meaningful user task with multiple steps; never a single click or fill. Navigation between two pages is the exception: it is one click by nature and marks a page boundary
- **Strict page boundaries.** A method only interacts with its own page; navigation marks the end of one method and the start of another on the next page
- **Guards use `waitFor`, not `expect`.** Actions (`click`, `fill`, `check`) auto-wait, so most methods need no guard at all. Before non-auto-waiting code (`textContent`, `count`, `all`, `inputValue`, `allTextContents`), gate with `await locator.waitFor(...)`. Confirming the outcome is the spec's job, in the `test.step()` that called the method
- **Naming**: camelCase, descriptive verb phrases, no abbreviations or acronyms
- **Reuse first.** Before adding a new method, scan the relevant class. Reuse if a method covers the flow; parametrize an existing method if it nearly does. Never write two methods that differ only in a hardcoded value

```typescript
// playwright-utils/UI/pages/auth/login-page.ts
import { type Locator, type Page } from '@playwright/test'

export class LoginPage {
  public readonly usernameInput: Locator
  public readonly passwordInput: Locator
  public readonly loginButton: Locator

  constructor(private page: Page) {
    this.usernameInput = this.page.getByRole('textbox', { name: 'Username' })
    this.passwordInput = this.page.getByRole('textbox', { name: 'Password' })
    this.loginButton = this.page.getByRole('button', { name: 'Login', exact: true })
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.loginButton.click()
  }
}
```

Note there is no `expect` import: the class acts and exposes, nothing more.

The spec drives the steps and owns every assertion:

```typescript
import { expect, test } from '@playwright/test'
import { LoginPage } from '../../../playwright-utils/UI/pages/auth/login-page'
import { SideNavComponent } from '../../../playwright-utils/UI/pages/navigation/side-nav-component'

test('QA-001 | User can log in and sees the side navigation', async ({ page }) => {
  const loginPage = new LoginPage(page)
  const sideNavComponent = new SideNavComponent(page)

  await test.step('Log in to OrangeHRM', async () => {
    await loginPage.open(process.env.BASE_URL!)
    await loginPage.login(process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!)
    await expect(sideNavComponent.menu).toBeVisible()
  })
})
```

### Component-Level Page Objects

For widgets reused across pages (the side panel, the top bar, a confirmation dialog), create a separate class. Components follow the same rules as pages.

```typescript
export class SideNavComponent {
  public readonly menu: Locator
  public readonly myInfoLink: Locator
  public readonly recruitmentLink: Locator

  constructor(private page: Page) {
    this.menu = this.page.getByRole('navigation', { name: 'Sidepanel' })
    this.myInfoLink = this.menu.getByRole('link', { name: 'My Info' })
    this.recruitmentLink = this.menu.getByRole('link', { name: 'Recruitment' })
  }

  async openRecruitment() {
    await this.recruitmentLink.click()
  }
}
```

## Instantiating Page Objects in Specs

There is no aggregator class and no `pom` fixture. Each page class is imported directly into the spec that needs it and instantiated with `page` inside the test.

- **Variable name = camelCase of the class name** (`CandidatesPage` → `candidatesPage`), so calls read `await candidatesPage.openAddCandidate()`
- **Instantiate at the top of the test body**, before the first action: one `const` per page the test uses
- **Import only the pages the spec actually uses.** An unused page object in a spec is dead weight
- **Never instantiate at module scope.** `page` is per-test, so a page object built outside the test body leaks state across tests
- **Values captured during the run are declared inside the test, above the steps.** A
  name a form generates (`vacancyName`, `candidateFullName`) is produced in one step
  and consumed in a later one, so it is a `let` at the top of the test body, assigned
  inside the step that creates it. Never at module scope: module state is shared by
  every test in the file and breaks as soon as tests run in parallel
- **Give it an empty-string initializer, never a bare type annotation.** These values are read back through a locator method, and Playwright drops an option that is `undefined`: `candidateRow(undefined)` builds a row locator with no name filter, so a row that should not match matches anyway and the test passes for the wrong reason. `''` keeps the filter and fails loudly instead. The compiler will not choose for you: the assignment happens inside a `test.step()` callback, where definite-assignment analysis gives up

```typescript
test('QA-201 | User can add a candidate and find it in the candidates list', async ({ page }) => {
  const vacanciesPage = new VacanciesPage(page)
  const candidatesPage = new CandidatesPage(page)

  // GOOD: declared in the test, and an unassigned read still filters, so it fails
  let vacancyName = ''
  // BAD: `let vacancyName: string` drops the filter when read unassigned

  await test.step('Create a vacancy for the candidate to apply to', async () => {
    vacancyName = await vacanciesPage.fillVacancyName(testData['QA-201'].vacancy.namePrefix)
    // ...
  })
})
```

- When every test in a `describe` uses the same pages, declare the variables in the `describe` scope and assign them in `beforeEach` (see [Test Suite Hooks](#test-suite-hooks))

When adding a new page class: create `playwright-utils/UI/pages/<area>/<page-name>.ts`
and import it in the specs that need it. There is no central registration step.

**Page objects are grouped by area, never left flat.** `pages/` holds folders, not
classes: `auth/` and `navigation/` for what is shared across modules, and one folder
per OrangeHRM module (`my-info/`, `recruitment/`, later `pim/`, `admin/`, `leave/`),
holding that module's list pages and forms. A new module means a new folder; a page
that belongs to no existing area gets one of its own rather than a home at the root.

## Auth Setup with storageState

Save the authenticated session once instead of logging in through the UI in every test:

```typescript
// tests/UI/auth.setup.ts
import { test as setup } from '@playwright/test'

const adminFile = 'playwright/.auth/admin.json'

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/web/index.php/auth/login')
  await page.getByRole('textbox', { name: 'Username' }).fill(process.env.TEST_USERNAME!)
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard/index')
  await page.context().storageState({ path: adminFile })
})
```

Auth setup intentionally bypasses the page objects: `setup()` blocks run before any test and drive the login form directly. The `.auth/` folder is gitignored.

### Config with Auth Projects

```typescript
// playwright.config.ts pattern
projects: [
  { name: 'auth-setup', testMatch: /UI\/auth\.setup\.ts/ },
  {
    name: 'chromium',
    testMatch: /UI\/.*\.spec\.ts/,
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
    dependencies: ['auth-setup'],
  },
  { name: 'api', testMatch: /API\/.*\.spec\.ts/, fullyParallel: false },
]
```

A spec that tests the login form itself opts out with
`test.use({ storageState: { cookies: [], origins: [] } })`.

## Directory Structure

The suite is split at the top level by **how a test drives the application**: `UI/`
for the browser, `API/` for its HTTP endpoints. The split runs through both trees:
`tests/UI` is served by `playwright-utils/UI`, `tests/API` by `playwright-utils/API`,
and nothing is imported across it. A UI page object never appears in an API spec,
and an API client never appears in a UI one; what genuinely belongs to both is the
environment (`playwright.config.ts`, `.env/`), not shared code.

`tests/` is for spec files and setup files only: everything executable by the test
runner. All support code lives in `playwright-utils/`.

```
tests/
  UI/                          # Driven through a browser page
    my-info/
      my-info.spec.ts          # QA-101, QA-102
    recruitment/
      candidates.spec.ts       # QA-201
  API/                         # Driven through the `api` fixture, no browser
    auth/
      login.api.spec.ts        # QA-301, QA-302

playwright-utils/
  UI/
    pages/                     # One folder per area; never a flat pile of classes
      auth/
        login-page.ts
      navigation/
        side-nav-component.ts  # Components shared across modules
      my-info/
        personal-details-page.ts
        contact-details-page.ts
        emergency-contacts-page.ts
      recruitment/
        candidates-page.ts
        vacancies-page.ts
    test-data/                 # Data only: no functions, no types, no barrel file
      my-info.data.ts
      recruitment.data.ts
    helpers/                   # Stateless utilities with no test data in them
      methods.ts               # labelledField, chooseDropdownOption for OrangeHRM's widgets
  API/                         # See playwright-api-framework.md for the rules on this half
    api-config.ts              # Base URL through the /web/index.php front controller
    core/                      # The framework itself; no application knowledge in here
      request-handler.ts
      logger.ts
      custom-expect.ts
      schema-validator.ts
    fixtures/
      api-fixtures.ts          # api, guestApi, credentials, config, worker-scoped authContext
    clients/                   # Same area folders as pages/; one class per endpoint group
      auth/auth-api.ts         # CSRF token + form sign-in
      admin/users-api.ts
      pim/employees-api.ts
    helpers/
      html-form.ts             # Reads Vue component props out of served HTML
      create-session.ts        # Signs in and returns the context the worker fixture holds
    response-schemas/          # One folder per resource, one file per operation
      admin/GET_users_schema.json
      pim/GET_myself_schema.json
    test-data/
      auth.api.data.ts
```

`playwright.config.ts` names the half each project runs: `testMatch: /API\/.*\.spec\.ts/`
on the `api` project, `/UI\/.*\.spec\.ts/` on `chromium`, `firefox` and `webkit`.
A browser project running an API spec would repeat it three times per run, and each
of those runs creates a real record on a shared demo.

## API Client Conventions

The API half has its own rules file, **[playwright-api-framework.md](./playwright-api-framework.md)**,
and it is the authority for everything under `tests/API/` and `playwright-utils/API/`.
Read it before writing an API client or spec; where it and this file disagree, it wins.

What carries over from the page object unchanged: one class per endpoint group under
`clients/<area>/`, named for the area plus an `Api` suffix (`UsersApi`, file
`users-api.ts`); **no assertions anywhere in `playwright-utils/`**; a method covers
one *job* rather than one HTTP call; parsing the application's markup belongs in the
client or a helper, never in a spec; and every endpoint, header and payload shape is
established by observation, exactly as a locator is.

What differs, and why the framework file is the one to read:

- **The constructor takes a `RequestHandler`, not an `APIRequestContext`**, `AuthApi`
  included. That is what gives every call inside a client method its logging, status
  validation and report step.
- **A validated status is not proof the application accepted the request.** OrangeHRM's
  sign-in answers the same status for a good and a bad password, so the client returns
  the application-level outcome and the spec asserts on that.
- **Specs import `test` and `expect` from `playwright-utils/API/`**, never from
  `@playwright/test`. Otherwise they lose the `api` fixture and the log-attaching matchers.

## Environment-Specific Test Data

Every value a test needs that is not a credential lives under
`playwright-utils/UI/test-data/`, organised as **one object per environment**, each
holding its test case ids and their data.

**A test data file holds data and nothing else**: no functions, no type
declarations, no helpers. Types belong to the page object that consumes the data;
behaviour belongs to the page object that acts on it. A reader opening a data file
should see only values.

**One file per area, not one per module and not one for the suite.** The area is the
folder the specs sit in: `tests/UI/my-info/` is served by `test-data/my-info.data.ts`,
`tests/UI/recruitment/` by `test-data/recruitment.data.ts`. Every module under an area
shares that one file, because modules under an area overlap in what they need (a
candidate case declares the vacancy it creates first), and splitting them per module
duplicates the same blocks across files that then drift apart. Case ids are unique
across the suite, so there is no collision: a module's cases sit together under a
`// <Module> cases` comment inside each environment object, in the same order in all
three. One store for the whole suite is the other extreme: it grows into thousands of
lines and turns every new case into a merge conflict. No barrel file: a spec imports
the one data file its area owns.

The first environment object is written plainly; the others are annotated
`typeof <first>TestData`. That single annotation forces every environment to
declare the same cases with the same fields: a missing case or a dropped field is
a compile error, with no type alias in the file to maintain.

```typescript
// playwright-utils/UI/test-data/recruitment.data.ts

// TEST_ENV selects the data set and defaults to qa.
const ENV = process.env.TEST_ENV || 'qa'

// QA environment test data
const qaTestData = {
  // Candidates cases
  'QA-201': {
    vacancy: { namePrefix: 'QA Vacancy ', jobTitle: 'QA Engineer', hiringManagerHint: 'a' },
    candidate: { firstNamePrefix: 'Qa', emailDomain: 'example.com', /* ... */ },
  },
}

// RC environment test data
const rcTestData: typeof qaTestData = {
  'QA-201': {
    vacancy: { namePrefix: 'RC Vacancy ', jobTitle: 'QA Engineer', hiringManagerHint: 'a' },
    candidate: { firstNamePrefix: 'Rc', emailDomain: 'example.com', /* ... */ },
  },
}

// Regression environment test data
const regressionTestData: typeof qaTestData = { /* same cases, same fields */ }

// Export test data based on environment
let testData = qaTestData
if (ENV === 'rc') {
  testData = rcTestData
}
if (ENV === 'regression') {
  testData = regressionTestData
}

export { testData }
```

The spec imports `testData` and passes values straight into page object methods.
A hyphenated id needs bracket access: `testData.QA-201` is a syntax error, since
`-` parses as subtraction:

```typescript
import { testData } from '../../../playwright-utils/UI/test-data/recruitment.data'

vacancyName = await vacanciesPage.fillVacancyName(testData['QA-201'].vacancy.namePrefix)
await vacanciesPage.selectJobTitle(testData['QA-201'].vacancy.jobTitle)
```

Rules for the store:

- **One object per environment**, named `<env>TestData`, each keyed by test case
  id. A new test case is added to all three objects in the same edit, under the
  `// <Module> cases` comment for the module it belongs to
- **Data only**: a function or an exported type in a data file means logic has
  leaked out of the page object it belongs to
- **Later environment objects are annotated `typeof <first>TestData`**, so the
  compiler enforces that every environment declares every case and every field
- **Resolution reads `process.env.TEST_ENV`** once, at module level, and defaults
  to `qa`. A spec never reads `TEST_ENV` itself
- **Values the application constrains are completed by the page object.** Where a
  field must be unique per run, the data declares a *prefix* and the page object
  that submits the form generates the rest, so the rule lives with the form that
  imposes it. That method returns what it created
- **Credentials stay in `.env/.demo.env`** and reach the spec through
  `process.env.TEST_USERNAME` / `TEST_PASSWORD`, never in the data store
- **Run `npm run typecheck`.** Playwright strips types without checking them, so a
  test run will not catch environment drift; only the type-check will

## Named Timeouts

`playwright.config.ts` owns the defaults every ordinary step runs on. What it cannot
express is a wait that differs *per page*: a list that loads in a second next to a
report that takes much longer behind the same loading spinner. When the suite first
needs such a wait, its numbers go in `playwright-utils/UI/timeouts/timeouts.ts`, so
tuning the suite as the application changes is one edit in one file.

```typescript
export const TIMEOUTS = {
  loader: {
    default: 30_000,    // patience: a page that behaves
    slow: 60_000,       // patience: a route measured to finish late
    appearance: 1_000,  // NOT patience: bounds optional UI, see below
  },
} as const
```

- **A named timeout is patience, not a target.** It is how long a step may take
  before the suite calls it broken. It never encodes how long something *should*
  take
- **Callers pick per call, and only from measurement.** `TIMEOUTS.loader.slow` is
  for a route seen finishing late, not for one that once hung. Slow patience buys
  nothing against a stall; it only delays the failure and hides it
- **Not every number in the file is patience.** `appearance` bounds *optional* UI
  ("did this click load anything at all?") and is paid in full every time the
  spinner is missed, so raising it to be safe multiplies run time across every call.
  Keep the two kinds separate, and say which is which in a comment
- **A named timeout never replaces an assertion's default.** Specs still assert with
  the configured `expect` timeout; these numbers belong to explicit `waitFor` calls
  in helpers and page objects
- **Keep the slow value under the test timeout.** A wait that outlives its test just
  turns one clear failure into a confusing one

## Configuration Best Practices

```typescript
// playwright.config.ts
use: {
  baseURL: process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com',
  trace: 'on-first-retry',          // Trace for debugging failures
  screenshot: 'only-on-failure',    // Screenshot on failure
  video: 'retain-on-failure',       // Video for CI debugging
}
```

The config is also where a slow application is absorbed. When a measured run
genuinely exceeds Playwright's defaults, raise them here, once, with a comment
recording the measurement, so no spec carries a timeout of its own:

```typescript
timeout: 60_000, // Measured: QA-101 runs 22–30s on the shared demo and timed out at 30s
expect: { timeout: 10_000 },
```

## Test Suite Hooks

When all tests in a `test.describe` block share the same setup steps (such as logging in and opening a module), extract them into `test.beforeEach`.

```typescript
import { expect, test } from '@playwright/test'
import { LoginPage } from '../../../playwright-utils/UI/pages/auth/login-page'
import { SideNavComponent } from '../../../playwright-utils/UI/pages/navigation/side-nav-component'
import { PersonalDetailsPage } from '../../../playwright-utils/UI/pages/my-info/personal-details-page'

test.describe('My Info', () => {
  let personalDetailsPage: PersonalDetailsPage

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    const sideNavComponent = new SideNavComponent(page)
    personalDetailsPage = new PersonalDetailsPage(page)

    await loginPage.open(process.env.BASE_URL!)
    await loginPage.login(process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!)
    await sideNavComponent.openMyInfo()
  })

  test('QA-101 | User can update personal details from My Info', { tag: '@regression' }, async () => {
    // ...
  })
})
```

Once `auth.setup.ts` exists, the login lines leave the hook and each test opens the
module directly.

## Anti-Patterns

- **Inline locators inside methods** (`await this.page.getByRole('button', { name: 'Save' }).click()`): every element the class touches is a constructor-assigned property; the method uses it
- **A zero-argument method that only returns a locator** (`menu()`, `saveButton()`): make it a `public readonly` property instead. Methods are for locators parametrized by runtime data
- **A `filter({ has })` locator rooted at a stored parent**: the chain is applied relative to the outer element, so it matches nothing and fails as "element(s) not found" rather than as an error. Root `has` locators at `page`
- **`expect()` anywhere in `playwright-utils/`**: assertions belong to the spec. A page object that imports `expect` is a bug
- **`expect*`-prefixed page object methods** (`expectCandidateSaved`, `expectRowVisible`): replace with a locator property the spec asserts on
- **Single-action methods** (`clickSaveButton`, `fillUsername`): fold them into a multi-step flow. A cross-page navigation method is the one exception
- **Methods spanning two pages**: every navigation marks a method boundary on a different page object
- **Environment values hardcoded in a page object or spec**: they belong in the environment-keyed test data store
- **Duplicate methods differing only in a hardcoded value**: parametrize the existing method instead
- **A central aggregator** (`PageManager`, or a fixture exposing every page object): import and instantiate only the pages a spec uses
- **Page objects constructed at module scope**: build them in the test body or `beforeEach`, where `page` belongs to the current test
- **Run-time values (`let`) at module scope**: declare them inside the test that produces them
- **Fat page objects** with every possible method: only add what tests actually use
- **Shared mutable state** between tests: each test must be independent
- **Skipping cleanup**: a test that creates a record on the shared demo deletes it before it ends, where the app offers a delete path