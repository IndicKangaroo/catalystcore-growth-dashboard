/**
 * Storage for the studio's settings, the single `settings/studio` document (D-019). The dashboard
 * only reads it in P2; the settings screen that writes it arrives in P10, so until then a studio
 * sets its name and logo by editing the document in the Firebase console.
 */
export interface SettingsRepository {
  /** The raw `settings/studio` document, or null while the document does not exist. */
  getStudio(): Promise<Record<string, unknown> | null>;
}
