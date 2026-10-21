/**
 * Whether a Firebase project id belongs to the local emulators. Firebase's convention is a "demo-"
 * prefix: `npm run emulators` runs a project called demo-growth (D-023). A sign-in made in the Auth
 * emulator belongs to that project, whatever project id the web app is configured with, which is
 * why a leftover emulator setting shows up as "signed in to demo-growth".
 */
export function isEmulatorProject(projectId: string): boolean {
  return projectId.startsWith('demo-');
}
