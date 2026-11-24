# Playwright API Framework

These rules govern the **API half of the suite only**: `tests/API/**` and
`playwright-utils/API/**`. The UI half keeps its own conventions
(`playwright-architecture.md`, `playwright-scripting.md`); nothing here crosses the split.

## Three Layers, and What Belongs in Each

The framework is a stack. Every rule below follows from which layer a thing belongs to.

| Layer | Where | Job | Never |
|-------|-------|-----|-------|
| **Transport** | `core/` | Send the request, log it, compare the status, emit the report step | Know what an employee is |
| **Domain** | `clients/`, `helpers/` | Know the paths, the form keys, how to read the app's HTML | Assert |
| **Spec** | `tests/API/` | Drive the journey and decide whether the answer is right | Build a URL or a payload |

A spec never touches the `request` fixture, never builds a URL, never sets a header,
never asserts a status code by hand. A client never calls `expect()`. The transport never
knows a domain noun.

```
tests/API/
  <area>/<module>.api.spec.ts     # specs only; nothing else executable lives here

playwright-utils/API/
  api-config.ts                   # non-secret, non-per-case environment values
  core/                           # the framework; no application knowledge
    request-handler.ts            # the fluent HTTP builder
    logger.ts                     # APILogger: the per-test request/response buffer
    custom-expect.ts              # the extended `expect`: matchers that attach API logs
    schema-validator.ts           # Ajv wrapper, reads response-schemas/
  fixtures/
    api-fixtures.ts               # the extended `test`; every API spec imports this
  clients/<area>/<module>-api.ts  # one class per endpoint group
  helpers/
    html-form.ts                  # reads Vue component props out of served HTML
    create-session.ts             # session acquisition, outside the fixture chain
    data-generator.ts             # payload builders that clone a template and randomize
  request-objects/
    <METHOD>-<resource>.json      # request payload templates
  response-schemas/<resource>/
    <METHOD>_<resource>_schema.json
  test-data/<area>.api.data.ts    # one object per environment, keyed by case id
```

`request-objects/` and `helpers/data-generator.ts` are created in the change that first
needs them.

Two imports open every API spec, and neither is from `@playwright/test`:

```typescript
import { test } from '../../../playwright-utils/API/fixtures/api-fixtures'
import { expect } from '../../../playwright-utils/API/core/custom-expect'
```

Importing `test` or `expect` from `@playwright/test` in an API spec is a bug: the spec
loses the `api` fixture, and every failure loses the request/response log attached to it.

## The Transport Layer: RequestHandler

`RequestHandler` wraps `APIRequestContext` in a fluent builder. A call is described, then
ended with the verb plus the **expected status code**:

```typescript
const myself = await this.api.path('/api/v2/pim/myself').getRequest(200)
```

`apiConfig.baseUrl` is `${BASE_URL}/web/index.php`, because every OrangeHRM route, page or
REST, is served through that front controller. Paths start after it: `/auth/login`,
`/api/v2/admin/users`.

Builder methods, each returning `this`:

| Method | Purpose | Default when omitted |
|--------|---------|----------------------|
| `.url(url)` | Override the base URL for this one call | `apiConfig.baseUrl` |
| `.path(path)` | Path appended to the base URL | `''` |
| `.params(obj)` | Query string, appended via `URLSearchParams` | none |
| `.headers(obj)` | Request headers | none |
| `.body(obj)` | JSON request body | none |
| `.form(obj)` | Form-encoded request body | none |

Terminal methods, each taking the expected status: `getRequest`, `postRequest`,
`putRequest`, `deleteRequest`. The first three return the response body; DELETE returns
nothing.

Rules that hold for every call:

- **The expected status is an argument, never an assertion.** The handler compares it and
  throws with the recent API log attached. `expect(response.status()).toBe(200)` has
  bypassed the framework and lost the log.
- **The body is read by content type.** OrangeHRM answers JSON from `/api/v2` and HTML from
  its pages. An unconditional `.json()` throws *before* the status is compared, turning
  every failure into a parse error.
- **`.form()` and `.body()` are never both sent.** Which one is given decides the content
  type: form-encoded or JSON. Giving both throws.
- **Authentication is the context's cookie jar, not a header.** There is no auth header to
  inject and no `clearAuth()`. An unauthenticated call goes through a handler over a
  context that never signed in (the `guestApi` fixture).
