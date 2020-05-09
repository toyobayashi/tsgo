const { getPath, runTSC } = require('../lib/util.js')
const { Task } = require('../lib/task.js')

module.exports = new Task('cjs', async function (config, logger) {
  let r
  try {
    r = await runTSC(config.tsconfig.cjs, false, config.externalApiDeclarationDir, 'lib/cjs')
  } catch (err) {
    console.error(err)
    return 1
  }
  if (!r) {
    logger.log(`TSConfig not found: ${getPath(config.tsconfig.cjs)}`)
  }
  return 0
})
