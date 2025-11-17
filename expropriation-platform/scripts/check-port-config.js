#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { config: dotenvConfig } = require('dotenv');

// Simple logger for the script since we can't import the main logger
const scriptLogger = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
  warn: (message) => console.warn(message)
};

/**
 * Port Configuration Check Script
 *
 * This script validates that environment variables match the expected port
 * configuration to prevent logout redirect issues.
 */

// Read environment variables
dotenvConfig({ path: '.env.local' });

const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
const APP_URL = process.env.APP_URL;
const NODE_ENV = process.env.NODE_ENV;

// Default port for development
const DEFAULT_PORT = 3000;

function extractPort(url) {
  if (!url) return null;
  const match = url.match(/:(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function checkPortConfig() {
  scriptLogger.info(`🔍 Checking port configuration...

📋 Configuration:
   NEXTAUTH_URL: ${NEXTAUTH_URL}
   APP_URL: ${APP_URL}
   NODE_ENV: ${NODE_ENV}
   Default Port: ${DEFAULT_PORT}
`);

  const nextauthPort = extractPort(NEXTAUTH_URL);
  const appPort = extractPort(APP_URL);

  // Check if URLs are properly configured
  if (!NEXTAUTH_URL) {
    scriptLogger.info('❌ NEXTAUTH_URL is not set');
    return false;
  }

  if (!APP_URL) {
    scriptLogger.info('❌ APP_URL is not set');
    return false;
  }

  // Check port consistency
  if (nextauthPort !== DEFAULT_PORT) {
    scriptLogger.info(`⚠️  NEXTAUTH_URL port (${nextauthPort}) doesn't match default port (${DEFAULT_PORT})
${NODE_ENV === 'development' ? `💡 Suggestion: Update NEXTAUTH_URL to use port 3000 for development
   Example: NEXTAUTH_URL="http://localhost:3000"` : ''}`);
  }

  if (appPort !== DEFAULT_PORT) {
    scriptLogger.info(`⚠️  APP_URL port (${appPort}) doesn't match default port (${DEFAULT_PORT})
${NODE_ENV === 'development' ? `💡 Suggestion: Update APP_URL to use port 3000 for development
   Example: APP_URL="http://localhost:3000"` : ''}`);
  }

  // Check port consistency between URLs
  if (nextauthPort !== appPort) {
    scriptLogger.info(`❌ Port mismatch: NEXTAUTH_URL uses port ${nextauthPort}, APP_URL uses port ${appPort}
💡 Both URLs should use the same port`);
    return false;
  }

  // Check if everything is properly configured
  if (nextauthPort === DEFAULT_PORT && appPort === DEFAULT_PORT) {
    scriptLogger.info(`✅ Port configuration is correct!
   All URLs are using port ${DEFAULT_PORT}`);
    return true;
  }

  return false;
}

function checkEnvFile() {
  const envLocalPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envLocalPath)) {
    scriptLogger.info(`❌ .env.local file not found
💡 Create .env.local from .env.example`);
    return false;
  }

  scriptLogger.info('✅ .env.local file exists');
  return true;
}

function main() {
  scriptLogger.info(`🚀 Port Configuration Validator
=====================================`);

  const envFileExists = checkEnvFile();
  const portConfigOk = checkPortConfig();

  if (envFileExists && portConfigOk) {
    scriptLogger.info('✅ All checks passed! Your port configuration is ready for development.');
    process.exit(0);
  } else {
    scriptLogger.info(`❌ Configuration issues detected. Please fix them before starting the development server.

📚 For more information, see: LOGOUT_REDIRECT_FIX.md`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkPortConfig, checkEnvFile };