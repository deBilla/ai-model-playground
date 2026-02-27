#!/usr/bin/env node
/**
 * Patches prisma/schema.prisma to use the provider specified by the
 * DATABASE_PROVIDER environment variable (default: "sqlite").
 *
 * Usage: node scripts/set-db-provider.mjs
 * Set DATABASE_PROVIDER=postgresql for production.
 *
 * Note: Prisma 5 does not support env() in the datasource provider field,
 * so this script patches the file before running prisma commands.
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const provider = process.env.DATABASE_PROVIDER ?? 'sqlite'
const valid = ['sqlite', 'postgresql', 'mysql', 'sqlserver']

if (!valid.includes(provider)) {
  console.error(`[set-db-provider] Invalid DATABASE_PROVIDER: "${provider}". Must be one of: ${valid.join(', ')}`)
  process.exit(1)
}

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma')
let content = readFileSync(schemaPath, 'utf8')

// Replace the provider value inside the datasource block only.
// Matches:  provider = "sqlite"  (or postgresql/mysql/sqlserver)
// Does NOT match the generator block which has  provider = "prisma-client-js"
const updated = content.replace(
  /^(  provider = )"(?:sqlite|postgresql|mysql|sqlserver)"$/m,
  `$1"${provider}"`,
)

if (updated === content) {
  console.log(`[set-db-provider] provider already "${provider}" — no change`)
} else {
  writeFileSync(schemaPath, updated, 'utf8')
  console.log(`[set-db-provider] Set datasource provider to "${provider}"`)
}
