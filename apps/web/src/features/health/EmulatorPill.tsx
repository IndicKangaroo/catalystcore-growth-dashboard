import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { authEmulatorUrl } from '../../lib/emulator';

/**
 * Says so when sign-in goes to the Firebase emulator on this computer instead of Google. Nothing
 * else on screen looks different, and an emulator line left in .env sends every sign-in there
 * while the people and data it holds vanish when the emulator stops (D-045).
 */
export function EmulatorPill() {
  if (!authEmulatorUrl()) return null;

  return (
    <Chip
      tone="warn"
      title="Sign-in goes to the Firebase emulator on this computer, not to Google."
    >
      <Icon name="alert" />
      Local emulator
    </Chip>
  );
}
