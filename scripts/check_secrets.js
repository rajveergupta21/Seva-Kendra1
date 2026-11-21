#!/usr/bin/env node

/**
 * Pre-Commit Secret Scanner
 * Scans git staged diffs for accidental API keys, tokens, or credentials
 */

import { execSync } from 'child_process';

const SECRET_PATTERNS = [
  { name: "Sarvam AI API Key", pattern: /sk_[a-zA-Z0-9_-]{20,}/ },
  { name: "Generic Private Key", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "Google API Key", pattern: /AIza[0-9A-Za-z\\-_]{35}/ },
  { name: "GitHub Token", pattern: /gh[pousr]_[a-zA-Z0-9]{36,}/ }
];

try {
  const stagedDiff = execSync('git diff --cached --unified=0', { encoding: 'utf8' });
  const lines = stagedDiff.split('\n');

  let violations = [];

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedContent = line.substring(1);
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(addedContent)) {
          violations.push({ name, snippet: addedContent.trim().substring(0, 40) + '...' });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("\n❌ [SECURITY ALERT] Secret scanner blocked commit! Potential secret(s) detected in staged changes:");
    violations.forEach(v => {
      console.error(`   - Rule: ${v.name}`);
    });
    console.error("\nPlease move credentials to .env (which is in .gitignore).\n");
    process.exit(1);
  }

  console.log("✓ [Secret Scanner] No secrets found in staged diff.");
  process.exit(0);
} catch (err) {
  // If not in a git repo or no staged diff
  process.exit(0);
}
