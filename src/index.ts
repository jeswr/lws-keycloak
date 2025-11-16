#!/usr/bin/env node

/**
 * Main entry point for LWS-Keycloak development
 * 
 * This file serves as a launcher for the individual services.
 * In development, you typically want to run services individually:
 * 
 * - CID Resolver: cd services/cid-resolver && npm run dev
 * - Storage Server: cd services/storage-server && npm run dev
 * 
 * Or use Docker Compose for the full stack: npm run docker:up
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the service to run from command line args or default to storage-server
const service = process.argv[2] || 'storage-server';

const validServices = ['storage-server', 'cid-resolver', 'all'];

if (!validServices.includes(service)) {
  console.error(`Invalid service: ${service}`);
  console.error(`Valid options: ${validServices.join(', ')}`);
  process.exit(1);
}

function runService(serviceName: string) {
  const servicePath = path.join(__dirname, '..', 'services', serviceName);
  
  console.log(`\n🚀 Starting ${serviceName}...\n`);
  
  const child = spawn('npm', ['run', 'dev'], {
    cwd: servicePath,
    stdio: 'inherit'
  });

  child.on('error', (error) => {
    console.error(`Failed to start ${serviceName}:`, error);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${serviceName} exited with code ${code}`);
      process.exit(code || 1);
    }
  });

  return child;
}

if (service === 'all') {
  console.log('🚀 Starting Node.js services...\n');
  console.log('⚠️  Note: This only starts the CID Resolver and Storage Server.');
  console.log('   The Keycloak Authorization Server (port 8080) needs to be started separately:\n');
  console.log('   Option 1 - Full Docker stack:');
  console.log('     npm run docker:up\n');
  console.log('   Option 2 - Keycloak via Docker + Services locally:');
  console.log('     npm run docker:keycloak  (in one terminal)');
  console.log('     npm run dev:all          (in another terminal)\n');
  console.log('   Option 3 - Run services individually:');
  console.log('     cd services/cid-resolver && npm run dev');
  console.log('     cd services/storage-server && npm run dev\n');
  
  const cidResolver = runService('cid-resolver');
  const storageServer = runService('storage-server');
  
  // Handle cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\nShutting down services...');
    cidResolver.kill('SIGINT');
    storageServer.kill('SIGINT');
    process.exit(0);
  });
} else {
  runService(service);
}
