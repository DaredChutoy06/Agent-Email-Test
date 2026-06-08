#!/usr/bin/env node

/**
 * Setup Verification Script
 * Run this to verify your environment is configured correctly
 */

import fs from 'fs';
import path from 'path';

const checks = {
  files: [],
  env: [],
  deps: [],
  credentials: []
};

function checkFile(filePath: string, description: string): boolean {
  const fullPath = path.resolve(filePath);
  const exists = fs.existsSync(fullPath);
  checks.files.push({
    description,
    status: exists ? '✓' : '✗',
    path: filePath
  });
  return exists;
}

function checkEnv(key: string, sensitive = false): boolean {
  const value = process.env[key];
  const exists = !!value;
  const display = sensitive ? (exists ? '***' : '(not set)') : value || '(not set)';
  checks.env.push({
    description: `${key}`,
    status: exists ? '✓' : '✗',
    value: display
  });
  return exists;
}

console.log('🔍 Email Scanner Setup Verification\n');

// Check required files
console.log('📁 Checking Files...');
checkFile('.env', '.env file');
checkFile('src/index.ts', 'Main source file');
checkFile('src/emailScanner.ts', 'Email scanner module');
checkFile('src/subAgent.ts', 'Sub-agent analyzer');
checkFile('package.json', 'Package configuration');

// Check environment variables
console.log('\n🔐 Checking Environment Variables...');
checkEnv('ICLOUD_EMAIL');
checkEnv('ICLOUD_PASSWORD', true);
checkEnv('ANTHROPIC_API_KEY', true);

// Check optional env vars
checkEnv('SCAN_INTERVAL_MINUTES');
checkEnv('ENABLE_AUTO_DELETE');
checkEnv('ENABLE_AUTO_UNSUBSCRIBE');

// Display results
console.log('\n📊 Verification Results:\n');

console.log('Files:');
checks.files.forEach(check => {
  console.log(`  ${check.status} ${check.description}`);
  if (check.status === '✗') {
    console.log(`    Path: ${check.path}`);
  }
});

console.log('\nEnvironment Variables:');
checks.env.forEach(check => {
  console.log(`  ${check.status} ${check.description.padEnd(30)} = ${check.value}`);
});

// Summary
const allChecks = [...checks.files, ...checks.env];
const passed = allChecks.filter(c => c.status === '✓').length;
const total = allChecks.length;

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed}/${total} checks passed`);
console.log('='.repeat(50));

if (passed === total) {
  console.log('\n✅ All checks passed! You\'re ready to run:');
  console.log('   npm run dev');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Please:');
  console.log('   1. Copy .env.example to .env');
  console.log('   2. Fill in your iCloud and API credentials');
  console.log('   3. Verify all required files exist');
  console.log('   4. Run this script again');
  process.exit(1);
}
