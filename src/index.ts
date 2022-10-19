import * as path from 'path'
import * as fs from 'fs'
import * as tsapi from '@tybys/tsapi'
import { getRollupConfig, rollupBuild, rollupWatch } from './rollup'
import type { BundleConfig } from './rollup'
import { generateDocs, invokeApiExtractor } from './api-extractor'

export type { BundleConfig }

/**
 * @public
 */
export interface Configuration {
  root: string
  tscTargets: tsapi.TransformOptions[]
  libraryName?: string
  /**
   * @defaultValue `'tsconfig.json'`
   */
  baseTsconfig?: string

  /**
   * @defaultValue `'docs/api'`
   */
  docOutputPath?: string

  bundleTargets?: BundleConfig[]
}

/**
 * @public
 */
export async function build (config: Configuration): Promise<void> {
  config.tscTargets.forEach(target => {
    tsapi.compile(path.resolve(config.root, config.baseTsconfig ?? 'tsconfig.json'), target)
  })

  if (config.bundleTargets?.length) {
    void rollupBuild(config.bundleTargets.map(getRollupConfig))
  }

  const apiExtractorJsonPath = path.resolve(config.root, 'api-extractor.json')
  if (fs.existsSync(apiExtractorJsonPath)) {
    invokeApiExtractor(apiExtractorJsonPath, config.libraryName)
    await generateDocs(config.root, config.docOutputPath ?? 'docs/api')
  }
}

/**
 * @public
 */
export function watch (config: Configuration): void {
  config.tscTargets.forEach(target => {
    tsapi.watch(path.resolve(config.root, config.baseTsconfig ?? 'tsconfig.json'), target)
  })

  if (config.bundleTargets?.length) {
    rollupWatch(config.bundleTargets.map(getRollupConfig))
  }
}

/**
 * @public
 */
export function defineConfig (config: Configuration): Configuration {
  return config
}
