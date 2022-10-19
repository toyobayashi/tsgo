import { existsSync } from 'fs'
import type { Configuration } from '../index'
import { findPrefix } from './find-prefix'

export function readConfig (configPath: string): Configuration {
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file "${configPath}" is not found`)
  }
  const exports = require(configPath)
  const config: Configuration = exports.__esModule ? exports.default : exports
  if (!config.root) {
    config.root = findPrefix(configPath)
  }
  return config
}
