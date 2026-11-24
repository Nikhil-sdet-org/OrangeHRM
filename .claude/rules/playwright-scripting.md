---
description: Playwright E2E test authoring conventions - DOM discovery (with or without app source), locators, assertions, waiting, test structure, naming, code style, actions, and form interactions
paths: [tests/**, playwright-utils/**]
---

# Playwright Scripting Rules

## Establishing the DOM First

Every rule below depends on knowing the **real** DOM — exact text, roles, attributes, structure. Never write a locator from assumption. Before authoring locators, establish which of these two modes you are in, and say so in your first message about the task.

### Mode A — Application source code is available

The app's source is in this repo or a checkout you can read.

1. Find the component that renders the page or section under test — grep for a visible string from the UI (`grep -rn "Add to Cart" src/`).
2. Read the markup for exact text, element tags, `aria-*` attributes, existing `data-testid`s, and responsive variants.
3. Copy text into locators **character for character** from the source.
4. When no semantic locator is unique, **add a `data-testid` to the component source** and use it.

### Mode B — Application source code is NOT available

Only the running application is reachable (vendor app, deployed-only environment, no repo access). Inspect the **live DOM** instead of guessing.

The same rule governs the API half of the suite: an endpoint, its headers and its
payload shape are established by watching the application's own client send them —
drive the flow in a browser with `page.on('request')` / `page.on('response')` logging,
then replicate what was actually sent. An endpoint written from assumption is the API
equivalent of a locator written from assumption.

Preferred first step — record against the real app and read what it suggests:

```bash
npx playwright codegen $BASE_URL
```

Codegen's output is a starting point, not the final test: rewrite its locators to follow the priority order below.

For scripted inspection, launch a browser and dump the accessibility tree or the markup of a region:

```typescript
// tests/scratch/inspect.spec.ts — a throwaway probe, never committed
import { test } from '@playwright/test'

test('inspect DOM', async ({ page }) => {
  await page.goto('/')

  // Accessibility tree — the roles and names getByRole can actually target
  console.log(JSON.stringify(await page.accessibility.snapshot(), null, 2))

  // Markup of one region, when the a11y tree is not enough
  console.log(await page.locator('header').innerHTML())

  // Every candidate name for a role
  console.log(await page.getByRole('button').allTextContents())

  // Existing test ids, if the app already ships them
  console.log(await page.locator('[data-testid]').evaluateAll(els => els.map(el => el.dataset.testid)))

  // What is actually visible at the test viewport
  await page.screenshot({ path: 'scratch-home.png', fullPage: true })
})
```

Run it headed to watch the flow: `npx playwright test tests/scratch/inspect.spec.ts --headed --project=chromium`. Read the screenshot to confirm which responsive variant renders.

**Constraints unique to Mode B:**

- You **cannot** add `data-testid` — the source is not yours to edit. When no semantic locator is unique, fall back in this order:
  1. Scope to a semantic ancestor — `getByRole('navigation')`, `page.locator('header')`, `.filter({ hasText })`
  2. A stable non-styling attribute — `[name="email"]`, `[type="submit"]`, `[aria-label="Close"]`, or an `id` that is clearly authored rather than generated
  3. A **stable XPath**, when the element is only reachable through a relationship CSS cannot express (see [XPath](#xpath-when-the-getby-ladder-cannot-reach-it) below)
  4. `.nth()` / `.first()` as a last resort, with a comment stating why no better locator exists
- Styling class names are still banned (`.bg-destructive`, `.text-4xl`). A framework-generated id (`#\:r3\:`, `#mui-4821`, hashed CSS-module classes) is just as unstable — treat it as a class name.
- Delete probe files (and their screenshots) before committing. They are exploration, not tests.

If you can neither read the source nor reach a running app, **stop and tell the user which one you need**. Do not write locators from assumption.

## Locators

### Locator Priority (Highest to Lowest)

1. **`getByRole`** — buttons, links, headings, textboxes, checkboxes (primary approach)
2. **`getByLabel`** — form inputs with associated labels
3. **`getByText`** — static text content, link text
4. **`getByPlaceholder`** — when label is absent
5. **`getByTestId`** — when semantic selectors can't produce a unique, reliable locator. In **Mode A**, when `data-testid` is needed but doesn't exist, **add it to the application component source code** rather than using a fragile alternative locator. In **Mode B**, use the test ids the app already ships; if none exist, drop to the Mode B fallback ladder above. Exhaust role, label, text, and placeholder options first — but **always prefer adding `data-testid` over using CSS selectors based on styling classes or structural paths**.
6. **CSS selector** (`page.locator(...)`) — low priority. Acceptable **only** for stable HTML tags used as structural scoping (e.g., `header`, `nav`, `section`, `footer`) and authored attributes. **Never use CSS class names** (`.font-bold`, `.grid > div`, `.text-4xl`) as locators — add a `data-testid` to the source code instead (Mode A), or scope to a semantic ancestor (Mode B).
7. **XPath** (`page.locator('xpath=...')`) — the last rung, for the case where everything above is genuinely unreliable. See below for what makes one acceptable.

```typescript
// GOOD: role-based (survives UI refactoring)
page.getByRole('textbox', { name: 'email' })
page.getByRole('button', { name: 'Login', exact: true })
page.getByRole('link', { name: 'Sign up' })
page.getByRole('heading', { name: 'Login to your account' })

// GOOD: label-based for form fields
page.getByLabel('Email')
page.getByLabel('Password')

// GOOD: CSS selector for structural scoping (stable tag/attribute)
page.locator('header').getByRole('link', { name: 'Products' })

// BAD: CSS selectors based on styling (break on design changes)
page.locator('.bg-destructive')
page.locator('div > form > input:first-child')
```

### XPath — When the getBy Ladder Cannot Reach It

The `getBy*` ladder is the default and stays the default. But a real application
occasionally renders something none of it can pin down: a cell identified only by
its position relative to a labelled header, a value that lives in the sibling of a
node with no accessible name, an element whose only distinguishing feature is a
relationship rather than an attribute. When that happens, a **stable XPath is a
better answer than a fragile `getBy*`** — a locator that resolves the wrong element
is worse than an ugly one that resolves the right element.

Use it deliberately, not by habit. Before writing one, confirm the ladder actually
fails: inspect the live DOM (Mode B) or the component (Mode A) and check that no
role, label, text, placeholder, test id, authored attribute or ancestor scoping
gives a unique match.

A stable XPath is anchored on **meaning** — text, an authored attribute, a
relationship the page guarantees:

```typescript
// GOOD: anchored on an authored attribute
page.locator('xpath=//input[@name="username"]')

// GOOD: a relationship CSS cannot express. OrangeHRM renders a form label and its
// input in sibling wrappers with no `for` attribute, so getByLabel finds nothing
page.locator('xpath=.//label[normalize-space()="Vacancy Name"]/../following-sibling::div[1]')

// GOOD: anchored on text, scoped to the heading that names the form
page.locator('xpath=//h6[normalize-space()="Add Candidate"]/following-sibling::form')

// BAD: absolute path; one inserted wrapper and it breaks
page.locator('xpath=/html/body/div[1]/div[1]/div[2]/div[2]/div/div/form/div[2]/input')

// BAD: positional index standing in for identity
page.locator('xpath=//div[5]/span[2]')

// BAD: styling classes, exactly as banned in CSS
page.locator('xpath=//div[@class="oxd-input-group oxd-input-field-bottom-space"]')
```

Rules for one that earns its place:

- **Never absolute.** A path from `/html/body` is broken by the next layout change
- **No positional indices as identity** — `tr[4]`, `div[5]`. An index that selects
  *within* a match anchored on meaning (`following-sibling::td[1]`) is fine
- **No styling classes**, and no framework-generated ids — the CSS ban applies
  unchanged; XPath does not launder an unstable hook
- **Prefer `normalize-space()`** over `text()` for anything a human typed, so
  whitespace changes do not break it
- **It carries a comment** saying which rungs of the ladder were tried and why they
  failed. Without that, the next reader cannot tell a considered choice from a lazy one
- **It is still verified unique** against the live app, exactly like any other locator

### Common ARIA Roles for getByRole

Only use roles that actually exist on the page. Some HTML elements have **implicit roles** that depend on context:

| Role | HTML Element | Notes |
|------|-------------|-------|
| `button` | `<button>`, `<input type="submit">` | Always works |
| `link` | `<a href="...">` | Must have `href` |
| `heading` | `<h1>`–`<h6>` | Use `{ level: 1 }` to target specific level |
| `textbox` | `<input type="text">`, `<textarea>` | Also `type="email"`, `type="password"` |
| `checkbox` | `<input type="checkbox">` | Always works |
| `combobox` | `<select>` | Always works |
| `navigation` | `<nav>` | Always works — **use this to scope to nav menus** |
| `dialog` | Modals, sheets, drawers (component libraries) | Set via `role="dialog"` attribute |
| `tab` | Tab components (component libraries) | Set via `role="tab"` attribute |
| `table`, `row`, `cell` | `<table>`, `<tr>`, `<td>` | Always works |
| `article` | `<article>` | Always works |
| `banner` | `<header>` | **Only when `<header>` is a direct child of `<body>`** — does NOT work when nested inside `<section>`, `<article>`, `<aside>`, `<main>`, or `<nav>` |
| `contentinfo` | `<footer>` | Same rule as `banner` — only as direct child of `<body>` |
| `region` | `<section>` | **Only when `<section>` has an accessible name** (via `aria-label` or `aria-labelledby`) |

In Mode B, `page.accessibility.snapshot()` is the authority on which of these roles actually resolved — check it rather than inferring the role from an assumed tag.

**When `getByRole('banner')` or `getByRole('contentinfo')` won't match** (common case — header/footer nested inside sections), use a CSS selector instead:

```typescript
// BAD: header is nested inside <section>, so 'banner' role doesn't apply
page.getByRole('banner').getByRole('link', { name: 'Blog' })

// GOOD: CSS selector for the <header> element
page.locator('header').getByRole('link', { name: 'Blog' })

// GOOD: scope to <nav> which always has 'navigation' role
page.getByRole('navigation').getByRole('link', { name: 'Blog' })
```

### Locator Text Must Match the Rendered DOM Exactly

Use the **exact text** the application renders — from the component source in Mode A, from the accessibility snapshot or `allTextContents()` in Mode B. Never assume or paraphrase element text. Also watch for **responsive variants** — the same component may render different text or different elements at different viewport sizes (e.g., mobile vs desktop via Tailwind `hidden md:flex` classes). Match the variant that is **visible at the test viewport** (Desktop Chrome by default); in Mode B, a full-page screenshot at that viewport tells you which variant is live.

```typescript
// Source has two buttons: "View Details" (mobile) and "Details" (desktop)
// Tests run in Desktop Chrome — use the desktop-visible text

// GOOD: matches the desktop-visible element
page.getByRole('button', { name: 'Details' })

// BAD: matches the mobile element hidden at desktop viewport
page.getByRole('button', { name: 'View Details' })
```

### Locator Uniqueness

Locators used with action methods (`click()`, `fill()`, `check()`, `selectOption()`) **must resolve to exactly one element**. Before writing a locator, verify it is unique — read the component source (Mode A), or check `await locator.count()` against the running app (Mode B). If multiple elements match, narrow the scope by chaining with a parent locator.

When a locator intentionally returns multiple elements (e.g., collecting a list of menu items, table rows, or card elements for iteration), uniqueness is not required — use `all()`, `count()`, or `nth()` as needed.

```typescript
// GOOD: scoped to navigation — resolves to one element
page.getByRole('navigation').getByRole('link', { name: 'Products' })

// BAD: matches multiple elements on the page — click() will fail
page.getByRole('link', { name: 'Learn More' })

// GOOD: intentionally working with a collection
const articles = await page.getByRole('article').all()
await expect(articles).toHaveCount(3)
```

### Rows an Inline Grid Appends: Address by Index, Never `.last()`

An editable grid whose "Add" button appends a row appends it **asynchronously**: the
row lands some time after the click resolves. A locator ending in `.last()` resolves
against whatever is on the page at that moment, which is the *previous* row, so the
fills land in the row before and silently overwrite it. The failure surfaces much
later and looks nothing like its cause.

Address the row this iteration owns by its index instead. Until the grid appends
row `n`, `.nth(n)` matches nothing and the action keeps polling: the wait comes free
from the locator, with no explicit guard.

```typescript
// BAD: .last() is the previous row until the new one is appended
await this.addRowButton.click()
await this.nameInputs.last().fill(name)

// GOOD: nth(index) waits for the row this iteration owns
for (let index = 0; index < rowCount; index++) {
  await this.addRowButton.click()
  await this.nameInputs.nth(index).fill(rows[index].name)
  await this.amountInputs.nth(index).fill(rows[index].amount)
}
```

This is why every grid field on such a form is stored as a **plural** locator
matching one element per row (`nameInputs`, `amountInputs`): the class holds the
column, and the method picks the row.

### Scoping to Containers (Avoiding False Positives)

When a page has repeated UI patterns (pricing cards, product rows, list items), **always scope interactions and assertions to the specific container** — never rely on `.first()` or unscoped locators that could accidentally match an element from a different section.

A false positive occurs when the intended element is missing but the locator silently matches a different element elsewhere on the page, making the test pass incorrectly.

```typescript
// BAD: clicks the first "Add to Cart" on the page — may not be inside the first card
page.getByRole('button', { name: 'Add to Cart' }).first().click()

// GOOD: scope to the specific pricing card, then find the button within it
// Mode A: add data-testid="pricing-card" to the source code if it doesn't exist
// Mode B: scope by unique text instead — page.locator('section', { hasText: 'Pro Plan' })
const firstCard = page.getByTestId('pricing-card').nth(0)
await firstCard.getByRole('button', { name: 'Add to Cart' }).click()

// BAD: asserts price anywhere in the dialog — could match the total instead of the item price
await expect(page.getByRole('dialog')).toContainText('$99')

// GOOD: scope to the cart item's price element via data-testid
// Mode B alternative: page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'Pro Plan' })
await expect(page.getByRole('dialog').getByTestId('cart-item-price')).toContainText('$99')

// BAD: asserts button visibility anywhere on the page
await expect(page.getByRole('button', { name: 'View Cart' }).first()).toBeVisible()

// GOOD: asserts button within the specific card
await expect(firstCard.getByRole('button', { name: 'View Cart' })).toBeVisible()
```

**Rule of thumb:** if a locator uses `.first()`, `.nth()`, or matches a generic label like "Remove", "Add to Cart", "Submit" — it likely needs a parent scope to be precise. When the parent container has no semantic role or unique text, **add a `data-testid`** to the source code (Mode A) rather than using CSS class selectors; in Mode B, scope through the nearest ancestor that carries unique text or a semantic role.

### Semantic Scoping (Asserting Relationships)

Scoping is not only about disambiguating repeated elements — it also validates that elements appear in the **correct logical context**. Even when a text or element is unique on the page, scope it to its meaningful parent section if the test is verifying a relationship between elements.

**Key question:** "If this value moved to a different section of the page, would that be a bug?" If yes — the assertion must include a scope that pins it to the correct section.

**How to identify scoping opportunities:**
1. Understand the page's sections, cards, and containers — from the component source (Mode A), or from the accessibility snapshot and region `innerHTML()` (Mode B)
2. For each assertion, identify which section or component the value logically belongs to
3. Build a locator chain that starts from the nearest meaningful parent (a container with unique text, a `data-testid`, or a semantic role)
4. Use `.filter()` with `hasText` or `has` to express parent-child relationships between elements

```typescript
// Page has a "Summary" section and a "Details" card that both display counts

// BAD: asserts text exists anywhere — passes even if it appeared in the wrong section
await expect(page.getByText('3 of 5 completed')).toBeVisible()

// GOOD: scoped to the section where this count belongs
await expect(page.getByTestId('summary-panel')).toContainText('3 of 5 completed')

// A user's tag shows an "Owner" badge. Other users' tags do not.

// BAD: "Owner" anywhere on the page is accepted — doesn't verify it's attached to the right user
await expect(page.getByText('Owner')).toBeVisible()

// GOOD: scoped to the specific user's tag — verifies the badge belongs to the correct user
const ownerTag = page.getByTestId('user-tag').filter({ hasText: ownerEmail })
await expect(ownerTag).toContainText('Owner')

// A team member was added to a specific project card, not just anywhere on the page

// BAD: asserts the member exists somewhere on the page
await expect(page.getByText(memberEmail)).toBeVisible()

// GOOD: scoped to the project card — confirms the member is in the right project
const projectCard = page.getByTestId('project-card').filter({ hasText: 'Project Alpha' })
await expect(projectCard.getByText(memberEmail)).toBeVisible()
```

### Cross-Page Content Linking

When a user action navigates from one page to another, and the destination page displays content related to the source page (e.g., clicking a product card opens that product's detail page), **capture a value from the source page and assert it on the destination page**. This validates the user landed on the correct page — not just any page of the same type.

**Key question:** "How do I know the user arrived at the *right* destination, not just *a* destination of the same kind?" If a heading, title, or label from the source page should appear on the destination — capture it before navigating and assert it after.

```typescript
// User clicks on an item in a list → opens its detail page

// BAD: asserts any h1 exists — passes even if the wrong item opened
await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

// BAD: asserts a feature only present on detail pages — confirms the page type but not which item
await expect(page.getByRole('button', { name: 'Add to Favorites' })).toBeVisible()

// GOOD: capture item name from source page, assert it on destination
const itemNameValue = await listItem.getByRole('heading').textContent()
await listItem.getByRole('link', { name: 'View Details' }).click()
await expect(page.getByRole('heading', { level: 1, name: itemNameValue!.trim() })).toBeVisible()
```

This pattern applies whenever navigation creates a logical link between pages: clicking a list item → detail page, clicking an article title → article page, clicking an order row → order detail, etc.

### Chaining and Filtering

Prioritize the built-in `name` or `hasText` argument on the locator constructor for filtering. Use `.filter()` only when a **second level** of filtration is needed on an already-constructed locator.

```typescript
// GOOD: use name argument for role-based filtering (preferred)
page.getByRole('button', { name: 'Submit' })
page.getByRole('link', { name: 'Courses' })
page.getByRole('heading', { name: 'Dashboard' })

// GOOD: use hasText option on CSS locator constructor
page.locator('section', { hasText: 'About the Team' })
page.locator('section', { has: page.getByRole('heading', { name: 'About the Team' }) })

// GOOD: chain to narrow scope
page.getByRole('navigation').getByRole('link', { name: 'Products' })
page.locator('section', { hasText: 'Featured Items' }).getByRole('link', { name: 'View All' })

// GOOD: .filter() for second-level filtration on an existing locator
page.getByRole('row', { name: 'John' }).filter({ has: page.getByRole('cell', { name: 'Active' }) })

// BAD: using .filter() when constructor option suffices
page.locator('section').filter({ hasText: 'About the Team' })
page.getByRole('button').filter({ hasText: 'Submit' })

// BAD: using index when text-based scoping is possible
page.locator('section').first()
```

## Assertions

### Assertions Live in the Spec File

**Every `expect()` belongs in the spec file.** Page objects and components contain
actions and locator properties only — never an assertion, not even a "stabilizing"
one. A reader must be able to open the spec and see everything the test verifies
without following a call into `playwright-utils/`.

To assert against an element a page object owns, expose it as a **`public readonly`
locator property** and assert on it from the spec. Assertions auto-wait on a stored
locator exactly as they do on an inline one — a `Locator` is a lazy descriptor, and
it re-resolves against the live DOM on every poll. See
[Page Object Conventions](./playwright-architecture.md#page-object-conventions).

```typescript
// GOOD: the page object acts and exposes, the spec verifies
vacancyName = await vacanciesPage.fillVacancyName(testData['QA-201'].vacancy.namePrefix)
await vacanciesPage.saveVacancy()
await expect(vacanciesPage.savedVacancyNameInput).toHaveValue(vacancyName)

// BAD: assertion hidden inside the page object
async saveVacancy() {
  await this.saveVacancyButton.click()
  await expect(this.editVacancyHeading).toBeVisible()  // belongs in the spec
}
```

Removing an assertion from a page object does not make the flow racy: `click()`,
`fill()` and `check()` already auto-wait for actionability, so the next action
waits on its own. Where a genuine guard is needed before a non-auto-waiting call,
use `waitFor()` — not `expect()` — inside the page object.

### Locator Assertions (Auto-Retrying)

Locator assertions poll until the condition is met or timeout. Always prefer these.

```typescript
// GOOD: assert text content on a unique element
await expect(page.getByRole('heading')).toHaveText('Dashboard')
await expect(page.locator('header')).toContainText('Welcome back')

// GOOD: assert element state
await expect(page).toHaveURL('/dashboard')
await expect(page.getByRole('textbox', { name: 'email' })).toHaveValue('test@example.com')
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled()
await expect(page.getByRole('button', { name: 'Submit' })).toBeDisabled()
await expect(page.getByRole('listitem')).toHaveCount(5)

// GOOD: toBeVisible when unique locator via text is not compact
await expect(page.getByRole('button', { name: 'John Doe' })).toBeVisible()
```

Prefer `toHaveText` / `toContainText` on a unique locator over `getByText(...).toBeVisible()` — it asserts the content directly rather than checking visibility of a text match.

### Generic Assertions (No Retry)

Overall, avoid using Generic Assertions.

```typescript
// BAD: generic assertion — no retry, race condition prone
const text = await page.textContent('.header')
expect(text).toBe('Dashboard')

// BAD: manual check — does not retry
const isVisible = await page.locator('.toast').isVisible()
expect(isVisible).toBe(true)
```

### Negative Assertions

After an action that triggers a DOM change (click, fill, etc.), add a dynamic wait **before** the negative assertion to avoid false positives. The DOM may not have updated yet when the assertion runs.

```typescript
// GOOD: wait for API to complete before asserting absence
await page.getByRole('button', { name: 'Delete' }).click()
await page.waitForResponse(resp =>
  resp.url().includes('/api/') && resp.status() === 200
)
await expect(page.getByRole('dialog')).not.toBeVisible()

// GOOD: verify element was removed from DOM
await expect(page.getByRole('dialog')).toBeHidden()
```

### No Soft Assertions

Do not use `expect.soft()`. Every assertion should fail the test immediately.

## Waiting

### Playwright Auto-Waits on Actions

`click()`, `fill()`, `check()`, `selectOption()` — all auto-wait for the element to be actionable AND auto-scroll to it. Do NOT add explicit waits or `scrollIntoViewIfNeeded()` before actions.

```typescript
// GOOD: auto-waits for element to be ready
await page.getByRole('button', { name: 'Submit' }).click()

// BAD: redundant wait
await page.getByRole('button', { name: 'Submit' }).waitFor()
await page.getByRole('button', { name: 'Submit' }).click()
```

### When You Need Explicit Waits

Add explicit waits only before steps that do **not** have built-in auto-waiting. Action methods (`click()`, `fill()`, `check()`) and locator assertions (`toBeVisible()`, `toHaveText()`) all auto-wait — no explicit wait needed before them.

Methods that **require** a preceding explicit wait (they resolve instantly, no auto-wait):
- `all()`, `count()`, `allTextContents()`, `textContent()`, `inputValue()`

```typescript
// GOOD: locator assertion auto-waits after navigation — no waitForURL needed
await page.getByRole('link', { name: 'Blog' }).click()
await expect(page.getByRole('heading', { name: 'Latest Articles' })).toBeVisible()

// BAD: redundant waitForURL when next step is a locator assertion
await page.getByRole('link', { name: 'Blog' }).click()
await page.waitForURL('**/blog')  // unnecessary — the assertion below already waits
await expect(page.getByRole('heading', { name: 'Latest Articles' })).toBeVisible()

// GOOD: wait for API before using non-auto-waiting methods
await page.waitForResponse(resp =>
  resp.url().includes('/api/') && resp.status() === 200
)
const items = await page.getByRole('listitem').all()

// GOOD: wait for specific network request to complete
const responsePromise = page.waitForResponse(resp =>
  resp.url().includes('/api/') && resp.status() === 200
)
await page.getByRole('button', { name: 'Save' }).click()
await responsePromise

// GOOD: wait for element state
await page.getByRole('dialog').waitFor({ state: 'hidden' })
```

### Prefer an Observable Outcome to Patience

A timeout says how long to tolerate not knowing. When the action has an outcome you
can observe, wait for *that* instead: it is exact, it costs only what the work costs,
and there is no number to retune when the application changes.

Ranked by preference:

1. **An auto-waiting assertion or action** — the outcome is the next step, so nothing
   extra is written at all
2. **The request the action fires** — `waitForResponse` on the endpoint, when the
   result is a data swap with no visible marker of its own
3. **A state change in the DOM**: `waitFor({ state: 'hidden' })` on the loading
   spinner a click raises, when nothing better exists
4. **A bounded wait** — only for UI that may never appear (see above)

The difference is not academic. Waiting on a loading spinner that the data swap
outruns means the spinner is never caught going up, so every call pays the full
appearance bound just to discover there was nothing to wait for. Waiting on the
request the action fires costs only what the request costs.

```typescript
// GOOD: the response is the signal, and it costs what the request costs
const listLoaded = page.waitForResponse(
  (response) => response.url().includes('/api/v2/pim/employees') && response.status() === 200,
)
await nextPageButton.click()
await listLoaded

// WORSE: waits on a side effect that may already be over, and pays a bound to find out
await nextPageButton.click()
await waitForLoadingToFinish(page)
```

Reach for the spinner when the action has no observable outcome of its own, such as a
module swap or a save that lands on a page you have not identified yet. Reach for the
request when you know which one it is. On OrangeHRM the request is usually easy to
name: every list and form talks to `/web/index.php/api/v2/`.

### Never Use Arbitrary Timeouts

```typescript
// BAD: slow, unreliable, hides real issues
await page.waitForTimeout(3000)
```

Rely on the natural flow of action methods (`click()`, `fill()`) and locator assertions instead of arbitrary waits.

### No Custom Timeouts by Default

Always rely on the default timeouts configured in `playwright.config.ts`. Do not add custom timeouts to:
- `test.setTimeout()` — do not override the test-level timeout
- `toBeVisible({ timeout: ... })` — do not add timeout to assertions
- `waitForURL(..., { timeout: ... })` — do not add timeout to URL waits
- Any other method that accepts an optional `timeout` parameter

Custom timeouts are allowed **only as a debugging fix** — when the test fails due to a timeout and investigation confirms the default timeout is genuinely insufficient for that step. Never add them preemptively in the first draft of a test.

```typescript
// BAD: preemptive timeout in first draft
await expect(page.getByRole('heading', { name: 'Success' })).toBeVisible({ timeout: 30000 })

// GOOD: use default timeout
await expect(page.getByRole('heading', { name: 'Success' })).toBeVisible()
```

#### Waits the config cannot express: `TIMEOUTS`

The rule above is about *specs*, and it still holds: a spec never invents a number.
What the config cannot express is a wait that differs per page: some clicks answer in
under a second and others take much longer behind the same loading spinner, and one
global default cannot be right for both.

Those numbers live in `playwright-utils/UI/timeouts/timeouts.ts` (created when first
needed) and reach the code as names, never as literals:

```typescript
// GOOD: named, chosen per call, tunable in one place
await waitForLoadingToFinish(page, TIMEOUTS.loader.slow)

// BAD: the same number, invented at the call site
await loadingSpinner.waitFor({ state: 'hidden', timeout: 60_000 })
```

The helper carries the default, so most callers pass nothing at all. Pass a name only
where a route has been *measured* finishing late, not where it once hung, since
patience does nothing for a stall except postpone the failure. See
[Named Timeouts](./playwright-architecture.md#named-timeouts) for what belongs in
that file.

#### The one exception: UI that may never appear

Some UI is genuinely optional: it renders on some sessions and not others, and
nothing in the DOM says in advance which run this is. A "what's new" popup or an
announcement banner shown once per user is the typical case: its close control may
already be in the DOM, so presence proves nothing, and it may draw a moment *after*
the page finishes loading, so an instant visibility check reads it as absent.

Waiting for it with the default timeout fails the run where it never comes; not
waiting fails the run where it comes late. Here, and only here, a **short, bounded
wait** is correct, because the bound is deliberately *shorter* than the default, not
longer:

```typescript
// Measured over N runs: the popup appears <slowest>s after the page loads,
// so the bound is a small multiple of the slowest observed.
await this.announcementPopup.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})

