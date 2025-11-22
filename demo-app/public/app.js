// State management
let currentState = {
    step: 1,
    authSuite: null,
    credential: null,
    credentialType: null,
    accessToken: null,
    kid: null,
};

// Utility functions
function log(message, type = 'info') {
    const output = document.getElementById('output');
    output.classList.remove('empty');
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    
    output.textContent += `\n[${timestamp}] ${prefix} ${message}`;
    output.scrollTop = output.scrollHeight;
}

function clearOutput() {
    const output = document.getElementById('output');
    output.textContent = '';
    output.classList.add('empty');
    output.textContent = 'Select an authentication suite to begin...';
}

function updateStep(step) {
    currentState.step = step;
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        stepEl.classList.remove('active', 'completed');
        if (i === step) {
            stepEl.classList.add('active');
        } else if (i < step) {
            stepEl.classList.add('completed');
        }
    }
}

function displayToken(title, token, claims) {
    const tokenSection = document.getElementById('token-section');
    
    const tokenDiv = document.createElement('div');
    tokenDiv.className = 'token-display';
    
    let html = `<h3>${title}</h3>`;
    html += `<div class="token-content">${token.substring(0, 100)}...</div>`;
    
    if (claims) {
        html += '<div class="claims-display"><h4>Token Claims:</h4>';
        for (const [key, value] of Object.entries(claims)) {
            html += `
                <div class="claim-item">
                    <div class="claim-key">${key}:</div>
                    <div class="claim-value">${JSON.stringify(value)}</div>
                </div>
            `;
        }
        html += '</div>';
    }
    
    tokenDiv.innerHTML = html;
    tokenSection.appendChild(tokenDiv);
}

function displayActionButtons() {
    const tokenSection = document.getElementById('token-section');
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'action-buttons';
    buttonsDiv.innerHTML = `
        <button onclick="performTokenExchange()">Exchange for Access Token</button>
        <button onclick="clearOutput(); currentState = { step: 1, authSuite: null, credential: null, credentialType: null, accessToken: null, kid: null }; document.getElementById('token-section').innerHTML = ''; updateStep(1);">Start Over</button>
    `;
    
    tokenSection.appendChild(buttonsDiv);
}

// OpenID Connect flow
async function authenticateOIDC() {
    currentState.authSuite = 'oidc';
    updateStep(2);
    document.getElementById('token-section').innerHTML = '';
    
    // Clear and prepare output
    const output = document.getElementById('output');
    output.textContent = '';
    output.classList.remove('empty');
    
    log('Starting OpenID Connect authentication flow...');
    
    try {
        // Get auth URL
        log('Fetching authorization URL...');
        const response = await fetch('/api/oidc/auth-url');
        const data = await response.json();
        
        log(`Redirecting to Keycloak for authentication...`);
        log(`Auth URL: ${data.authUrl.substring(0, 80)}...`);
        
        // Store state, nonce, and code verifier in sessionStorage for PKCE
        sessionStorage.setItem('oidc_state', data.state);
        sessionStorage.setItem('oidc_nonce', data.nonce);
        sessionStorage.setItem('oidc_code_verifier', data.codeVerifier);
        
        // Redirect to Keycloak
        window.location.href = data.authUrl;
        
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

// Handle OIDC callback
async function handleOIDCCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (!code) {
        return; // Not a callback
    }
    
    currentState.authSuite = 'oidc';
    updateStep(2);
    
    // Clear and prepare output
    const output = document.getElementById('output');
    output.textContent = '';
    output.classList.remove('empty');
    
    log('Received authorization code from Keycloak');
    
    const storedState = sessionStorage.getItem('oidc_state');
    const codeVerifier = sessionStorage.getItem('oidc_code_verifier');
    
    if (state !== storedState) {
        log('State mismatch! Possible CSRF attack.', 'error');
        return;
    }
    
    log('State validated successfully', 'success');
    
    try {
        log('Exchanging authorization code for ID token...');
        
        const response = await fetch('/api/oidc/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, codeVerifier })
        });
        
        log(`Token endpoint response status: ${response.status}`);

        let data;
        try {
            data = await response.json();
        } catch (e) {
            log('Failed to parse JSON from token response', 'error');
            throw e;
        }

        if (!response.ok) {
            log('Token response body (truncated): ' + JSON.stringify(data).substring(0,300), 'error');
            throw new Error(data.details || data.error || 'Token exchange failed');
        }
        
        log('Successfully obtained ID token!', 'success');
        
        // Decode and display token
        const parts = data.idToken.split('.');
        const payload = JSON.parse(atob(parts[1]));
        
        currentState.credential = data.idToken;
        currentState.credentialType = 'urn:ietf:params:oauth:token-type:id_token';
        
        log(`Token claims: sub=${payload.sub}, iss=${payload.iss}, azp=${payload.azp}`);
        
        displayToken('ID Token (End-User Credential)', data.idToken, payload);
        displayActionButtons();
        
        updateStep(3);
        
        // Clean up
        sessionStorage.removeItem('oidc_state');
        sessionStorage.removeItem('oidc_nonce');
        sessionStorage.removeItem('oidc_code_verifier');
        window.history.replaceState({}, document.title, '/');
        
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

// SSI-CID flow
async function authenticateSSI() {
    currentState.authSuite = 'ssi';
    updateStep(2);
    document.getElementById('token-section').innerHTML = '';
    
    // Clear and prepare output
    const output = document.getElementById('output');
    output.textContent = '';
    output.classList.remove('empty');
    
    log('Starting Self-Issued Identity (SSI-CID) authentication flow...');
    
    try {
        // Step 1: Generate keypair
        log('Generating EC keypair (ES256)...');
        const keyResponse = await fetch('/api/ssi/generate-keypair', {
            method: 'POST'
        });
        
        if (!keyResponse.ok) {
            throw new Error('Failed to generate keypair');
        }
        
        const keyData = await keyResponse.json();
        currentState.kid = keyData.kid;
        
        log(`Keypair generated with kid: ${keyData.kid}`, 'success');
        log(`Agent ID: ${keyData.agentId}`);
        
        // Step 2: Register public key for CID document
        log('Registering public key for Controlled Identifier Document...');
        await fetch('/agents/demo-agent/register-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kid: keyData.kid,
                publicKey: keyData.publicKey
            })
        });
        
        log('Public key registered in CID document', 'success');
        
        // Step 3: Create self-issued credential
        log('Creating self-issued JWT credential...');
        const credResponse = await fetch('/api/ssi/create-credential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kid: keyData.kid })
        });
        
        if (!credResponse.ok) {
            throw new Error('Failed to create credential');
        }
        
        const credData = await credResponse.json();
        
        log('Self-issued credential created!', 'success');
        log(`Token type: ${credData.tokenType}`, 'info');
        
        // Decode and display token
        const parts = credData.credential.split('.');
        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));
        
        currentState.credential = credData.credential;
        currentState.credentialType = credData.tokenType;
        
        log(`Credential claims: sub=${payload.sub}, iss=${payload.iss}, client_id=${payload.client_id}`);
        log(`Note: sub === iss === client_id (self-issued requirement)`, 'success');
        
        displayToken('Self-Issued JWT Credential', credData.credential, {
            ...payload,
            header_kid: header.kid,
            header_alg: header.alg
        });
        displayActionButtons();
        
        updateStep(3);
        
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

