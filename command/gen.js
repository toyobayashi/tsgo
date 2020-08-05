const { Task } = require('../lib/task.js')
const { copy, readdir, readFile, writeFile, rename } = require('fs-extra')
const { spawn } = require('../lib/util.js')
const { join } = require('path')

module.exports = new Task('gen', async function (config, logger) {
  const root = process.cwd()

  const items = await readdir(root)
  if (items.length) {
    throw new Error('Not a empty directory.')
  }

  await copy(join(__dirname, '../template'), root)
  await writeFile(join(root, 'package.json'), getPackageJson({ name: config.library, author: require('os').userInfo().username }), 'utf8')
  await writeFile(join(root, '.gitignore'), getGitignore(), 'utf8')
  await writeFile(join(root, '.npmignore'), getNpmignore(), 'utf8')
  try {
    await spawn(process.platform === 'win32' ? 'git.exe' : 'git', ['init'])
    await spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'])
  } catch (_) {}

  return 0
})

function getPackageJson ({ name, author }) {
  return JSON.stringify({
    name,
    version: '0.0.1',
    description: '',
    typings: './lib/esm/index.d.ts',
    module: './lib/esm/index.js',
    main: './lib/cjs/index.js',
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
      '@tybys/tsgo': `^${require('../package.json').version}`,
      '@types/node': '^12.12.36',
      '@typescript-eslint/eslint-plugin': '^3.0.2',
      '@typescript-eslint/parser': '^3.0.2',
      eslint: '^7.1.0',
      'eslint-config-standard-with-typescript': '^18.0.2',
      'eslint-plugin-import': '^2.20.2',
      'eslint-plugin-node': '^11.1.0',
      'eslint-plugin-promise': '^4.2.1',
      'eslint-plugin-standard': '^4.0.1',
      tslib: '^2.0.0',
      typescript: '^3.9.7'
    },
    dependencies: {
      '@tybys/native-require': '^1.1.0'
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
