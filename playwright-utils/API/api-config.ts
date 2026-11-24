// Non-secret, non-per-case environment values. BASE_URL is selected by the env file that
// playwright.config.ts loads; credentials stay in that file and are read by the fixture.
const appUrl = process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com'

export const apiConfig = {
  // Every OrangeHRM route, page or REST, is served through the front controller
  baseUrl: `${appUrl}/web/index.php`,
}
