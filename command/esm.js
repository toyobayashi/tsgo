const { getPath, runTSC } = require('../lib/util.js')
const { Task } = require('../lib/task.js')

module.exports = new Task('esm', async function (config, logger) {
  let r
  try {
    r = await runTSC(config.tsconfig.esm, false, config.externalApiDeclarationDir, 'lib/esm')
  } catch (err) {
    console.error(err)
    return 1
  }
  if (!r) {
    logger.log(`TSConfig not found: ${getPath(config.tsconfig.esm)}`)
  }
  return 0
})
