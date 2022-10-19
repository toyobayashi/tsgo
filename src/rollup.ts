import * as path from 'path'

import { OutputOptions, rollup, watch } from 'rollup'
import type { GlobalsOption, InputOptions, Plugin, ModuleFormat, RollupOutput } from 'rollup'
import { terser as rollupTerser } from 'rollup-plugin-terser'
import rollupNodeResolve from '@rollup/plugin-node-resolve'
import { camelCase } from 'change-case'
import type { MinifyOptions } from 'terser'
import type { Configuration } from './index'

const rollupJSON = require('@rollup/plugin-json') as typeof import('@rollup/plugin-json').default
const rollupCommonJS = require('@rollup/plugin-commonjs') as typeof import('@rollup/plugin-commonjs').default
const rollupReplace = require('@rollup/plugin-replace') as typeof import('@rollup/plugin-replace').default

const formats = {
  umd: (isProduction: boolean) => ({
    format: 'umd' as ModuleFormat,
    ext: isProduction ? '.min.js' : '.js',
    define: {
      'process.env.NODE_ENV': isProduction ? JSON.stringify('production') : JSON.stringify('development'),
      __DEV__: !isProduction
    }
  }),
  'esm-bundler': (isProduction: boolean) => ({
    format: 'esm' as ModuleFormat,
    ext: isProduction ? '.esm-bundler.min.js' : '.esm-bundler.js',
    define: {
      'process.env.NODE_ENV': '(process.env.NODE_ENV)',
      __DEV__: '(process.env.NODE_ENV !== "production")'
    }
  }),
  commonjs: (isProduction: boolean) => ({
    format: 'commonjs' as ModuleFormat,
    ext: isProduction ? '.cjs.min.js' : '.cjs.js',
    define: {
      'process.env.NODE_ENV': isProduction ? JSON.stringify('production') : JSON.stringify('development'),
      __DEV__: !isProduction
    }
  }),
  mp: (isProduction: boolean) => ({
    format: 'commonjs' as ModuleFormat,
    ext: '.js',
    define: {
      'process.env.NODE_ENV': isProduction ? JSON.stringify('production') : JSON.stringify('development'),
      __DEV__: !isProduction
    }
  })
}

/**
 * @public
 */
export interface BundleConfig {
  entry: string

  output: {
    name: string
    path: string
  }

  /**
   * @defaultValue `false`
   */
  minify?: boolean

  /**
   * @defaultValue `'umd'`
   */
  type?: 'umd' | 'esm-bundler' | 'commonjs' | 'mp'
  globals?: GlobalsOption
  define?: Record<string, any>
  resolveOnly?: ReadonlyArray<string | RegExp>
  terserOptions?: MinifyOptions
  plugins?: Plugin[]
  library?: string
}

export interface RollupConfig {
  input: InputOptions
  output: OutputOptions
}

export function getRollupConfig (target: BundleConfig, config: Configuration): RollupConfig {
  const minify = target.minify ?? false
  const type = target.type ?? 'umd'
  const rollupGlobals = target.globals ?? {}
  const bundleDefine = target.define ?? {}

  const f = formats[type]
  if (!f) {
    throw new Error('Not supported format: ' + type)
  }
  const formatConf = f(minify)
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const name = target.output.name || config.libraryName || ''
  const outputFilename = path.resolve(target.output.path, `${name}${formatConf.ext}`)

  const input = target.entry

  return {
    input: {
      input,
      plugins: [
        rollupNodeResolve({
          resolveOnly: [
            ...(target.resolveOnly ?? [])
          ],
          mainFields: ['browser', 'module', 'main']
        }),
        rollupJSON(),

        rollupReplace({
          preventAssignment: true,
          ...(formatConf.define || {}),
          ...bundleDefine
        }),
        rollupCommonJS({
          transformMixedEsModules: true
          // ignoreDynamicRequires: true,
        }),
        ...(minify
          ? [rollupTerser({
              ...(target.terserOptions ?? {}),
              module: (target.terserOptions?.module) ?? (['es', 'esm', 'module']).includes(formatConf.format)
            })]
          : []),
        ...(Array.isArray(target.plugins)
          ? [
              ...target.plugins
            ]
          : [])
      ]
    },
    output: {
      file: outputFilename,
      format: formatConf.format,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      name: target.library || camelCase(name),
      exports: 'named',
      globals: {
        ...rollupGlobals
      }
    }
  }
}

export async function rollupBuild (configs: RollupConfig[]): Promise<RollupOutput[]> {
  return await Promise.all(configs.map(conf => {
    return rollup(conf.input).then(bundle => bundle.write(conf.output))
  }))
}

export function rollupWatch (configs: RollupConfig[]): void {
  watch(configs.map(conf => ({
    ...conf.input,
    output: conf.output,
    watch: {
      clearScreen: false
    }
  })))
}
