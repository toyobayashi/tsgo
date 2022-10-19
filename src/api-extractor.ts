import * as path from 'path'
import * as fs from 'fs'
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import { camelCase } from 'change-case'

export function invokeApiExtractor (apiExtractorJsonPath: string, umdName?: string): void {
  const extractorConfig = ExtractorConfig.loadFileAndPrepare(apiExtractorJsonPath)

  const extractorResult = Extractor.invoke(extractorConfig, {
    // Equivalent to the "--local" command-line parameter
    localBuild: true,

    // Equivalent to the "--verbose" command-line parameter
    showVerboseMessages: true
  })

  if (!extractorResult.succeeded) {
    throw new Error(`API Extractor completed with ${extractorResult.errorCount} errors and ${extractorResult.warningCount} warnings`)
  }

  if (umdName) {
    fs.appendFileSync(extractorResult.extractorConfig.publicTrimmedFilePath, `\nexport as namespace ${camelCase(umdName)};\n`)
  }
}

export async function generateDocs (root: string, outputDir: string): Promise<void> {
  const { MarkdownAction } = require('@microsoft/api-documenter/lib/cli/MarkdownAction.js')
  const markdownAction = new MarkdownAction()
  markdownAction._inputFolderParameter = { value: path.join(root, 'temp') }
  markdownAction._outputFolderParameter = { value: outputDir }
  await markdownAction.onExecute()
  fs.writeFileSync(path.resolve(root, outputDir, 'README.md'), fs.readFileSync(path.resolve(root, outputDir, 'index.md'), 'utf8'), 'utf8')
}
