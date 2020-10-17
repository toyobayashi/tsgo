const { watcher, runTSC, lintFile, getPath } = require('../lib/util.js')

const { Task } = require('../lib/task.js')

module.exports = new Task('watch', async function (config/* , logger */) {
  const chokidar = require('chokidar')

  const w = chokidar.watch('src/**/{*.ts,*.tsx,*.js,*.jsx}', {
    cwd: getPath(),
    ignoreInitial: false
  })

  w
    .on('change', path => {
      lintFile([path]).catch(err => {
        console.error(err)
      })
    })
  config.bundler.forEach(b => {
    if (typeof watcher[b] === 'function') {
      try {
        watcher[b](config)
      } catch (error) {
        console.warn(`Bundler watching failed: ${error.message}`)
      }
    }
  })
  await Promise.all([
    runTSC(config.tsconfig.cjs, true, config.externalApiDeclarationDir, 'lib/cjs', config.tsTransform),
    runTSC(config.tsconfig.esm, true, config.externalApiDeclarationDir, 'lib/esm', config.tsTransform),
    runTSC(config.tsconfig.cjsModern, true, config.externalApiDeclarationDir, 'lib/esm-modern', config.tsTransform),
    runTSC(config.tsconfig.esmModern, true, config.externalApiDeclarationDir, 'lib/esm-modern', config.tsTransform),
  ])
  throw new Error(`Must exists ${config.tsconfig.cjs} or ${config.tsconfig.esm}`)
})
