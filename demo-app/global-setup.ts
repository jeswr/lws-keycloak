async function waitForKeycloak() {
  const maxAttempts = 60; // up to 60s
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch('http://localhost:8080/realms/lws/.well-known/openid-configuration');
      if (resp.ok) {
        console.log(`[globalSetup] Keycloak ready after ${attempt} attempt(s)`);
        return;
      }
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('[globalSetup] Keycloak not ready after waiting 60 seconds');
}

async function globalSetup() {
  console.log('[globalSetup] Assuming external services (Keycloak/Postgres/Redis) already started...');
  console.log('[globalSetup] Waiting for Keycloak readiness');
  await waitForKeycloak();
}

export default globalSetup;