- **Logged bodies are capped at 2,000 characters and the cut is marked.** An HTML page is
  tens of kilobytes; logged whole it buries the request that produced it.
- **`Error.captureStackTrace(error, callingFunction)`** trims the handler's frames off the
  throw, so the failure points at the line that made the call. Any new terminal method
  must do the same.
- **Every call wraps itself in `test.step()`** naming the verb and the resolved URL, so
  the report reads as a list of requests without anyone writing a step.
- **State is cleared after every call** (`cleanUpFields()`): body, form, headers, params,
  path and the one-off base URL. This is what makes one `api` fixture safe to chain
  repeatedly. A new builder field must be added to `cleanUpFields()` in the same edit, or
  it leaks into the next request.

## The Domain Layer: API Clients

An API client is the page object of the API half: it acts and it returns, the spec
verifies. **It takes a `RequestHandler`, not an `APIRequestContext`.** That gives every
call inside it the logging, the status check and the report step for free.

- **One class per endpoint group**, filed under `clients/<area>/`, named for the area plus
  an `Api` suffix (`UsersApi`), file kebab-case (`users-api.ts`)
- **No assertions.** `expect()` never appears under `playwright-utils/`, on either side of
  the split. A method returns what the application answered; the spec decides whether that
  is right
- **Return the application's answer, not a reading of it.** `findUsers` returns the body so
  the spec can assert its contract *and* its meaning; a boolean would quietly reduce an
  error payload to `false`. A lookup returns `''` or `undefined` when the application has
  nothing, never a thrown error and never a default pointing elsewhere
- **Where the status can't be the whole answer, return the outcome.** A method may take
  the expected status as a parameter when a spec needs both sides of it
  (`getMyself(200)` signed in, `getMyself(401)` signed out)
- **A validated status is not proof the application accepted the request.**
  `POST /auth/validate` answers 302 for a good and a bad password alike, so after the
  redirect both end on 200. `AuthApi.login()` therefore returns a `LoginResult`
  (`signedIn`, `errorMessage`) read from the landing page, and the spec asserts on that.
  Where the status genuinely is the whole answer, return `void`; inventing a return value
  to look thorough is noise
- **Where the outcome is only visible as a transport detail, name it in the client.**
  "Signed in lands on the dashboard, rejected re-renders the login page with an error" is
  exactly the knowledge a client exists to hold
- **A method covers one job**, not one HTTP call for its own sake: `login()` fetches the
  login page, reads the CSRF token from the `<auth-login :token>` prop, and posts the form,
  because that is what "sign in" costs in this application
- **Serializing a payload and parsing the app's HTML belong here or in a helper**, never
  in a spec and never duplicated across clients. OrangeHRM pages are Vue components with
  server-rendered props of HTML-escaped JSON; `readComponentProp` reads them, scoped to
  the component's own tag so a match never runs into a neighbouring component
- **No two methods differing only in what they return.** One endpoint, one method
- **Every endpoint, header and payload shape is established by observation**, the same
  way a locator is: drive the flow in a browser with the network log open, then replicate
  what the application's own client sent

## Fixtures

`fixtures/api-fixtures.ts` extends the base `test`. It wires objects together; it contains
no test logic.

- **`authContext` is worker-scoped.** Signing in is one round trip per worker, not one per
  test. OrangeHRM's credential is the **`orangehrm` session cookie**, which lives on the
  context that collected it, and the built-in `request` fixture is test-scoped, so the
  signed-in context itself is the worker fixture. It holds nothing a test mutates, which
  is the rule for worker scope.
- **`apiLogger` is test-scoped** and registered via `setCustomExpectLogger(logger)`. It is
  shared by `api` and `guestApi`, so one failure message carries every call the test made.
- **`api` is test-scoped**: a `RequestHandler` over the worker's signed-in context.
- **`guestApi` is test-scoped**: a `RequestHandler` over the test's own `request` context,
  which has never signed in. Use it for sign-in tests and for proving a call is refused
  without a session.
- **`credentials` and `config` are fixtures**, so a spec reads them as
  `async ({ api, credentials, config })` rather than reading `process.env` or importing
  the config module.
- Code before `await use(...)` is setup; code after it is teardown.

### Authentication

