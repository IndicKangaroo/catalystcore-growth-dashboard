import { todayIn } from '@growth/shared';
import { loadConfig } from '../lib/config';
import { createGa4Client } from '../providers/ga4/client';
import { allPassed, runGa4Check } from '../providers/ga4/check';

/** `npm run ga4:check -- <propertyId>`: reads one real GA4 property the way the dashboard will. */
async function main(): Promise<number> {
  const propertyId = (process.argv[2] ?? '').replace(/^properties\//, '').trim();
  if (!/^\d+$/.test(propertyId)) {
    console.error('Usage: npm run ga4:check -- <GA4 property ID>   (digits only, e.g. 123456789)');
    return 2;
  }
  const config = loadConfig();
  const keyFile = config.GA4_SERVICE_ACCOUNT_KEY_FILE ?? config.GOOGLE_APPLICATION_CREDENTIALS;
  console.log(
    keyFile
      ? 'Using the service account key file named in your .env.'
      : 'No key file named in .env: using Google default credentials.',
  );
  const today = todayIn('Asia/Kolkata', new Date());
  const lines = await runGa4Check(createGa4Client({ keyFile }), propertyId, today);
  for (const line of lines) console.log(`${line.ok ? 'OK   ' : 'FAIL '}${line.text}`);
  return allPassed(lines) ? 0 : 1;
}

process.exitCode = await main();
