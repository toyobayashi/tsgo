const { Task } = require('../lib/task.js')
const { copy, readdir, readFile, writeFile, rename, readJson, writeJson, readJsonSync, mkdirs } = require('fs-extra')
const util = require('../lib/util.js')
const spawn = util.spawn
const { join, dirname } = require('path')
const find = require('@tybys/find-npm-prefix')

module.exports = new Task('gen', async function (config, logger) {
  const oldContext = util.context
  const root = process.cwd()
  util.context = root

  const items = await readdir(root)
  if (items.length) {
    throw new Error('Not a empty directory.')
  }

  await copy(join(__dirname, '../template'), root)
  await writeFile(join(root, 'package.json'), getPackageJson({ name: config.library, author: require('os').userInfo().username }), 'utf8')
  await writeFile(join(root, '.gitignore'), getGitignore(), 'utf8')
  await writeFile(join(root, '.npmignore'), getNpmignore(), 'utf8')
  await mkdirs(join(root, '.vscode'))
  await writeJson(join(root, '.vscode', 'settings.json'), {
    'files.associations': {
      'api-extractor.json': 'jsonc'
    },
    'typescript.tsdk': 'node_modules/typescript/lib'
  }, { spaces: 2 })
  if (process.env.TSGO_DEBUG) {
    let file, tsconfig
    const list = ['tsconfig.json', 'tsconfig.esm.json', 'tsconfig.modern.json', 'tsconfig.cjs.json']
    for (const name of list) {
      file = join(root, name)
      tsconfig = await readJson(file)
      tsconfig.extends = `../tsconfig/${name}`
      await writeJson(file, tsconfig, { spaces: 2 })
    }
  }
  try {
    if (!process.env.TSGO_DEBUG) {
      await spawn(process.platform === 'win32' ? 'git.exe' : 'git', ['init'])
    }
    await spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'])
  } catch (_) {}
  util.context = oldContext
  return 0
})

function getPackageJson ({ name, author }) {
  let typescriptVersion
  try {
    typescriptVersion = readJsonSync(join(find.findPrefixSync(dirname(require.resolve('@microsoft/api-extractor'))), 'package.json')).dependencies.typescript
  } catch (_) {
    typescriptVersion = '~4.1.5'
  }

  return JSON.stringify({
    name,
    version: '0.0.1',
    description: '',
    typings: './lib/cjs-modern/index.d.ts',
    module: './lib/esm/index.js',
    main: './lib/cjs-modern/index.js',
    scripts: {
      prepare: 'npm run build',
      cjs: 'tsgo cjs',
      esm: 'tsgo esm',
      umd: 'tsgo umd',
      dts: 'tsgo dts',
      doc: 'tsgo doc',
      watch: 'tsgo watch',
      build: 'tsgo build',
      lint: 'tsgo lint',
      fix: 'tsgo fix'
    },
    keywords: [],
    author,
    license: "MIT",
    publishConfig: {
      access: "public"
    },
    devDependencies: {
      ...(process.env.TSGO_DEBUG ? {} : { '@tybys/tsgo': `^${require('../package.json').version}` }),
      '@types/node': '^14.14.41',
      '@typescript-eslint/eslint-plugin': '^4.22.1',
      '@typescript-eslint/parser': '^4.22.1',
      eslint: '^7.25.0',
      'eslint-config-standard-with-typescript': '^20.0.0',
      'eslint-plugin-import': '^2.22.1',
      'eslint-plugin-node': '^11.1.0',
      'eslint-plugin-promise': '^5.1.0',
      rollup: '^2.47.0',
      typescript: typescriptVersion,
    },
    dependencies: {
      '@tybys/native-require': '^3.0.2',
      tslib: '2.2.0',
    }
  }, null, 2)
}

function getNpmignore () {
  return `.gitignore
.gitattributes
.DS_Store
package-lock.json
node_modules
/docs
/temp
tsconfig*.json
.vscode
/scripts
api-extractor.json
.eslint*
gulpfile.*
/test
tsgo.config*
`  
}

function getGitignore () {
  return `node_modules
.DS_Store
/lib
tsdoc-metadata.json
package-lock.json
/temp
/dist
/test/out
`
}