`helpers/create-session.ts` creates its own context, signs in through `AuthApi`, and
returns the signed-in context.

- It **disposes on the failure path only**. The context is the return value, so it cannot
  dispose in `finally`. The fixture owns it afterwards and disposes it in teardown.
- It **verifies the session landed** before returning: first `LoginResult.signedIn`, then
  `getMyself(200)`, because a session-only endpoint answering 200 is the proof the cookie
  actually carries a session. Checked in the helper because every test in the worker
  depends on it.
- It re-throws with `Error.captureStackTrace(error, createSession)`.
- It takes the credentials as parameters: a second role is a second call, not a second
  helper.
- **`AuthApi` takes a `RequestHandler` like every other client**, so the sign-in calls are
  logged too.

## Assertions: the Custom Matchers

`core/custom-expect.ts` extends `expect` with matchers that do what the built-ins do
**plus** append the recent API activity to the failure message. **API specs only.** They
read a logger the API fixtures register, so they mean nothing in a UI spec.

| Matcher | Replaces | Notes |
|---------|----------|-------|
| `shouldEqual(expected)` | `toEqual` | works under `.not`, and logs in that case too |
| `shouldMatch(regexp)` | `toMatch` | |
| `shouldBeLessThanOrEqual(expected)` | `toBeLessThanOrEqual` | |
| `shouldMatchSchema(dir, file)` | none | **async, must be awaited**; validates via Ajv |

- **Prefer the custom matcher over the built-in equivalent.** `toEqual` fails with
  "expected 10, received 0" and says nothing about which call answered 0.
- **If a needed matcher has no `should*` counterpart, add one** rather than reaching past
  the extension. Declare it in the global `PlaywrightTest.Matchers` interface in the same
  file, or TypeScript will not see it.
- **A matcher never calls the API.** It compares what it was given and formats the failure.

## Schema Validation

A response's *shape* is asserted with a JSON Schema file, not a chain of property
assertions.

- Schemas live at `response-schemas/<resource>/<METHOD>_<resource>_schema.json`; the spec
  passes the two halves: `shouldMatchSchema('pim', 'GET_myself')`.
- Ajv runs with `allErrors: true`, so a failure reports every violation and the actual body.
- **Schema asserts shape; a matcher asserts value.** Validate the contract first, then
  assert the specific values the case is about. A changed contract should read as a
  contract failure, not as a missing record.
- Only endpoints that answer JSON can be schema-checked. An HTML page is verified by what
  the client parses out of it.
- A newly covered JSON endpoint gets its schema file in the same change as its first spec.

## Test Data and Payloads

Two stores, with a clean split:

- **`test-data/<area>.api.data.ts` owns the values**: one object per environment, keyed by
  case id, exactly as the UI half does. The first object is written plainly; the others are
  annotated `typeof <first>TestData`, so a case or field missing from one environment is a
  **compile error**. Data only: no functions, no exported types.
- **`request-objects/<METHOD>-<resource>.json` owns the wire shape**: the structure the
  API expects, with empty placeholder values.
- **`helpers/data-generator.ts` joins them.** A builder clones the template, fills it from
  the case's data plus the fields that must be unique per run, and returns it. The spec
  reads the generated value off the returned object rather than re-deriving it.

```typescript
// GOOD: one builder owns the clone and the randomization
const employeeRequest = getNewRandomEmployee(testData['QA-401'].employee)
const created = await employeesApi.addEmployee(employeeRequest)
expect(created.data.firstName).shouldEqual(employeeRequest.firstName)

// BAD: template mutated in place; the next test in this worker inherits the name
employeeRequestPayload.firstName = faker.person.firstName()
```

- **Never mutate an imported JSON template.** It is module state shared by every test in
  the worker. Clone first, with `structuredClone`, or `JSON.parse(JSON.stringify(...))`
  when you want it normalized as the wire will see it.
- **Values unique per run come from `@faker-js/faker`** (the v9 line: v10 is ESM-only and
  this repo is CommonJS), not a hand-incremented counter or a `Date.now()` string.
- **A constraint the application imposes is completed beside the constraint.** A field the
  app caps in length is declared as a *prefix* in data; the generator appends the unique
  half and stays inside the cap.
- **`api-config.ts` holds only what is neither per-case nor secret.** Credentials stay in
  `.env/.demo.env` and reach the fixtures through `process.env`.
