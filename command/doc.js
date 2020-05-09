const { getPath } = require('../lib/util.js')
const { writeFileSync, readFileSync } = require('fs-extra')
const { Task } = require('../lib/task.js')

module.exports = new Task('doc', async function (config/* , logger */) {
  const outputDir = getPath(config.output.doc || 'docs/api')
  const { MarkdownAction } = require('@microsoft/api-documenter/lib/cli/MarkdownAction.js')

  const markdownAction = new MarkdownAction()
  markdownAction._inputFolderParameter = { value: getPath('temp') }
  markdownAction._outputFolderParameter = { value: outputDir }
  await markdownAction.onExecute()
  writeFileSync(getPath(outputDir, 'README.md'), readFileSync(getPath(outputDir, 'index.md'), 'utf8'), 'utf8')
  return 0
})
