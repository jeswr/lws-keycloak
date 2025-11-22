import { execSync } from 'child_process';

async function globalTeardown() {
  console.log('[globalTeardown] Stopping docker services...');
  try {
    execSync('docker-compose -f ../docker-compose.yml stop keycloak redis postgres', { stdio: 'inherit' });
  } catch (e) {
    console.warn('[globalTeardown] Failed to stop services (continuing):', e instanceof Error ? e.message : e);
  }
}

export default globalTeardown;
