#!/usr/bin/env node
/**
 * fix-mobile-symlinks.js
 * Repairs broken symlinks in mobile/node_modules/ after pnpm install with
 * node-linker=hoisted. The hoisted linker places all packages in the root
 * node_modules/ but pnpm still creates workspace-level symlinks that point
 * to the .pnpm virtual store — those paths no longer exist with hoisted
 * linker, leaving dangling symlinks. This script repoints them to root.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mobileNodeModules = path.join(root, 'mobile', 'node_modules');
const rootNodeModules = path.join(root, 'node_modules');

if (!fs.existsSync(mobileNodeModules)) {
  process.exit(0);
}

const entries = fs.readdirSync(mobileNodeModules);
let fixed = 0;
let skipped = 0;

for (const entry of entries) {
  const entryPath = path.join(mobileNodeModules, entry);

  let stat;
  try {
    stat = fs.lstatSync(entryPath);
  } catch {
    continue;
  }

  if (!stat.isSymbolicLink()) continue;

  // Test if the symlink target is reachable
  try {
    fs.readdirSync(entryPath);
    continue; // symlink is fine
  } catch {
    // broken symlink — attempt to repoint to root node_modules
  }

  const rootTarget = path.join(rootNodeModules, entry);
  if (!fs.existsSync(rootTarget)) {
    skipped++;
    continue;
  }

  try {
    fs.unlinkSync(entryPath);
    fs.symlinkSync(path.join('..', '..', 'node_modules', entry), entryPath);
    fixed++;
  } catch (err) {
    console.warn(`  Could not fix ${entry}: ${err.message}`);
  }
}

if (fixed > 0) {
  console.log(`fix-mobile-symlinks: repaired ${fixed} broken symlink(s) in mobile/node_modules/`);
}
if (skipped > 0) {
  console.log(`fix-mobile-symlinks: skipped ${skipped} broken symlink(s) with no root counterpart`);
}
