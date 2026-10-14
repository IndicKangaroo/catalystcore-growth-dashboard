import type { TokenVerifier } from './auth/types';
import type { UserRepository } from './users/types';

/** Everything the API needs from the outside world. Tests pass fakes; production passes Firebase. */
export interface AppDeps {
  verifier: TokenVerifier;
  users: UserRepository;
}