- **`npm run typecheck` is the only static check**, and it is what catches environment
  drift. Run it before handing work off.

## Test Titles and Structure

- **Every test title is `<CASE-ID> | <behavior>`**: `test('QA-301 | User can sign in through
  the API and the session belongs to that user', ...)`. The id makes the case selectable
  (`npx playwright test -g "QA-301" --project=api`) and is the key its data is stored
  under. Write it as a literal in both the title and the lookup; a hyphenated key needs
  bracket access (`testData['QA-302']`). No module-level `TEST_CASE_ID` const.
- **An API spec file is named `<module>.api.spec.ts` under `tests/API/<area>/`.** The
  directory routes it to the `api` project; the suffix makes it unmistakable.
- **`test.step()` marks a phase of the journey, not a request.** The handler already emits
  a step per call, and they nest inside. Name a step in the user's language ("Confirm the
  session belongs to the Admin account"), and let a step hold the one or two client calls
  that phase costs.
- **Each step verifies its own outcome**, except where the handler already did: a step
  whose only act is a save needs no assertion, because a bad status threw inside it.
- **One journey per test.** A test that creates a record deletes it before it ends, where
  the application offers a delete path. The demo is shared by everyone who uses it, so
  leftovers pile up for other people too. Where no delete path exists, say so in the spec
  rather than pretending the rule is met.
- **Verify a deletion by its absence**, not by the delete call's status alone.
- **Capture the id the API returns**, never reconstruct it. An update may return a *new*
  one, and the delete must use the updated value.
- **Values produced in one step and read in the next** are declared inside the test, above
  the steps, with an initializer (`let empNumber = 0`), never a bare annotation and never
  at module level. An unassigned id is sent as an empty parameter and the application
  answers about something else.
- Comment out nothing. A commented-out block is deleted, not shipped.

### Data-Driven Cases

Where one behaviour is proven by a table of inputs, iterate the table and generate a test
per row. The table lives in the case's test data:

```typescript
testData['QA-302'].attempts.forEach(({ scenario, username, password }) => {
  test(`QA-302 | Sign-in with ${scenario} is rejected and opens no session`, async ({ guestApi }) => {
    // ...
  })
})
```

The title carries the case id and interpolates the row, never a bare index.

## playwright.config.ts

- **The `api` project matches the API half by directory**: `testMatch: /API\/.*\.spec\.ts/`.
  No browser is launched.
- **The browser projects match `/UI\/.*\.spec\.ts/`.** The split is load-bearing: without
  it every API spec would run once per browser, creating duplicate records on a shared
  environment.
- CI-driven `retries`, `workers` and `forbidOnly` off `process.env.CI`.
- **`fullyParallel: false` is set on the `api` project only**, not suite-wide. These tests
  create real records on a shared demo and are not isolated from one another, and fully
  parallel they would also split a single file across workers, paying one sign-in round
  trip per worker to run a handful of requests. The browser projects keep the suite-wide
  `fullyParallel: true`, where a fresh context per test is the isolation. Files still run
  in parallel: a second API spec file gets its own worker, and its own sign-in.

## Anti-Patterns

- **`import { test } from '@playwright/test'` in an API spec**: loses the `api` fixture
- **`import { expect } from '@playwright/test'` in an API spec**: loses the log-attaching matchers
- **Calling `request.get/post/...` directly in a spec or a client**: bypasses logging,
  status validation and step reporting. Clients take a `RequestHandler`
- **Asserting a status code with `expect`**: it is the terminal method's argument
- **A path, a form key or an HTML regex in a spec**: that is the client's knowledge
- **`expect()` anywhere under `playwright-utils/`**: the handler throws, the spec asserts
- **`shouldMatchSchema` without `await`**: it is async; unawaited it never fails the test
- **Mutating an imported JSON request object**: clone it first
- **A new builder field not added to `cleanUpFields()`**: it leaks into the next request
- **A hardcoded URL, account or record id in a spec**: config field or test-data entry
- **A test title without a case id**: it cannot be selected on the command line
- **A worker-scoped fixture holding per-test state**: worker scope is for the sign-in
  round trip and things like it
- **Skipping the schema file** for a newly covered JSON endpoint
- **Hand-written `test.step()` around a single request**: the handler emits it