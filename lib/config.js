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
  entry: 'src/index.ts',
  output: {
    name: defaultName,
    webpack: 'dist/webpack',
    rollup: 'dist',
    doc: 'docs/api'
  },
  bundler: ['rollup'],
  library: defaultName,
  tsconfig: {
    umd: 'tsconfig.prod.json',
    cjs: 'tsconfig.json',
    esm: 'tsconfig.esm.json'
  },
  format: 'umd',
  webpackTarget: 'web',
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
    config = require(join(context, 'tsgo.config.js'))() || {}
  } catch (_) {
    config = {}
  }
  const mergedConfig = merge(defaultConfig, config, { arrayMerge })
  cache = mergedConfig
  return mergedConfig
}