if (await this.announcementPopup.isVisible()) {
  await this.closeAnnouncementButton.click()
  await this.announcementPopup.waitFor({ state: 'hidden' })
}
```

Every one of these conditions must hold, or it is the anti-pattern above wearing a
comment:

- The element is **optional**: a run where it never appears is a normal run, not a
  failure. UI that must appear is waited for with the default and nothing else
- The bound is **measured**, across every environment the case runs on, and the
  measurement is written in the comment beside it. A guessed number is not evidence
- The bound is a **small multiple of the slowest observed** appearance, and shorter
  than the configured default. A bound longer than the default is a config change,
  not this
- The wait is **paired with a visibility branch**. A bounded wait whose result is
  never read is just a sleep
- It lives in a **page object**, not a spec, and the swallowed rejection is the
  timeout only, never a way to make a flaky step pass

Before reaching for this, check that the element really is optional: measure it
first, as above. Almost every "sometimes it's there" turns out to be a missing wait
for something else, and this exception is not the place to park that.

When the application itself is slow (a shared demo under load, a loading spinner that
swallows clicks), the fix is to **raise the defaults in `playwright.config.ts`**, not
to sprinkle timeouts through the specs. Measure the real figure first, then set
`timeout`, `expect.timeout` and `actionTimeout` from that measurement and record why
in a comment. Tests stay timeout-free, and one edit covers the whole suite.

```typescript
// playwright.config.ts
timeout: 60_000, // Measured: QA-101 runs 22–30s on the shared demo and timed out at 30s
expect: { timeout: 10_000 },
```

## Test Structure

### Naming Convention

Test names describe **user behavior**, not implementation details, and are
prefixed with the **test case ID** in the form `<ID> | <behavior>`. The ID makes
the case selectable on the command line (`npx playwright test -g "QA-201"`) and is
the key its data is stored under.

Write the ID as a literal in both the title and the data lookup. A spec file
holds many cases, so a module-level `TEST_CASE_ID` const does not scale — and a
literal at the call site keeps the id next to the test that uses it. Note that a
hyphenated id needs bracket access: `testData.QA-201` is a syntax error.

```typescript
// GOOD: the id is a literal in the title and in the data lookup
test('QA-201 | User can add a candidate and find it in the candidates list', async ({ page }) => {
  vacancyName = await vacanciesPage.fillVacancyName(testData['QA-201'].vacancy.namePrefix)
  // ...
})

