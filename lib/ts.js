const { dirname, basename, isAbsolute } = require('path')
const { getPath } = require('./util.js')

try {
  var ts = require('typescript')
} catch (_) {
  throw new Error('Please install typescript first.')
}

// fix typescript < 4.0
if (ts.classPrivateFieldGetHelper) {
  ts.classPrivateFieldGetHelper.importName = ts.classPrivateFieldGetHelper.importName || '__classPrivateFieldGet'
}
if (ts.classPrivateFieldSetHelper) {
  ts.classPrivateFieldSetHelper.importName = ts.classPrivateFieldSetHelper.importName || '__classPrivateFieldSet'
}

console.log(`TypeScript Version: ${ts.version}`)
const tsLessThanV4 = !ts.versionMajorMinor || Number(ts.versionMajorMinor.charAt(0)) < 4

/**
 * @param {ts.TransformationContext=} context 
 * @returns {typeof ts | import('typescript').NodeFactory}
 */
function getAstNodeFactory (context) {
  if (!context) return ts.factory ? ts.factory : ts
  return context.factory ? context.factory : getAstNodeFactory()
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

function parseTsConfigToCommandLine (tsconfig) {
  const configFileName = ts.findConfigFile(
    dirname(tsconfig),
    ts.sys.fileExists,
    basename(tsconfig)
  )
  if (!configFileName) {
    throw new Error(`TSConfig not found: ${tsconfig}`)
  }
  const configFile = ts.readConfigFile(configFileName, ts.sys.readFile)
  const parseConfigHost = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    useCaseSensitiveFileNames: true
  }
  const parsedCommandLine = ts.parseJsonConfigFileContent(
    configFile.config,
    parseConfigHost,
    dirname(tsconfig)
  )
  if (parsedCommandLine.errors.length) {
    throw new TSError(parsedCommandLine.errors[0].messageText, parsedCommandLine.errors[0].code)
  }
  return parsedCommandLine
}

function formatDiagnosticsWithColorAndContext (diagnostics) {
  if (diagnostics.length) {
    const host = {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: createGetCanonicalFileName(true),
      getNewLine: function () { return ts.sys.newLine }
    }
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host))
  }
}

function logError (program, emitResult, ignoreErrorCodes = []) {
  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics)

  const diagnostics = allDiagnostics.filter(d => !ignoreErrorCodes.includes(d.code))
  formatDiagnosticsWithColorAndContext(diagnostics)
}

function isESModule (compilerOptions) {
  return compilerOptions.module && compilerOptions.module >= ts.ModuleKind.ES2015
}

const ModuleSuffixKind = {
  DEFAULT: 'default',
  NONE: 'none',
  NODE: 'node'
}

/** @typedef {{ moduleSuffix?: 'default' | 'none' | 'node'; tslibLocalPath?: string }} TransformOptions */

function applyCompilerHost (compilerHost, customTransformOptions, compilerOptions) {
  const oldWriteFile = compilerHost.writeFile
  compilerHost.writeFile = function (fileName, data, writeByteOrderMark, onError, sourceFiles) {
    if (customTransformOptions.moduleSuffix === ModuleSuffixKind.NODE && isESModule(compilerOptions)) {
      fileName = endsWith(fileName, '.js') ? (removeSuffix(fileName) + '.mjs') : fileName
    }
    return oldWriteFile.call(this, fileName, data, writeByteOrderMark, onError, sourceFiles)
  }
  // compilerHost.resolveModuleNames = function (moduleNames, containingFile/* , reusedNames, redirectedReference, options */) {

  // }
}

/**
 * @param {string} tsconfig 
 * @param {TransformOptions=} customTransformOptions 
 */
function compile (tsconfig, customTransformOptions = {
  moduleSuffix: ModuleSuffixKind.DEFAULT,
  tslibLocalPath: '',
  ignoreErrorCodes: []
}) {
  customTransformOptions = customTransformOptions || {}
  customTransformOptions.moduleSuffix = customTransformOptions.moduleSuffix || ModuleSuffixKind.DEFAULT
  customTransformOptions.tslibLocalPath = customTransformOptions.tslibLocalPath || ''
  customTransformOptions.ignoreErrorCodes = customTransformOptions.ignoreErrorCodes || []
  // if (customTransformOptions.tslibLocalPath && !isAbsolute(customTransformOptions.tslibLocalPath)) {
  //   throw new Error('tslibLocalPath must be an absolute path.')
  // }

  const parsedCommandLine = parseTsConfigToCommandLine(tsconfig)

  const compilerHost = ts.createCompilerHost(parsedCommandLine.options)
  applyCompilerHost(compilerHost, customTransformOptions, parsedCommandLine.options)

  let program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options, compilerHost)
  let emitResult = customTransformOptions.moduleSuffix === 'none' || customTransformOptions.moduleSuffix === false
    ? program.emit()
    : program.emit(undefined, undefined, undefined, false, {
        after: [createTransformer(false, customTransformOptions, parsedCommandLine.options)],
        afterDeclarations: [createTransformer(true, customTransformOptions, parsedCommandLine.options)]
      })
  
  logError(program, emitResult, customTransformOptions.ignoreErrorCodes)

  if (emitResult.emitSkipped) {
    throw new Error('TypeScript compile failed.')
  }
}

