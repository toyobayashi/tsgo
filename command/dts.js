const { runNpmBin, getPath } = require('../lib/util.js')

const { Task } = require('../lib/task.js')

module.exports = new Task('dts', async function (config/* , logger */) {
  const dtsHack = require('../lib/dts.js')
  let info = null
  if (config.namespaceWrapper === true) {
    info = dtsHack.applyChange(getPath('lib/esm'))
  }
  try {
    await runNpmBin('api-extractor', ['run', '--local', '--verbose'])
  } catch (err) {
    if (config.namespaceWrapper === true) {
      dtsHack.revertChange(info)
    }
    throw err
  }
  if (config.namespaceWrapper === true) {
    dtsHack.revertChange(info)
  }
  const dtsPath = getPath(`dist/${config.library}.d.ts`)
  const format = config.format || 'umd'
  dtsHack.resolveDeclarationFile(dtsPath, config.library, format)
  return 0
})
