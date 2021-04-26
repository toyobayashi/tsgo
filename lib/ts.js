const { dirname, basename, isAbsolute, posix, relative, sep, join } = require('path')
const { getPath } = require('./util.js')
const { statSync, existsSync, readJsonSync } = require('fs-extra')

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
    if (!!customTransformOptions.pureClass) {
      data = data.replace(/\/\*\* @class \*\/ \(function/g, '\/*#__PURE__*\/ (function')
    }
    return oldWriteFile.call(this, fileName, data, writeByteOrderMark, onError, sourceFiles)
  }

  const moduleResolutionCache = ts.createModuleResolutionCache(compilerHost.getCurrentDirectory(), function (x) { return compilerHost.getCanonicalFileName(x) }, compilerOptions)
  const tryExtensions = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.json']
  var loader_1 = function (moduleName, containingFile, redirectedReference) {
    const resolved = ts.resolveModuleName(moduleName, containingFile, compilerOptions, compilerHost, moduleResolutionCache, redirectedReference)
    let resolvedModule = resolved.resolvedModule
    if (!resolvedModule) {
      const ext = endsWith(moduleName, '.d.ts') ? '.d.ts' : posix.extname(moduleName)
      if (tryExtensions.includes(ext)) {
        return loader_1(removeSuffix(moduleName, ext), containingFile, redirectedReference)
      }
    }
    return resolvedModule
  };
  compilerHost.resolveModuleNames = function (moduleNames, containingFile, _reusedNames, redirectedReference/* , options */) {
    return ts.loadWithLocalCache(ts.Debug.checkEachDefined(moduleNames), containingFile, redirectedReference, loader_1)
  }
}

/**
 * @param {string} tsconfig 
 * @param {TransformOptions=} customTransformOptions 
 */
