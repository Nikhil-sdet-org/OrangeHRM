# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Playwright + TypeScript test automation suite for **OrangeHRM** (default target: the public demo at
`https://opensource-demo.orangehrmlive.com`). There is no application source here. Every locator,
endpoint and payload is established against the live app.

## Commands

```bash
npm test                                   # every project: api + chromium/firefox/webkit
npx playwright test --project=api          # the API half only (tests/API/**)
npx playwright test tests/UI/my-info/my-info.spec.ts --project=chromium   # one file, one browser
npx playwright test -g "QA-301" --project=api   # one case by its id in the title
npx playwright test --grep @sanity         # a tagged subset (@sanity, @regression)
npm run headed | npm run debug | npm run ui
npm run codegen                            # record against $BASE_URL
npm run report                             # open the last HTML report
npm run typecheck                          # tsc --noEmit, the only static check (no linter)
```

Run `npm run typecheck` and the affected spec before you hand work off. A test that has never
passed against the live app is still a draft.

## Environment

- `playwright.config.ts` loads `.env/.demo.env` with dotenv. That file (gitignored) holds
  `BASE_URL`, `TEST_USERNAME` and `TEST_PASSWORD`. `.env.example` lists the same keys.
  The public demo's credentials are published on its login page.
- UI specs read the credentials from `process.env`, and the API fixtures (`credentials`,
  `authContext`) do the same.
- `TEST_ENV` (default `qa`) selects which object each `test-data/*.data.ts` file exports
  (`qa` / `rc` / `regression`). It does not select the env file.

## Rules and skills

The authoritative conventions are in `.claude/rules/`. They load automatically for matching paths:

- `playwright-architecture.md`: page objects, fixtures, auth `storageState`, directory layout,
  per-environment test data, named timeouts
- `playwright-scripting.md`: DOM discovery, locator priority, assertions, waiting, test structure
- `playwright-api-framework.md`: the API half (`RequestHandler` transport → clients → specs)

Project skills (`.claude/skills/`): `pw-new-test-cli` (new UI test from live-DOM inspection),
`pw-new-api-test` (new API test), `pw-test-audit` (review recent test changes). Use them for those
tasks, and never skip their `AskUserQuestion` steps.

### Layout

```
tests/UI/<area>/*.spec.ts            # my-info (QA-101, QA-102), recruitment (QA-201)
tests/API/<area>/*.api.spec.ts       # auth/login (QA-301, QA-302)
playwright-utils/UI/                 # pages/<area>/, helpers/, test-data/
playwright-utils/API/                # api-config, core/, fixtures/, clients/<area>/,
                                     # helpers/, response-schemas/, test-data/
```

- `playwright.config.ts` has an `api` project (`testMatch: /API\/.*\.spec\.ts/`,
  `fullyParallel: false`), and chromium, firefox and webkit match `/UI\/.*\.spec\.ts/` only.
- Case ids are grouped by area in blocks of one hundred: QA-1xx My Info, QA-2xx Recruitment,
  QA-3xx Auth (API). A new area takes the next free hundred.
- Dependencies are in place: `dotenv`, `@faker-js/faker` v9 and `ajv`.
- Some pieces the rules describe don't exist yet: API `request-objects/` and
  `helpers/data-generator.ts`, UI `fixtures/` and `timeouts/`. Create each one in the change that
  first needs it.

### How OrangeHRM sign-in and the API work

- **The session is a cookie (`orangehrm`), not a token.** Sign-in is
  `GET /web/index.php/auth/login` (200 HTML, CSRF token in the `<auth-login :token>` prop), then
  a form `POST /web/index.php/auth/validate` (`_token`, `username`, `password`). That POST
  answers 302 for both outcomes, so after the redirect is followed the status is 200 either
  way. `AuthApi.login()` reads the landing page to report `signedIn` and `errorMessage`.
- `RequestHandler` sends the session cookie from its context; there is no auth header. For an
  unauthenticated call, use the `guestApi` fixture (a fresh, never-signed-in cookie jar per test).
  The `api` fixture is signed in through the worker-scoped `authContext`.
- `AuthApi` takes a `RequestHandler`, not a raw `APIRequestContext`, so the sign-in calls are
  logged too.
- Pages are Vue components with server-rendered props of HTML-escaped JSON.
  `helpers/html-form.ts` (`readComponentProp`) reads them, scoped to the component's tag.
- REST endpoints live under `/web/index.php/api/v2/` and answer JSON. Without a session they
  answer `401 {"error":{"message":"Session expired"}}`.

## Key cross-cutting points (details in the rules files)

- The UI and API halves share no code. Only `playwright.config.ts` and the env are common to both.
- Page objects and API clients act and return. All assertions live in specs.
- API specs import `test` from `playwright-utils/API/fixtures/api-fixtures` and `expect` from
  `playwright-utils/API/core/custom-expect`, never from `@playwright/test`. The expected status
  code is passed as the argument to the terminal request method. Specs never assert it with
  `expect`.
- The repo is CommonJS (`"type": "commonjs"`). This matters when you pick dependencies (for
  example, faker v9 rather than the ESM-only v10).