const { getPath, runTSC } = require('../lib/util.js')
const { Task } = require('../lib/task.js')

module.exports = new Task('cjs', async function (config, logger, args) {
  let r, r2
  try {
    r = await runTSC(config.tsconfig.cjs, false, config.externalApiDeclarationDir, 'lib/cjs', config.tsTransform)
    r2 = await runTSC(config.tsconfig.cjsModern, false, config.externalApiDeclarationDir, 'lib/cjs-modern', config.tsTransform)
  } catch (err) {
    console.error(err)
    return 1
  }
  if (!r) logger.log(`TSConfig not found: ${getPath(config.tsconfig.cjs)}`)
  if (!r2) logger.log(`TSConfig not found: ${getPath(config.tsconfig.cjs)}`)
  return 0
})
