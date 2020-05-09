const { getPath } = require('../lib/util.js')

const { Task } = require('../lib/task.js')

module.exports = new Task('dts', async function (config/* , logger */) {
  const dtsHack = require('../lib/dts.js')
  let info = null
  if (config.namespaceWrapper === true) {
    info = dtsHack.applyChange(getPath('lib/esm'))
  }
  try {
    invokeApiExtractor()
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

function invokeApiExtractor () {
  const fs = require('fs')
  const path = require('path')
  const {
    Extractor,
    ExtractorConfig
  } = require('@microsoft/api-extractor')

  const apiExtractorJsonPath = getPath('api-extractor.json')

  let extractorConfig
  if (fs.existsSync(apiExtractorJsonPath)) {
    extractorConfig = ExtractorConfig.loadFileAndPrepare(apiExtractorJsonPath)
  } else {
    const configObjectFullPath = path.join(__dirname, '../tsconfig/api-extractor.json')
    const packageJsonFullPath = getPath('package.json')
    const configObject = ExtractorConfig.loadFile(configObjectFullPath)
    // configObject.projectFolder = getPath()

    extractorConfig = ExtractorConfig.prepare({
      configObject,
      configObjectFullPath: apiExtractorJsonPath, // fake path
      packageJson: JSON.parse(fs.readFileSync(packageJsonFullPath, 'utf8')),
      packageJsonFullPath: packageJsonFullPath
    })
  }

  const extractorResult = Extractor.invoke(extractorConfig, {
    // Equivalent to the "--local" command-line parameter
    localBuild: true,

    // Equivalent to the "--verbose" command-line parameter
    showVerboseMessages: true
  })

  if (!extractorResult.succeeded) {
    throw new Error(`API Extractor completed with ${extractorResult.errorCount} errors`
      + ` and ${extractorResult.warningCount} warnings`)
  }
}
