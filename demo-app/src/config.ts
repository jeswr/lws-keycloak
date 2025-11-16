import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'lws',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'demo-client',
  },
  
  authorizationServer: process.env.AUTHORIZATION_SERVER || 'http://localhost:8080/realms/lws',
  storageServer: process.env.STORAGE_SERVER || 'http://localhost:3001',
  cidResolver: process.env.CID_RESOLVER || 'http://localhost:3000',
  
  demoAgentId: process.env.DEMO_AGENT_ID || 'http://localhost:3002/agents/demo-agent',
};