// GOOD: behavior-first titles behind their ids
test('QA-102 | User can add an emergency contact from My Info', ...)
test('QA-302 | Sign-in with a wrong password is rejected and opens no session', ...)

// BAD: no test case id
test('User can log in with valid credentials', ...)

// BAD: a module-level const; it reads well in a file with one test and becomes
// thirty near-identical consts in a file with thirty
const TEST_CASE_ID = 'QA-201'

// BAD: describes implementation
test('test login', ...)
test('POST /auth/validate should return 302', ...)
test('CandidatesPage renders', ...)
```

### Always Start from the Application Root

Every UI test starts from the application root (`BASE_URL`), which on OrangeHRM lands
on the login page, and reaches the page under test through the UI: the side panel,
the top bar, buttons and links. Never `goto` an inner route such as
`/recruitment/addCandidate`: the journey a user takes is part of what the test proves.

```typescript
// GOOD: starts at the root, navigates via UI
await loginPage.open(process.env.BASE_URL!)
await loginPage.login(process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!)
await sideNavComponent.openRecruitment()

// BAD: jumps straight to an inner page
await page.goto('/web/index.php/recruitment/addCandidate')
```

Once `auth.setup.ts` saves the session, a test starts signed in at the root and still
navigates from there.

### Grouping with describe

```typescript
test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('User can log in with valid credentials', async ({ page }) => { ... })
  test('User sees error for invalid password', async ({ page }) => { ... })
  test('User can navigate to forgot password', async ({ page }) => { ... })
})
```

### Structure the Test Body with `test.step()`

Every test body is divided into `test.step()` blocks — **one step per phase of the
user journey**, named for what the user is doing. Steps make the HTML report and
the trace readable: each step collapses to a single line with its own duration,
and a failure points at the phase that broke rather than at a bare line number.

Each step contains the actions for that phase **and the assertions that verify
it**. Do not collect every assertion into a trailing "verify" step — a phase is
only finished when it has been checked.

```typescript
// GOOD: one step per phase, each verifying its own outcome
test('QA-201 | User can add a candidate and find it in the candidates list', async ({ page }) => {
  const loginPage = new LoginPage(page)
  const sideNavComponent = new SideNavComponent(page)
  const candidatesPage = new CandidatesPage(page)

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
})

