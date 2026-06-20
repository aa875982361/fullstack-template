#!/usr/bin/env node

import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const templatePath = resolve(rootDir, '.env.example')
const outputPath = resolve(rootDir, 'server/.env')

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signJwt(secret, role) {
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = base64urlJson({
    iss: 'supabase',
    ref: 'local-template',
    role,
    iat: 0,
    exp: Math.floor(new Date('2036-01-01T00:00:00Z').getTime() / 1000),
  })
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

function secret(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

if (existsSync(outputPath)) {
  console.error(`Refusing to overwrite existing ${outputPath}`)
  process.exit(1)
}

const jwtSecret = secret(48)
const postgresPassword = secret(24)
const dashboardPassword = secret(18)
const secretKeyBase = secret(64)

let env = readFileSync(templatePath, 'utf8')
env = env
  .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${postgresPassword}`)
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwtSecret}`)
  .replace(/^ANON_KEY=.*$/m, `ANON_KEY=${signJwt(jwtSecret, 'anon')}`)
  .replace(
    /^SERVICE_ROLE_KEY=.*$/m,
    `SERVICE_ROLE_KEY=${signJwt(jwtSecret, 'service_role')}`,
  )
  .replace(/^DASHBOARD_PASSWORD=.*$/m, `DASHBOARD_PASSWORD=${dashboardPassword}`)
  .replace(/^SECRET_KEY_BASE=.*$/m, `SECRET_KEY_BASE=${secretKeyBase}`)

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, env)

console.log(`Created ${outputPath}`)