function identity (x) { return x }

function toLowerCase (x) { return x.toLowerCase() }

const fileNameLowerCaseRegExp = /[^\u0130\u0131\u00DFa-z0-9\\/:\-_\. ]+/g

function toFileNameLowerCase (x) {
  return fileNameLowerCaseRegExp.test(x)
    ? x.replace(fileNameLowerCaseRegExp, toLowerCase)
    : x
}

function createGetCanonicalFileName (useCaseSensitiveFileNames) {
  return useCaseSensitiveFileNames ? identity : toFileNameLowerCase
}

/**
 * 
 * @param {boolean} isDeclarationFile 
 * @param {Required<TransformOptions>} customTransformOptions 
 * @param {ts.CompilerOptions} compilerOptions 
 */
function createTransformer (isDeclarationFile, customTransformOptions, compilerOptions) {
  let currentSourceFile = ''
  return (
    /** @type {ts.TransformationContext} */
    context
  ) => {
    /** @type {typeof ts | import('typescript').NodeFactory} */
    const factory = getAstNodeFactory(context)

    /** @type {typeof ts.createCall} */
    const createCallExpression = typeof factory.createCallExpression === 'function' ? factory.createCallExpression.bind(factory) : factory.createCall.bind(factory)

    /** @type {ts.Visitor} */
    const visitor = (node) => {
      if (ts.isSourceFile(node)) {
        currentSourceFile = node.fileName
        return ts.visitEachChild(node, visitor, context)
      }

      if (ts.isImportDeclaration(node)) {
        return factory.createImportDeclaration(node.decorators, node.modifiers, node.importClause, replaceModuleSpecifier(node.moduleSpecifier, factory, isDeclarationFile, currentSourceFile, customTransformOptions, compilerOptions))
      }

      if (ts.isImportEqualsDeclaration(node)) {
        return factory.createImportEqualsDeclaration(node.decorators, node.modifiers, node.name, factory.createExternalModuleReference(replaceModuleSpecifier(node.moduleReference.expression, factory, isDeclarationFile, currentSourceFile, customTransformOptions, compilerOptions)))
      }

      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        if (factory === ts || tsLessThanV4) {
          return factory.createExportDeclaration(node.decorators, node.modifiers, node.exportClause, replaceModuleSpecifier(node.moduleSpecifier, factory, isDeclarationFile, currentSourceFile, customTransformOptions, compilerOptions), node.isTypeOnly)
        }
        return factory.createExportDeclaration(node.decorators, node.modifiers, node.isTypeOnly, node.exportClause, replaceModuleSpecifier(node.moduleSpecifier, factory, isDeclarationFile, currentSourceFile, customTransformOptions, compilerOptions))
      }

      if (ts.isCallExpression(node)
        && node.expression
        && ((ts.isIdentifier(node.expression) && node.expression.escapedText === 'require') || node.expression.kind === ts.SyntaxKind.ImportKeyword)
        && node.arguments.length === 1
        && ts.isStringLiteral(node.arguments[0])
      ) {
        return createCallExpression(node.expression, node.typeArguments, [replaceModuleSpecifier(node.arguments[0], factory, isDeclarationFile, currentSourceFile, customTransformOptions, compilerOptions)])
      }

      if (ts.isImportTypeNode(node)) {
        return factory.createImportTypeNode(
          factory.createLiteralTypeNode(replaceModuleSpecifier(node.argument.literal, factory, isDeclarationFile, currentSourceFile, customTransformOptions, compilerOptions)),
          node.qualifier,
          node.typeArguments,
          node.isTypeOf
        )
      }

      return ts.visitEachChild(node, visitor, context)
    }
    return (node) => ts.visitNode(node, visitor)
  }
}

/**
 * @param {ts.StringLiteral} node 
 * @param {typeof ts | import('typescript').NodeFactory} factory 
 * @param {boolean} isDeclarationFile 
 * @param {string} currentSourceFile 
 * @param {Required<TransformOptions>} customTransformOptions 
 * @param {ts.ParsedCommandLine} parsedCommandLine 
 * @returns {ts.StringLiteral}
 */