// BAD: flat body; the trace is an undifferentiated list of clicks
test('QA-201 | User can add a candidate', async ({ page }) => {
  await loginPage.login(...)
  await sideNavComponent.openRecruitment()
  await candidatesPage.openAddCandidate()
})

// BAD: assertions pooled in a trailing step instead of verifying each phase
await test.step('Log in', async () => { await loginPage.login(...) })
await test.step('Verify everything', async () => {
  await expect(sideNavComponent.menu).toBeVisible()
  await expect(page).toHaveURL(/\/recruitment\/viewCandidates$/)
})
```

Page objects are instantiated and test data resolved **before the first step**, so
the steps hold only the journey. Keep step names in the user's language ("Add a
candidate"), not the code's ("call fillCandidateName").

### One Logical Flow Per Test

Each test should verify one user journey or behavior. Avoid combining unrelated
assertions. A test with many `test.step()` blocks is still one flow as long as the
steps are consecutive phases of a single journey — steps are for structure, not
for stitching unrelated journeys into one test.

```typescript
// GOOD: focused test — one journey, verified as it goes
test('QA-001 | User can log in with valid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page)
  const sideNavComponent = new SideNavComponent(page)

  await test.step('Log in with valid credentials', async () => {
    await loginPage.open(process.env.BASE_URL!)
    await loginPage.login(process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!)
    await expect(page).toHaveURL(/\/dashboard\/index$/)
    await expect(sideNavComponent.menu).toBeVisible()
  })
})

