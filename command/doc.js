const { runNpmBin, getPath } = require('../lib/util.js')
const { writeFileSync, readFileSync } = require('fs-extra')
const { Task } = require('../lib/task.js')

module.exports = new Task('doc', async function (config/* , logger */) {
  const outputDir = getPath(config.output.doc || 'docs/api')
  await runNpmBin('api-documenter', ['markdown', '-i', './temp', '-o', outputDir])
  writeFileSync(getPath(outputDir, 'README.md'), readFileSync(getPath(outputDir, 'index.md'), 'utf8'), 'utf8')
  return 0
})
