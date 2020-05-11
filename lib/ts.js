const { dirname, basename } = require('path')

/** @type {import('typescript')} */
let ts
try {
  ts = require('typescript')
} catch (_) {
  throw new Error('Please install typescript first.')
}

class TSError extends Error {
  constructor (msg, code) {
    super(msg)
    this.code = code
  }

  what () {
    return `TS${this.code}: ${this.message}`
  }
}

function compile (tsconfig) {
  const parseConfigHost = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    useCaseSensitiveFileNames: true
  }
  
  const configFileName = ts.findConfigFile(
    dirname(tsconfig),
    ts.sys.fileExists,
    basename(tsconfig)
  )
  if (!configFileName) {
    throw new Error(`TSConfig not found: ${tsconfig}`)
  }
  const configFile = ts.readConfigFile(configFileName, ts.sys.readFile)
  const compilerOptions = ts.parseJsonConfigFileContent(
    configFile.config,
    parseConfigHost,
    dirname(tsconfig)
  )

  if (compilerOptions.errors.length) {
    throw new TSError(compilerOptions.errors[0].messageText, compilerOptions.errors[0].code)
  }

  let program = ts.createProgram(compilerOptions.fileNames, compilerOptions.options)
  let emitResult = program.emit()

  let allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics)

  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
    }
  })

  if (emitResult.emitSkipped) {
    throw new Error('TypeScript compile failed.')
  }
}

function watch (tsconfig, { onCreateProgram, onAfterProgramCreate } = {}) {
  const formatHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
  }

  const configPath = ts.findConfigFile(
    dirname(tsconfig),
    ts.sys.fileExists,
    basename(tsconfig)
  )

  if (!configPath) {
    throw new Error(`TSConfig not found: ${tsconfig}`)
  }

  const host = ts.createWatchCompilerHost(
    configPath,
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    function reportDiagnostic(diagnostic) {
      console.error("Error", diagnostic.code, ":", ts.flattenDiagnosticMessageText( diagnostic.messageText, formatHost.getNewLine()))
    },
    function reportWatchStatusChanged(diagnostic) {
      console.log(ts.formatDiagnostic(diagnostic, formatHost))
    }
  )

  if (typeof onCreateProgram === 'function') {
    const origCreateProgram = host.createProgram
    host.createProgram = (rootNames, options, host, oldProgram) => {
      onCreateProgram.call(this, rootNames, options, host, oldProgram)
      return origCreateProgram.call(this, rootNames, options, host, oldProgram)
    }
  }

  if (typeof onAfterProgramCreate === 'function') {
    const origPostProgramCreate = host.afterProgramCreate

    host.afterProgramCreate = program => {
      onAfterProgramCreate.call(this, program)
      return origPostProgramCreate.call(this, program)
    }
  }

  return ts.createWatchProgram(host)
}

exports.compile = compile
exports.watch = watch