// BAD: tests multiple unrelated things
test('login page', async ({ page }) => {
  // tests login, then navigation, then profile, then logout...
})
```

## Test Code Style

### Locator Constants

Extract locators into constants **only** when:
- The locator is **repeated 3+ times** in the test
- The locator is **not self-descriptive** (e.g., relies on CSS selectors with no readable context) AND is used **2+ times**

Do NOT extract locators into constants when:
- The locator is **self-descriptive** (has `name`, `hasText`, or other readable arguments) AND is used only **1–2 times**
- The constant is only used as an **intermediate step** to build another locator — inline the chain instead

```typescript
// BAD: unnecessary constant — locator is self-descriptive and used twice
const tableOfContentsNav = page.locator('nav', { hasText: 'Table of contents' })
await expect(tableOfContentsNav).toBeVisible()
const items = await tableOfContentsNav.getByRole('link').allTextContents()

// GOOD: inline the self-descriptive locator
await expect(page.locator('nav', { hasText: 'Table of contents' })).toBeVisible()
const tocLinkTexts = await page.locator('nav', { hasText: 'Table of contents' }).getByRole('link').allTextContents()

// BAD: intermediate constants used only to build the next constant
const pricingSection = page.locator('#pricing')
const pricingCards = pricingSection.getByTestId('pricing-card')
const firstCard = pricingCards.nth(0)

