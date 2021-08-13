const { existsSync, readFileSync, copy } = require('fs-extra')
const { join, isAbsolute, basename } = require('path')
const { findPrefixSync } = require('@tybys/find-npm-prefix')
const { requireWebpack, requireRollup } = require('./bundler.js')

let context = findPrefixSync(process.cwd())

const webpackToStringOptions = {
  colors: true,
  modules: false,
  entrypoints: false
}

function getPath (...args) {
  if (!args.length) return context
  return isAbsolute(args[0]) ? join(...args) : join(context, ...args)
}

async function spawn (command, args) {
  const cwd = getPath()
  const cp = require('child_process').spawn(command, args, {
    env: process.env,
    cwd,
    stdio: 'inherit'
  })
  return await new Promise((resolve, reject) => {
    cp.once('exit', (code, reason) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Child process exit: ${code}. Reason: ${reason}\n\n${command} ${args.join(' ')}\n`))
      }
    })
  })
}

// async function runNpmBin (bin, args) {
//   const localBin = getPath(`node_modules/.bin/${bin}${process.platform === 'win32' ? '.cmd' : ''}`)
//   if (existsSync(localBin)) {
//     return await spawn(localBin, args)
//   }

//   const packageBin = join(__dirname, `../node_modules/.bin/${bin}${process.platform === 'win32' ? '.cmd' : ''}`)
//   if (existsSync(packageBin)) {
//     return await spawn(packageBin, args)
//   }

//   return await spawn(`${bin}${process.platform === 'win32' ? '.cmd' : ''}`, args)
// }

exports.getPath = getPath
// exports.runNpmBin = runNpmBin
exports.spawn = spawn

Object.defineProperty(module.exports, 'context', {
  configurable: true,
  enumerable: true,
  get () {
    return context
  },
  set (p) {
    context = p
  }
})

exports.bundler = {
  rollup: useRollup,
  webpack: useWebpack
}

function getRollupConfig (config, bundleOnlyCongig) {
  bundleOnlyCongig = bundleOnlyCongig || {}
  const minify = bundleOnlyCongig.minify || false
  const format = bundleOnlyCongig.type || 'umd'
  const rollupGlobals = bundleOnlyCongig.rollupGlobals || {}
  const resolveOnly = bundleOnlyCongig.resolveOnly || []
  const bundleDefine = bundleOnlyCongig.bundleDefine || {}

  const rollupTerser = require('rollup-plugin-terser').terser
  const { nativeRequireRollupPlugin } = require('@tybys/native-require/plugins/rollup')
  // const rollupTypescript = require('@rollup/plugin-typescript')
  const rollupJSON = require('@rollup/plugin-json')
  const rollupCommonJS = require('@rollup/plugin-commonjs')
  const rollupReplace = require('@rollup/plugin-replace')
  const rollupNodeResolve = require('@rollup/plugin-node-resolve').default
  const rollupInject = require('@rollup/plugin-inject')
  const formats = require('./format.js').formats

  const f = formats[format]
  if (!f) {
    throw new Error('Not supported format: ' + format)
  }
  const formatConf = f(minify)
  const outputFilename = getPath(config.output.rollup, `${config.output.name}${formatConf.ext}`)

  return {
    input: {
      input: getPath(config.entry),
      plugins: [
        nativeRequireRollupPlugin(),
        rollupNodeResolve({
          resolveOnly: [
            ...(formatConf.resolveOnly || []),
            ...(config.resolveOnly || []),
            ...resolveOnly
          ],
          mainFields: ['browser', 'module', 'main']
        }),
        // rollupTypescript({
        //   tsconfig: getPath(config.tsconfig.umd)
        // }),
        rollupJSON(),

        // https://github.com/microsoft/TypeScript/issues/36841#issuecomment-669014853
        rollupInject({
          '__classPrivateFieldGet': ['tslib', '__classPrivateFieldGet'],
          '__classPrivateFieldSet': ['tslib', '__classPrivateFieldSet'],
        }),

        rollupReplace({
          preventAssignment: true,
          ...((config.bundleOnly === true || (Array.isArray(config.bundleOnly) && config.bundleOnly.length > 0)) ? formatConf.define : {}),
          ...(config.bundleDefine || {}),
          ...bundleDefine
        }),
        rollupCommonJS({
          transformMixedEsModules: true,
          // ignoreDynamicRequires: true,
          extensions: ['.js', 'jsx', '.ts', '.tsx']
        }),
        ...(config.pureClass ? [{
          transform (code, id) {
            return code.replace(/\/\*\* @class \*\/ \(function/g, '\/*#__PURE__*\/ (function')
          }
        }] : []),
        ...(minify ? [rollupTerser({
          ...(config.terserOptions || {}),
          module: (config.terserOptions && config.terserOptions.module) || (['es', 'esm', 'module']).includes(format)
        })] : [])
      ]
    },
    output: {
      file: outputFilename,
      format: formatConf.rollupFormat,
      name: config.library,
      exports: 'named',
      globals: {
        ...(config.rollupGlobals),
        ...rollupGlobals
      }
    }
  }
}

async function useRollup (config) {
  const rollup = requireRollup(config).rollup

  const rollupConfig = createBundlerConfig(config, getRollupConfig)

  const tsgoPlugin = {
    name: 'tsgo',
    renderChunk (code/* , chunk, options */) {
      if (config.replaceESModule === true) {
        code = code.replace(/(.\s*)?Object\.defineProperty\s*\(\s*(exports|\S{1})\s*,\s*(['"])__esModule['"]\s*,\s*\{\s*value\s*:\s*(.*?)\s*\}\s*\)\s*;?/g, (_match, token, exp, quote, value) => {
          const iifeTemplate = (content, replaceVar) => {
            if (replaceVar != null && replaceVar !== '') {
              return `(function(${replaceVar}){${content.replace(new RegExp(exp, 'g'), replaceVar)}})(${exp})`
            }
            return `(function(){${content}})()`
          }
          const content = (iife) => {
            return `try{${iife ? 'return ' : ''}Object.defineProperty(${exp},${quote}__esModule${quote},{value:${value}})}catch(_){${iife ? 'return ' : ''}${exp}.__esModule=${value}${iife ? (',' + exp) : ''}}`
          }
          const _token = token === undefined ? undefined : token.trim()
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (!_token) return content(false)
          if (_token === '{' || _token === ';') {
            return `${token}${content(false)}`
          } else if (_token === ')' || /^[a-zA-Z$_][a-zA-Z\d_]*$/.test(_token)) {
            return `${token};${content(false)}`
          } else {
            return `${token}${iifeTemplate(content(true), exp === 'this' ? 'e' : '')}`
          }
        })
        code = code.replace(/exports\.default/g, 'exports[\'default\']')

      }
      return code
    }
  }

  await Promise.all(rollupConfig.map(conf => {
    conf.input.plugins.push(tsgoPlugin)
    return rollup(conf.input).then(bundle => bundle.write(conf.output))
  }))
}

function getWebpackConfig (config, bundleOnlyCongig) {
  bundleOnlyCongig = bundleOnlyCongig || {}
  const minimize = bundleOnlyCongig.minify || false
  const format = bundleOnlyCongig.type || 'umd'
  const bundleDefine = bundleOnlyCongig.bundleDefine || {}

  const webpack = requireWebpack(config)
  const webpackVersion = Number(webpack.version.charAt(0))
  const TerserWebpackPlugin = require('terser-webpack-plugin')
  const { NativeRequireWebpackPlugin } = require('@tybys/native-require/plugins/webpack.js')
  const ConcatSource = require('webpack-sources').ConcatSource
  class PureClassPlugin {
    apply(compiler) {
      compiler.hooks.compilation.tap('PureClassPlugin', (compilation) => {
        compilation.hooks.optimizeChunkAssets.tap('PureClassPlugin', (chunks) => {
          chunks.forEach((chunk) => {
            chunk.files.forEach((fileName) => {
              let input = compilation.assets[fileName].source()
              input = input.replace(/\/\*\* @class \*\/ \(function/g, '\/*#__PURE__*\/ (function')
              compilation.assets[fileName] = new ConcatSource(input)
            })
          })
        })
      })
    }
  }

  const formats = require('./format.js').formats

  const f = formats[format]
  if (!f) {
    throw new Error('Not supported format: ' + format)
  }
  const formatConf = f(minimize)
  if (formatConf.webpackLibraryTarget === 'module') {
    throw new Error('Not supported format: ' + format)
  }

  const webpackConfig = {
    target: config.webpackTarget || 'web',
    mode: 'production',
    context: getPath(),
    entry: {
      index: [getPath(config.entry)]
    },
    output: {
      path: getPath(config.output.webpack),
      filename: `${config.output.name}${formatConf.ext}`,
      library: config.library,
      libraryTarget: formatConf.webpackLibraryTarget,
      globalObject: readFileSync(join(__dirname, 'global.js'), 'utf8'),
      ...(webpackVersion > 4 ? {
        environment: {
          arrowFunction: false,
          bigIntLiteral: false,
          const: false,
          destructuring: false,
          dynamicImport: false,
          forOf: false,
          module: false
        }
      } : {})
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json']
    },
    node: false,
    /* module: {
      rules: [
        {
          test: /\.ts(x)?$/,
          use: [
            {
              loader: require.resolve('ts-loader'),
              options: {
                configFile: getPath(config.tsconfig.umd)
              }
            }
          ]
        }
      ]
    }, */
    plugins: [
      new NativeRequireWebpackPlugin(),

      // https://github.com/microsoft/TypeScript/issues/36841#issuecomment-669014853
      new webpack.ProvidePlugin({
        '__classPrivateFieldGet': ['tslib', '__classPrivateFieldGet'],
        '__classPrivateFieldSet': ['tslib', '__classPrivateFieldSet']
      }),

      new webpack.DefinePlugin({
        ...((config.bundleOnly === true || (Array.isArray(config.bundleOnly) && config.bundleOnly.length > 0)) ? formatConf.define : {}),
        ...(config.bundleDefine || {}),
        ...bundleDefine
      }),

      ...(config.pureClass ? [
        new PureClassPlugin()
      ] : []),
    ],
    optimization: {
      minimize,
      ...(minimize ? {
        minimizer: [
          new TerserWebpackPlugin({
            extractComments: false,
            ...(config.terserOptions !== undefined ? ({ terserOptions: config.terserOptions }) : {})
          })
        ]
      } : {})
    }
  }
  if (typeof config.configureWebpack === 'function') {
    config.configureWebpack(webpackConfig, minimize)
  }
  return webpackConfig
}

function createBundlerConfig (config, factory) {
  const configs = []
  if (Array.isArray(config.bundleOnly) && config.bundleOnly.length > 0) {
    for (let i = 0; i < config.bundleOnly.length; i++) {
      const format = config.bundleOnly[i]
      if (typeof format === 'string') {
        configs.push(factory(config, { minify: false, type: format }))
        configs.push(factory(config, { minify: true, type: format }))
      } else if (typeof format === 'object' && format !== null) {
        configs.push(factory(config, format))
      }
    }
  } else {
    if (!config.bundleOnly) {
      configs.push(factory(config, { minify: false, type: 'umd' }))
      configs.push(factory(config, { minify: true, type: 'umd' }))
    } else if (config.bundleOnly === true) {
      const formats = require('./format.js').formats
      Object.keys(formats).forEach(format => {
        configs.push(factory(config, { minify: false, type: format }))
        configs.push(factory(config, { minify: true, type: format }))
      })
    }
  }
  return configs
}

async function useWebpack (config) {
  const webpack = requireWebpack(config)

  const webpackConfig = createBundlerConfig(config, getWebpackConfig)

  return await new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      if (err != null) {
        reject(err)
        return
      }
      console.log(stats.toString(webpackToStringOptions))
      resolve(0)
    })
  })
}

async function lintFile (files, fix) {
  let eslint
  try {
    eslint = require('eslint')
  } catch (_) {
    throw new Error('ESLint not found.')
  }

  const isFix = !!fix
  const extensions = ['.js', '.jsx', '.ts', '.tsx']

  if (Number(new eslint.Linter().version[0]) >= 7) {
    const ESLint = eslint.ESLint
    const esl = new ESLint({
      cwd: getPath(),
      fix: isFix,
      extensions
    })

    const results = await esl.lintFiles(files)

    if (isFix) {
      await ESLint.outputFixes(results)
    }

    const formatter = await esl.loadFormatter("stylish")
    const resultText = formatter.format(results)

    if (resultText) {
      console.log(resultText)
      return 1
    } else {
      console.log('No lint error.')
      return 0
    }
  } else {
    const CLIEngine = eslint.CLIEngine

    const cli = new CLIEngine({
      cwd: getPath(),
      fix: isFix,
      extensions
    })

    const report = cli.executeOnFiles(files)
    const formatter = cli.getFormatter()

    if (isFix) {
      CLIEngine.outputFixes(report)
    }

    const output = formatter(report.results)
    if (output) {
      console.log(output)
      return 1
    } else {
      console.log('No lint error.')
      return 0
    }
  }
}

async function runTSC (tsconfigPath, watch, externalApiDeclarationDir, output, tsTransform) {
  const ts = require('./ts.js')
  const tsconfig = getPath(tsconfigPath)
  if (!existsSync(tsconfig)) {
    return false
  }
  if (watch) {
    // await runNpmBin('tsc', ['-w', '-p', tsconfig])
    /* const watcher =  */ts.watch(tsconfig, tsTransform)
    return new Promise(() => {})
  } else {
    // await runNpmBin('tsc', ['-p', tsconfig])
    ts.compile(tsconfig, tsTransform)
    if (typeof externalApiDeclarationDir === 'string' && externalApiDeclarationDir !== '') {
      const src = getPath(externalApiDeclarationDir)
      if (existsSync(src)) {
        await copy(src, getPath(output, basename(src)))
      }
    }
  }
  return true
}

exports.runTSC = runTSC

exports.lintFile = lintFile

exports.watcher = {
  rollup (config) {
    const rollupConfig = createBundlerConfig(config, getRollupConfig)

    requireRollup(config).watch(rollupConfig.map(conf => ({
      ...conf.input,
      output: conf.output,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      watch: {
        clearScreen: false,
        include: [getPath('src/**/{*.ts,*.tsx,*.js,*.jsx}')]
      }
    })))
  },
  webpack (config) {
    const webpackConfig = createBundlerConfig(config, getWebpackConfig)

    requireWebpack(config)(webpackConfig).watch({ aggregateTimeout: 200 }, (_err, stats) => console.log(stats.toString(webpackToStringOptions)))
  }
}
