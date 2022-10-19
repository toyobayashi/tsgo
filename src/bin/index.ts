#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { findPrefix } from './find-prefix'
import { DynamicCommandLineParser, CommandLineAction } from '@rushstack/ts-command-line'
import { build, watch } from '../index'
import { readConfig } from './read-config'
import { typeCheck } from '@tybys/tsapi'

const command = process.argv[2]
const pkg = require('../../package.json')

if (command === '-v' || command === '--version' || command === '-V') {
  console.log(pkg.version)
  process.exit(0)
}

const targetConfigFile = 'tsgo.config.js'

const commandLineParser = new DynamicCommandLineParser({
  toolFilename: 'tsgo',
  toolDescription: `[v${pkg.version as string}] ${pkg.description as string}`
})

class CheckAction extends CommandLineAction {
  constructor () {
    super({
      actionName: 'check',
      summary: 'Type Checking',
      documentation: 'Type Checking'
    })
  }

  onDefineParameters (): void {}

  async onExecute (): Promise<void> {
    const root = findPrefix(process.cwd())
    const config = readConfig(path.resolve(root, targetConfigFile))
    const result = typeCheck(path.resolve(config.root, config.baseTsconfig ?? 'tsconfig.json'))
    if (result.diagnostics && result.diagnostics.length > 0) {
      throw new Error('Type Check failed')
    }
  }
}

class BuildAction extends CommandLineAction {
  constructor () {
    super({
      actionName: 'build',
      summary: 'Build project',
      documentation: 'Build project'
    })
  }

  onDefineParameters (): void {}

  async onExecute (): Promise<void> {
    const root = findPrefix(process.cwd())
    await build(readConfig(path.resolve(root, targetConfigFile)))
  }
}

class WatchAction extends CommandLineAction {
  constructor () {
    super({
      actionName: 'watch',
      summary: 'Develop with watch mode',
      documentation: 'Develop with watch mode'
    })
  }

  onDefineParameters (): void {}

  async onExecute (): Promise<void> {
    const root = findPrefix(process.cwd())
    watch(readConfig(path.resolve(root, targetConfigFile)))
  }
}

class InitAction extends CommandLineAction {
  constructor () {
    super({
      actionName: 'init',
      summary: 'Create a new library project',
      documentation: 'Create a new library project'
    })
  }

  onDefineParameters (): void {
    this.defineCommandLineRemainder({
      description: 'package name'
    })
  }

  private _copyTemplate (dest: string, data: Record<string, string>): void {
    const templateDir = path.join(__dirname, '../../template')
    this._copyItem(templateDir, dest, data)
  }

  private _copyItem (src: string, dest: string, data: Record<string, string>): void {
    const info = fs.statSync(src)
    const rewriteDest = path.join(path.dirname(dest), path.basename(dest).replace(/^__/, '').replace(/^_/, '.'))
    if (info.isDirectory()) {
      fs.mkdirSync(rewriteDest, { recursive: true })
      const items = fs.readdirSync(src)
      for (let i = 0; i < items.length; ++i) {
        this._copyItem(path.join(src, items[i]), path.join(rewriteDest, items[i]), data)
      }
    } else if (info.isFile()) {
      const keys = Object.keys(data)
      let content = fs.readFileSync(src, 'utf8')
      for (let i = 0; i < keys.length; ++i) {
        content = content.replace(new RegExp(`\\$\\{${keys[i]}\\}`, 'g'), data[keys[i]])
      }
      fs.writeFileSync(rewriteDest, content, 'utf8')
    }
  }

  async onExecute (): Promise<void> {
    const packageName = this.remainder!.values[0]
    if (!packageName) {
      throw new Error('Package name is required')
    }
    const unscopedPackageName = path.posix.basename(packageName)
    const root = path.resolve(process.cwd(), unscopedPackageName)
    if (fs.existsSync(root)) {
      throw new Error(`Can not mkdir "${root}"`)
    }
    fs.mkdirSync(root, { recursive: true })

    this._copyTemplate(root, {
      packageName,
      unscopedPackageName,
      tsgoVersion: pkg.version,
      username: os.userInfo().username
    })
  }
}

commandLineParser.addAction(new InitAction())
commandLineParser.addAction(new CheckAction())
commandLineParser.addAction(new BuildAction())
commandLineParser.addAction(new WatchAction())

commandLineParser.executeWithoutErrorHandling().catch(err => {
  console.error(err)
  process.exit(1)
})