function replaceModuleSpecifier (node, factory, isDeclarationFile, currentSourceFile, customTransformOptions, compilerOptions) {
  const suffix = (!!customTransformOptions.moduleSuffix) && (customTransformOptions.moduleSuffix !== 'none')
  const tslibLocalPath = customTransformOptions.tslibLocalPath
  const ext = customTransformOptions.moduleSuffix === ModuleSuffixKind.NODE && isESModule(compilerOptions)
    ? '.mjs'
    : '.js'
  if (tslibLocalPath) {
    if (node.text === 'tslib') {
      const fileName = currentSourceFile
      let moduleRequest = relative(dirname(fileName.replace(/\//g, sep)), getPath(tslibLocalPath)).replace(/\\/g, '/')
      if (moduleRequest.charAt(0) !== '.') {
        moduleRequest = `./${moduleRequest}`
      }
      return (!isDeclarationFile && suffix)
        ? factory.createStringLiteral(moduleRequest + ext)
        : factory.createStringLiteral(moduleRequest)
    }
  }
  if (node.text.charAt(0) !== '.') {
    return node
  }
  return (!isDeclarationFile && suffix)
    ? factory.createStringLiteral(removeSuffix(node.text) + ext)
    : factory.createStringLiteral(removeSuffix(node.text))
}

function endsWith (str, suffix) {
  var expectedPos = str.length - suffix.length
  return expectedPos >= 0 && str.indexOf(suffix, expectedPos) === expectedPos
}

function removeSuffix (str, suffix) {
  if (suffix == null) {
    const pathList = str.split(/[/\\]/)
    const last = pathList[pathList.length - 1]
    const dot = last.lastIndexOf('.')
    pathList[pathList.length - 1] = dot !== -1 ? last.slice(0, dot) : last
    return pathList.join('/')
  }
  return endsWith(str, suffix) ? str.slice(0, str.length - suffix.length) : str
}

function watch (tsconfig, customTransformOptions = {
  moduleSuffix: ModuleSuffixKind.DEFAULT,
  tslibLocalPath: '',
  ignoreErrorCodes: []
}) {
  customTransformOptions = customTransformOptions || {}
  customTransformOptions.moduleSuffix = customTransformOptions.moduleSuffix || ModuleSuffixKind.DEFAULT
  customTransformOptions.tslibLocalPath = customTransformOptions.tslibLocalPath || ''
  customTransformOptions.ignoreErrorCodes = customTransformOptions.ignoreErrorCodes || []
  // if (customTransformOptions.tslibLocalPath && !isAbsolute(customTransformOptions.tslibLocalPath)) {
  //   throw new Error('tslibLocalPath must be an absolute path.')
  // }

  // const formatHost = {
  //   getCanonicalFileName: path => path,
  //   getCurrentDirectory: ts.sys.getCurrentDirectory,
  //   getNewLine: () => ts.sys.newLine
  // }

  const configPath = ts.findConfigFile(
    dirname(tsconfig),
    ts.sys.fileExists,
    basename(tsconfig)
  )

  if (!configPath) {
    throw new Error(`TSConfig not found: ${tsconfig}`)
  }

  function reportDiagnostic(diagnostic) {
    // console.error("Error", diagnostic.code, ":", ts.flattenDiagnosticMessageText( diagnostic.messageText, formatHost.getNewLine()))
    if (customTransformOptions.ignoreErrorCodes.includes(diagnostic.code)) return
    formatDiagnosticsWithColorAndContext([diagnostic])
  }

  const host = ts.createWatchCompilerHost(
    configPath,
    {},
    ts.sys,
    ts.createSemanticDiagnosticsBuilderProgram,
    reportDiagnostic,
    function reportWatchStatusChanged(diagnostic) {
      if (customTransformOptions.ignoreErrorCodes.includes(diagnostic.code)) return
      formatDiagnosticsWithColorAndContext([diagnostic])
      // console.log(ts.formatDiagnostic(diagnostic, formatHost))
    }
  )

  const origCreateProgram = host.createProgram
  host.createProgram = (rootNames, options, host, oldProgram) => {
    applyCompilerHost(host, customTransformOptions, options)
    return origCreateProgram.call(this, rootNames, options, host, oldProgram)
  }

  host.afterProgramCreate = builderProgram => {
    var writeFileName = function (s) { return ts.sys.write(s + ts.sys.newLine); };
    var compilerOptions = builderProgram.getCompilerOptions();
    var newLine = ts.getNewLineCharacter(compilerOptions, function () { return ts.sys.newLine; });
    ts.emitFilesAndReportErrors(builderProgram, reportDiagnostic, writeFileName, function (errorCount) {
      return host.onWatchStatusChange(ts.createCompilerDiagnostic(ts.getWatchErrorSummaryDiagnosticMessage(errorCount), errorCount), newLine, compilerOptions, errorCount);
    }, undefined, undefined, undefined, {
      after: [createTransformer(false, customTransformOptions, compilerOptions)],
      afterDeclarations: [createTransformer(true, customTransformOptions, compilerOptions)]
    });
  }

  return ts.createWatchProgram(host)
}

exports.compile = compile
exports.watch = watch