function compile (tsconfig, customTransformOptions = {
  moduleSuffix: ModuleSuffixKind.DEFAULT,
  tslibLocalPath: '',
  pureClass: true,
  ignoreErrorCodes: [],
  define: {}
}) {
  customTransformOptions = customTransformOptions || {}
  customTransformOptions.moduleSuffix = customTransformOptions.moduleSuffix || ModuleSuffixKind.DEFAULT
  customTransformOptions.tslibLocalPath = customTransformOptions.tslibLocalPath || ''
  customTransformOptions.ignoreErrorCodes = customTransformOptions.ignoreErrorCodes || []
  customTransformOptions.define = customTransformOptions.define || {}
  // if (customTransformOptions.tslibLocalPath && !isAbsolute(customTransformOptions.tslibLocalPath)) {
  //   throw new Error('tslibLocalPath must be an absolute path.')
  // }

  const parsedCommandLine = parseTsConfigToCommandLine(tsconfig)

  const compilerHost = ts.createCompilerHost(parsedCommandLine.options)
  applyCompilerHost(compilerHost, customTransformOptions, parsedCommandLine.options)

  let program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options, compilerHost)
  let emitResult = customTransformOptions.moduleSuffix === ModuleSuffixKind.NONE || customTransformOptions.moduleSuffix === false
    ? program.emit()
    : program.emit(undefined, undefined, undefined, !!parsedCommandLine.options.emitDeclarationOnly, {
        after: [createTransformer(false, customTransformOptions, parsedCommandLine.options, program)],
        afterDeclarations: [createTransformer(true, customTransformOptions, parsedCommandLine.options, program)]
      })
  
  logError(program, emitResult, customTransformOptions.ignoreErrorCodes)

  if (emitResult.emitSkipped && !parsedCommandLine.options.noEmit) {
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
 * @param {ts.Node} node 
 * @returns {boolean}
 */
function isVar (node) {
  return (
    (ts.isVariableDeclaration(node.parent) && node.parent.name === node) ||
    ts.isFunctionDeclaration(node.parent) ||
    ts.isClassDeclaration(node.parent) ||
    ts.isInterfaceDeclaration(node.parent) ||
    ts.isTypeAliasDeclaration(node.parent) ||
    ts.isEnumDeclaration(node.parent) ||
    ts.isModuleDeclaration(node.parent)
  )
}

/**
 * @param {boolean} isDeclarationFile 
 * @param {Required<TransformOptions>} customTransformOptions 
 * @param {ts.CompilerOptions} compilerOptions 
 * @param {ts.Program} program 
 */
function createTransformer (isDeclarationFile, customTransformOptions, compilerOptions, program) {
  const defineKeys = Object.keys(customTransformOptions.define)
  let currentSourceFile = ''
  const typeChecker = program.getTypeChecker()
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

      if (defineKeys.length > 0) {
        if (ts.isIdentifier(node) &&
            node.text &&
            defineKeys.indexOf(node.text) !== -1 &&
            !ts.isPropertyAccessExpression(node.parent) &&
            (!ts.isCallExpression(node.parent) ||
              (ts.isCallExpression(node.parent) && (node.parent.arguments.indexOf(node) !== -1))
            ) &&
            !isVar(node) &&
            (() => {
              const nodeSymbol = typeChecker.getSymbolAtLocation(node)
              if (!nodeSymbol) return true
              if (ts.isVariableDeclaration(nodeSymbol.valueDeclaration)) {
                if (ts.isVariableStatement(nodeSymbol.valueDeclaration.parent.parent)) {
                  return (nodeSymbol.valueDeclaration.parent.parent.modifiers &&
                    nodeSymbol.valueDeclaration.parent.parent.modifiers.filter(m => m.kind === ts.SyntaxKind.DeclareKeyword).length > 0)
                } else {
                  return false
                }
              } else if (ts.isFunctionDeclaration(nodeSymbol.valueDeclaration) || ts.isClassDeclaration(nodeSymbol.valueDeclaration) ||
                ts.isEnumDeclaration(nodeSymbol.valueDeclaration) || ts.isModuleDeclaration(nodeSymbol.valueDeclaration)
              ) {
                return (nodeSymbol.valueDeclaration.parent.parent.modifiers &&
                  nodeSymbol.valueDeclaration.parent.parent.modifiers.filter(m => m.kind === ts.SyntaxKind.DeclareKeyword).length > 0)
              } else if (ts.isInterfaceDeclaration(nodeSymbol.valueDeclaration) || ts.isTypeAliasDeclaration(nodeSymbol.valueDeclaration)) {
                return true
              } else {
                return false
              }
            })()
        ) {
          const identifier = node.text
          const value = customTransformOptions.define[identifier]
          if (value === undefined) {
            return factory.createNumericLiteral('undefined')
          }
          if (value === null) {
            return factory.createNull()
          }
          if (Number.isNaN(value)) {
            return factory.createNumericLiteral('NaN')
          }
          if (typeof value === 'boolean') {
            return value ? factory.createTrue() : factory.createFalse()
          }
          if (typeof value === 'string') {
            return factory.createNumericLiteral(value)
          }
          if (typeof value === 'symbol') {
            const symbolString = value.toString()
            return factory.createNumericLiteral(`Symbol("${symbolString.substring(7, symbolString.length - 1)}")`)
          }
          if (value instanceof Date) {
            return factory.createNumericLiteral(`(new Date(${value.getTime()}))`)
          }
          if (value instanceof RegExp) {
            return factory.createRegularExpressionLiteral(value.toString())
          }
        }
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
  const suffix = (!!customTransformOptions.moduleSuffix) && (customTransformOptions.moduleSuffix !== ModuleSuffixKind.NONE)
  const tslibLocalPath = customTransformOptions.tslibLocalPath
  const ext = customTransformOptions.moduleSuffix === ModuleSuffixKind.NODE && isESModule(compilerOptions)
    ? '.mjs'
    : '.js'
  if (tslibLocalPath) {
    if (node.text === 'tslib') {
      const fileName = currentSourceFile
      let moduleRequest
      if (tslibLocalPath.charAt(0) === '.') {
        moduleRequest = relative(dirname(fileName.replace(/\//g, sep)), getPath(tslibLocalPath)).replace(/\\/g, '/')
        if (moduleRequest.charAt(0) !== '.') {
          moduleRequest = `./${moduleRequest}`
        }
        return (!isDeclarationFile && suffix)
          ? factory.createStringLiteral(removeSuffix(nodeResolve(currentSourceFile, moduleRequest)) + ext)
          : factory.createStringLiteral(removeSuffix(moduleRequest))
      } else {
        moduleRequest = tslibLocalPath
        return factory.createStringLiteral(moduleRequest)
      }
    }
  }
  if (node.text.charAt(0) !== '.') {
    return node
  }
  return (!isDeclarationFile && suffix)
    ? factory.createStringLiteral(removeSuffix(nodeResolve(currentSourceFile, node.text)) + ext)
    : factory.createStringLiteral(removeSuffix(node.text))
}

function nodeResolve (currentSourceFile, moduleRequest) {
  const fullPath = join(dirname(currentSourceFile.replace(/\//g, sep)), moduleRequest)
  let stats
  try {
    stats = statSync(fullPath)
  } catch (_) {
    return moduleRequest
  }
  if (!stats.isDirectory()) {
    return moduleRequest
  }
  const pkgjson = join(fullPath, 'package.json')
  if (existsSync(pkgjson)) {
    let pkg
    try {
      pkg = readJsonSync(pkgjson)
    } catch (_) {
      return moduleRequest
    }
    if (!pkg.main) return nodeResolve(currentSourceFile, `./${posix.join(moduleRequest, 'index')}`)
    return nodeResolve(currentSourceFile, `./${posix.join(moduleRequest, pkg.main.replace(/\\/g, '/'))}`)
  } else {
    return nodeResolve(currentSourceFile, `./${posix.join(moduleRequest, 'index')}`)
  }
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
  pureClass: true,
  ignoreErrorCodes: [],
  define: {}
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
    const program = builderProgram.getProgram()
    var writeFileName = function (s) { return ts.sys.write(s + ts.sys.newLine); };
    var compilerOptions = builderProgram.getCompilerOptions();
    var newLine = ts.getNewLineCharacter(compilerOptions, function () { return ts.sys.newLine; });
    ts.emitFilesAndReportErrors(builderProgram, reportDiagnostic, writeFileName, function (errorCount) {
      return host.onWatchStatusChange(ts.createCompilerDiagnostic(ts.getWatchErrorSummaryDiagnosticMessage(errorCount), errorCount), newLine, compilerOptions, errorCount);
    }, undefined, undefined, !!compilerOptions.emitDeclarationOnly, {
      after: [createTransformer(false, customTransformOptions, compilerOptions, program)],
      afterDeclarations: [createTransformer(true, customTransformOptions, compilerOptions, program)]
    });
  }

  return ts.createWatchProgram(host)
}

exports.compile = compile
exports.watch = watch
