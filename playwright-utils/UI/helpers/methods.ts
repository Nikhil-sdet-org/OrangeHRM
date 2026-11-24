import { type Locator, type Page } from '@playwright/test'

// OrangeHRM renders every form field as a label and a sibling wrapper div, with no `for`
// attribute and no aria-label on the input, so getByLabel and getByRole('textbox', { name })
// resolve nothing for most fields and getByPlaceholder is shared by every date input.
// Ladder tried: role, label and placeholder all fail. The only thing that identifies a field
// is its visible label text, so the wrapper is reached through that relationship.
export function labelledField(scope: Locator, label: string): Locator {
  return scope.locator(`xpath=.//label[normalize-space()="${label}"]/../following-sibling::div[1]`)
}

// OrangeHRM's select is a custom widget: the trigger opens a page-level listbox whose
// options carry real roles, so only the trigger needs a structural locator.
export async function chooseDropdownOption(page: Page, trigger: Locator, option: string) {
  await trigger.click()
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click()
}