// GOOD: inline the chain
const firstCard = page.getByTestId('pricing-card').nth(0)

// GOOD: constant justified — opaque CSS selector with no readable context, used 2+ times
const authorAvatar = page.locator('main header [class*="rounded-full"]')
```

In a spec that drives page objects, this rule rarely applies: the locators the
spec asserts on are the page object's own properties, so the spec writes
`candidatesPage.candidateSavedMessage` or, for a locator parametrized by runtime
data, `candidatesPage.candidateRow(candidateFullName)`, rather than re-declaring the
locator. Never rebuild a locator in the spec that a page object already exposes.

### No Hardcoded Environment Data

A spec must not contain a value that differs between environments: a job title, a
hiring manager, an account, a record id, a URL. Those live in the environment-keyed
test data store and reach the spec through its test case ID; credentials come from
`process.env`. See
[Environment-Specific Test Data](./playwright-architecture.md#environment-specific-test-data).

```typescript
// GOOD: every environment-specific value arrives from the store
await vacanciesPage.selectJobTitle(testData['QA-201'].vacancy.jobTitle)

// BAD: literal that only exists on one environment
await vacanciesPage.selectJobTitle('QA Engineer')

// BAD: branching on the environment inside the spec
const jobTitle = process.env.TEST_ENV === 'rc' ? 'QA Engineer' : 'QA Lead'
```

Fixed values that are genuinely identical everywhere (a phone number typed into a
form, a notes string) belong in the store too: keeping the whole record in one place
is what lets a single test run against every environment.

### `data-testid` Naming

Applies when you own the application source (Mode A) and are adding a test id. `data-testid` values must name the **element** (a noun like `button`, `badge`, `checkmark`, `input`, `dialog`), not just a state or action. Use the form `<subject>-<descriptor>-<element>` so the locator is self-explanatory without reading the source.

```typescript
// BAD: ends with an action/state — doesn't say what element this is
page.getByTestId('lesson-completed')

