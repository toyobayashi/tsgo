const { Task } = require('../lib/task.js')
const { copy, readdir, readFile, writeFile } = require('fs-extra')
const { spawn } = require('../lib/util.js')
const { join } = require('path')

module.exports = new Task('gen', async function (config, logger) {
  const root = process.cwd()

  const items = await readdir(root)
  if (items.length) {
    throw new Error('Not a empty directory.')
  }

  await copy(join(__dirname, '../template'), root)
  const pkgpath = join(root, 'package.json')
  let pkg = await readFile(pkgpath, 'utf8')
  pkg = pkg.replace(/<name>/g, config.library).replace(/<author>/g, require('os').userInfo().username)
  await writeFile(pkgpath, pkg, 'utf8')
  try {
    await spawn(process.platform === 'win32' ? 'git.exe' : 'git', ['init'])
    await spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'])
  } catch (_) {}

  return 0
})