// Token exchange
async function performTokenExchange() {
    if (!currentState.credential || !currentState.credentialType) {
        log('No credential available for exchange', 'error');
        return;
    }
    
    updateStep(3);
    log('\n--- Starting Token Exchange (RFC 8693) ---');
    
    try {
        // Step 1: Discover authorization server
        log('Discovering authorization server from storage server...');
        const discoverResponse = await fetch('/api/storage/discover');
        const discoverData = await discoverResponse.json();
        
        if (discoverData.asUri) {
            log(`Found authorization server: ${discoverData.asUri}`, 'success');
            log(`Realm (audience): ${discoverData.realm}`);
        }
        
        // Step 2: Get LWS configuration
        log('Fetching LWS configuration from authorization server...');
        const configResponse = await fetch('/api/storage/lws-config');
        
        if (configResponse.ok) {
            const config = await configResponse.json();
            log('LWS configuration retrieved', 'success');
            log(`Supported subject token types: ${config.subject_token_types_supported?.join(', ')}`);
        }
        
        // Step 3: Perform token exchange
        log(`Exchanging ${currentState.authSuite === 'oidc' ? 'ID token' : 'self-issued JWT'} for access token...`);
        log(`Grant type: urn:ietf:params:oauth:grant-type:token-exchange`);
        log(`Subject token type: ${currentState.credentialType}`);
        
        const exchangeResponse = await fetch('/api/storage/token-exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjectToken: currentState.credential,
                subjectTokenType: currentState.credentialType,
                resource: discoverData.realm || 'http://localhost:3001'
            })
        });
        
        if (!exchangeResponse.ok) {
            const error = await exchangeResponse.json();
            throw new Error(error.details || error.error);
        }
        
        const exchangeData = await exchangeResponse.json();
        
        log('Token exchange successful! Received access token.', 'success');
        
        currentState.accessToken = exchangeData.accessToken;
        
        if (exchangeData.accessTokenClaims) {
            log(`Access token claims: sub=${exchangeData.accessTokenClaims.sub}, client_id=${exchangeData.accessTokenClaims.client_id}, aud=${exchangeData.accessTokenClaims.aud}`);
        }
        
        displayToken('Access Token (JWT Access Token - RFC 9068)', exchangeData.accessToken, exchangeData.accessTokenClaims);
        
        // Add button to make authenticated request
        const tokenSection = document.getElementById('token-section');
        const requestDiv = document.createElement('div');
        requestDiv.className = 'action-buttons';
        requestDiv.innerHTML = `
            <button onclick="makeAuthenticatedRequest()">Make Authenticated Request</button>
        `;
        tokenSection.appendChild(requestDiv);
        
        updateStep(4);
        
    } catch (error) {
        log(`Token exchange failed: ${error.message}`, 'error');
    }
}

// Make authenticated request
async function makeAuthenticatedRequest() {
    if (!currentState.accessToken) {
        log('No access token available', 'error');
        return;
    }
    
    log('\n--- Making Authenticated Request to Storage Server ---');
    
    try {
        log('Sending GET request with Bearer token...');
        
        const response = await fetch('/api/storage/authenticated-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: currentState.accessToken,
                method: 'GET',
                path: '/'
            })
        });
        
        const data = await response.json();
        
        log(`Response status: ${data.status} ${data.statusText}`);
        
        if (data.status === 200) {
            log('Authenticated request successful!', 'success');
            log(`Response data: ${JSON.stringify(data.data, null, 2)}`);
        } else if (data.status === 401) {
            log('Authentication failed (401 Unauthorized)', 'error');
        } else {
            log(`Response: ${JSON.stringify(data.data)}`, data.status < 400 ? 'success' : 'error');
        }
        
        log('\n✅ Authentication flow complete!', 'success');
        log(`You successfully authenticated using the ${currentState.authSuite === 'oidc' ? 'OpenID Connect' : 'SSI-CID'} authentication suite.`);
        
    } catch (error) {
        log(`Request failed: ${error.message}`, 'error');
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    // Initialize step indicator
    updateStep(1);
    
    // Check if this is an OIDC callback
    handleOIDCCallback();
});
