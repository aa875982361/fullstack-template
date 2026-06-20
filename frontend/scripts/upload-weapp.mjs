#!/usr/bin/env node

import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ci from 'miniprogram-ci'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function formatVersion(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`
}

const projectConfig = readJson(resolve(projectRoot, 'project.config.json'))
const appid = process.env.WX_APPID || projectConfig.appid
const privateKeyPath = process.env.WX_PRIVATE_KEY_PATH
const robot = Number(process.env.WX_ROBOT || '1')
const version = process.env.CI_VERSION || formatVersion()
const desc =
  process.env.CI_DESC ||
  `ci upload ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`

if (!privateKeyPath || !existsSync(privateKeyPath)) {
  console.error('[upload-weapp] WX_PRIVATE_KEY_PATH is required and must exist')
  process.exit(1)
}

if (!appid || appid === 'touristappid') {
  console.error('[upload-weapp] set WX_APPID or update project.config.json appid')
  process.exit(1)
}

if (!Number.isInteger(robot) || robot < 1 || robot > 30) {
  console.error('[upload-weapp] WX_ROBOT must be an integer between 1 and 30')
  process.exit(1)
}

const distDir = resolve(projectRoot, projectConfig.miniprogramRoot || 'dist/')
const appJsonPath = resolve(distDir, 'app.json')

if (!existsSync(appJsonPath)) {
  console.error(`[upload-weapp] ${appJsonPath} missing; run build:weapp first`)
  process.exit(1)
}

const distConfigPath = resolve(distDir, 'project.config.json')
if (existsSync(distConfigPath)) {
  const distConfig = readJson(distConfigPath)
  delete distConfig.miniprogramRoot
  distConfig.appid = appid
  writeFileSync(distConfigPath, `${JSON.stringify(distConfig, null, 2)}\n`)
}

console.log(`[upload-weapp] appid=${appid} robot=${robot} version=${version}`)
console.log(`[upload-weapp] desc="${desc}"`)
console.log(`[upload-weapp] projectPath=${distDir}`)

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath: distDir,
  privateKeyPath,
  ignores: ['node_modules/**/*'],
})

try {
  const uploadResult = await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      autoPrefixWXSS: true,
    },
    robot,
    onProgressUpdate(info) {
      console.log('[upload-weapp]', typeof info === 'string' ? info : info?._msg || info)
    },
  })

  console.log('[upload-weapp] upload done:', JSON.stringify(uploadResult))

  const previewResult = await ci.preview({
    project,
    desc,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      autoPrefixWXSS: true,
    },
  })

  console.log('[upload-weapp] preview done:', JSON.stringify(previewResult))
} catch (error) {
  console.error('[upload-weapp] failed:', error)
  process.exit(1)
}

