const { runTSC, getPath } = require('../lib/util.js')
const { Task } = require('../lib/task.js')

module.exports = new Task('build', async function (config) {
  await invoke('lint', config)
  const r = await Promise.all([
    runTSC(config.tsconfig.cjs, false, config.externalApiDeclarationDir, 'lib/cjs'),
    runTSC(config.tsconfig.esm, false, config.externalApiDeclarationDir, 'lib/esm'),
    invoke('umd', config)
  ])
  if (r[1] === true) {
    await invoke('dts', config)
    await invoke('doc', config)
  }
  return 0
})

async function invoke (command, config) {
  const r = await require(`./${command}.js`).run(config)
  if (r !== 0) {
    throw new Error(`Command failed: ${command}`)
  }
}
