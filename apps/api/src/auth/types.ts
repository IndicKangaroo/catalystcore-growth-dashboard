/** What we need to know about a verified Firebase ID token. */
export interface VerifiedToken {
  uid: string;
  email: string | undefined;
  emailVerified: boolean;
  name: string | undefined;
}

/** Verifies a Firebase ID token. Throws when the token is invalid or expired. */
export interface TokenVerifier {
  verify(idToken: string): Promise<VerifiedToken>;
}
