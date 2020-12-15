const { findPrefixSync } = require('@tybys/find-npm-prefix')
const { basename, join } = require('path')
const { existsSync, readFileSync } = require('fs')

const merge = require('deepmerge')

const arrayMerge = (_destinationArray, sourceArray) => sourceArray

const context = findPrefixSync(process.cwd())

const defaultName = (function getName () {
  const json = join(context, 'package.json')
  if (existsSync(json)) {
    return basename(JSON.parse(readFileSync(json, 'utf8')).name)
  } else {
    return basename(context)
  }
})()

const defaultConfig = {
  entry: 'lib/esm/index.js',
  output: {
    name: defaultName,
    webpack: 'dist/webpack',
    rollup: 'dist',
    doc: 'docs/api'
  },
  bundleOnly: false,
  bundleDefine: {},
  rollupGlobals: {},
  bundler: ['rollup'],
  library: defaultName,
  tsconfig: {
    cjs: 'tsconfig.cjs.json',
    cjsModern: 'tsconfig.json',
    esm: 'tsconfig.esm.json',
    esmModern: 'tsconfig.modern.json'
  },
  tsTransform: {
    moduleSuffix: 'default',
    tslibLocalPath: '',
    ignoreErrorCodes: []
  },
  resolveOnly: [],
  dtsFormat: 'umd',
  webpackTarget: 'web',
  // configureWebpack: (webpackConfig, minimize) => void
  replaceESModule: false,
  terserOptions: {
    ie8: false,
    output: {
      comments: false
    }
  },
  namespaceWrapper: false,
  externalApiDeclarationDir: 'api'
}

let cache = null

exports.readConfig = function () {
  if (cache !== null) return cache
  const context = findPrefixSync(process.cwd())
  let config
  try {
    const configOrFactory = require(join(context, 'tsgo.config.js'))
    if (typeof configOrFactory === 'function') {
      config = configOrFactory(context) || {}
    } else {
      config = configOrFactory || {}
    }
  } catch (_) {
    config = {}
  }
  const webpack = config.webpack
  const rollup = config.rollup
  delete config.webpack
  delete config.rollup
  const mergedConfig = merge(defaultConfig, config, { arrayMerge })
  if (webpack) mergedConfig.webpack = webpack
  if (rollup) mergedConfig.rollup = rollup
  cache = mergedConfig
  return mergedConfig
}
