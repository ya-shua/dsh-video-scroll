/**
 * version.mjs —— 版本唯一来源（机器可读契约用）
 * 读的是 package.json 的 version（updater.mjs 的 currentVersion() 也读它），
 * 仓库根 metadata.json 的 version 必须与之一致；GET /api/health 报的就是这个值。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export const KIT_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(KIT_DIR, 'package.json'), 'utf8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
})()