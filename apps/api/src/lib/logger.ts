/**
 * Minimal logger. Never pass secrets, tokens or key material to it (AGENTS.md).
 * Replace with a structured logger when deployment needs it.
 */
type Fields = Record<string, unknown>;

function write(level: 'info' | 'warn' | 'error', message: string, fields?: Fields): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: Fields) => write('info', message, fields),
  warn: (message: string, fields?: Fields) => write('warn', message, fields),
  error: (message: string, fields?: Fields) => write('error', message, fields),
};
