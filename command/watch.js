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
      lintFile([path])
    })
  config.bundler.forEach(b => {
    if (typeof watcher[b] === 'function') {
      watcher[b](config)
    }
  })
  await Promise.all([
    runTSC(config.tsconfig.cjs, true),
    runTSC(config.tsconfig.esm, true)
  ])
  return 0
})
