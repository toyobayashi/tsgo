const { getPath, runTSC } = require('../lib/util.js')
const { Task } = require('../lib/task.js')

module.exports = new Task('esm', async function (config, logger) {
  let r, r2
  try {
    r = await runTSC(config.tsconfig.esm, false, config.externalApiDeclarationDir, 'lib/esm', config.tsTransform)
    r2 = await runTSC(config.tsconfig.esmModern, false, config.externalApiDeclarationDir, 'lib/esm-modern', config.tsTransform)
  } catch (err) {
    console.error(err)
    return 1
  }
  if (!r) logger.log(`TSConfig not found: ${getPath(config.tsconfig.esm)}`)
  if (!r2) logger.log(`TSConfig not found: ${getPath(config.tsconfig.esmModern)}`)
  return 0
})