// GOOD: includes the element (checkmark) that the testid points to
page.getByTestId('lesson-completed-checkmark')
```

In Mode B you consume whatever test ids the app already ships — do not rename them, and do not invent ids that aren't in the DOM.

### Reuse Locator Constants

Locators are lazy — they re-resolve against the current DOM on every use. Reuse the same constant across all phases of the test (including after navigation or data refreshes). Do not re-declare the same locator under variant names like `*AfterUpdate`, `*AfterRevert`.

```typescript
// BAD
const courseCard = programCard.getByRole('link', { name: courseNameValue })
// ... navigate away and back ...
const courseCardAfterUpdate = programCard.getByRole('link', { name: courseNameValue })

// GOOD — reuse the existing constant
const courseCard = programCard.getByRole('link', { name: courseNameValue })
// ... navigate away and back ...
await expect(courseCard).toBeVisible()
```

### Variable Naming

Use **descriptive names** — no abbreviations or acronyms. The name should make the variable's purpose immediately clear without needing to read its assignment.

Name the variable after **what it holds**, not what the locator targets. When a method like `allTextContents()`, `textContent()` or `inputValue()` extracts text values, the variable name should end with **`Values`** or **`Texts`** — not `Links`, `Headings`, etc. Reserve element-type names for variables holding locators.

```typescript
// BAD: abbreviations
const tocNav = page.locator('nav', { hasText: 'Table of contents' })
const tocItems = await tocNav.getByRole('link').allTextContents()

// BAD: "Links" and "Subheadings" imply locators, but these hold text strings
const tableOfContentsLinks = await page.locator('nav', { hasText: 'Table of contents' }).getByRole('link').allTextContents()
const articleSubheadings = await page.getByRole('article').getByRole('heading', { level: 2 }).allTextContents()

// GOOD: "Values" suffix reflects that allTextContents() returned strings
const tableOfContentsValues = await page.locator('nav', { hasText: 'Table of contents' }).getByRole('link').allTextContents()
const articleSubheadingValues = await page.getByRole('article').getByRole('heading', { level: 2 }).allTextContents()

// GOOD: locator variable — element-type name is appropriate
const tableOfContentsLinks = page.locator('nav', { hasText: 'Table of contents' }).getByRole('link')
```

## Actions

### Repeated Clicks on the Same Element

When the same element needs to be clicked multiple times in a row (e.g., bumping a quantity selector, stepping through a counter), pass `clickCount` to a single `click()` call instead of repeating the line.

```typescript
// BAD: repeated click lines on the same element
await page.getByRole('button', { name: 'Increase quantity' }).click()
await page.getByRole('button', { name: 'Increase quantity' }).click()

// GOOD: single call with clickCount
await page.getByRole('button', { name: 'Increase quantity' }).click({ clickCount: 2 })
```

This rule applies only when the **exact same locator** is clicked consecutively with no other actions or assertions between the clicks. If the target element may change, disappear, or be replaced between clicks (e.g., the button becomes disabled after hitting a max), keep the clicks on separate lines so each one re-resolves the locator.

## Form Interactions

```typescript
// Text input
await page.getByRole('textbox', { name: 'email' }).fill('user@example.com')

// Password input
await page.getByLabel('Password').fill('password123')

// Select dropdown
await page.getByRole('combobox', { name: 'Country' }).selectOption('US')

// Checkbox
await page.getByRole('checkbox', { name: 'Remember me' }).check()

// Retype — fill() clears existing value automatically, no need for clear()
await page.getByRole('textbox', { name: 'search' }).fill('new query')

// Type character by character (for autocomplete/debounce)
await page.getByRole('textbox', { name: 'search' }).pressSequentially('query', { delay: 100 })
```

## Verifying a Test Before Handing It Off

A test that has never run is a draft. Run it and confirm it passes before reporting it done:

```bash
npx playwright test tests/UI/<area>/<file>.spec.ts --project=chromium
```

A test case declares data for every configured environment, so a green run on one
of them is only half the proof. Before handing it off, run it against each
environment its data covers. That is what catches a job title or an employee that
exists on one environment but not another, or a value that was only ever correct on
the environment you happened to develop against:

```bash
TEST_ENV=qa npx playwright test -g "QA-201"
TEST_ENV=rc npx playwright test -g "QA-201"
TEST_ENV=regression npx playwright test -g "QA-201"
```

This matters most in **Mode B**, where the locators came from an inspection pass rather than the source: a green run against the live app is the only proof the roles and names you read were the ones the test needs. When a locator fails, re-inspect the DOM rather than loosening the locator — never "fix" a failure by dropping to `.first()`, a class selector, or a longer timeout.