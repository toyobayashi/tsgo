# tsgo

使用 TypeScript 编写库并根据 TSDoc 生成 Markdown API 文档的命令行工具。

## 快速开始

### NPM 全局安装

``` bash
$ npm install -g @tybys/tsgo
```

### 生成项目

``` bash
$ mkdir mylib
$ cd mylib
$ tsgo gen
```

## 命令

* `tsgo build`

    根据根目录的 `tsconfig*.json` 配置文件编译源码到 `lib/{cjs,cjs-modern,esm,esm-modern}`，如果对应的 tsconfig 不存在则不会编译该类型的目标。

    * `lib/cjs` - ES5 CommonJS，可用于类 Node.js 环境和支持 CommonJS 模块格式的打包器（特别是用于不使用 ES6 转 ES5 的微信小程序中）

    * `lib/cjs-modern` - ES2018 CommonJS，可用于类 Node.js 环境和支持 CommonJS 模块格式的打包器。（Node.js 默认入口）

    * `lib/esm` - ES5 ESNext，可用于 Webpack / Rollup / 浏览器原生 `<script type="module">`（Webpack / Rollup 默认入口）

    * `lib/esm-modern` - ES5 ESNext，可用于 Webpack / Rollup / 浏览器原生 `<script type="module">`

    打包 UMD 模块到 `dist/${name}.js` `dist/${name}.min.js`，默认入口是 `lib/esm/index.js`，如果不存在则不会打包。

    根据 `lib/esm/index.d.ts` 打包类型声明到 `dist/${name}.d.ts` API 文档，生成 API JSON 到 `temp/${name}.api.json`, 如果不存在则不会打包。

    根据 `temp` 目录下的所有 JSON 文件生成 API 文档到 `docs/api`，如果不存在则生成。

* `tsgo cjs`

    编译 `tsconfig.json` 和 `tsconfig.cjs.json`。

* `tsgo esm`

    编译 `tsconfig.esm.json` 和 `tsconfig.modern.json`。

* `tsgo umd`

    打包 UMD 模块到 `dist/${name}.js` `dist/${name}.min.js`，默认入口是 `lib/esm/index.js`。

* `tsgo watch`

    Watch and build.

* `tsgo doc`

    根据 `temp` 目录下的所有 JSON 文件生成 API 文档到 `docs/api`。

* `tsgo dts`

    根据 `lib/esm/index.d.ts` 打包类型声明到 `dist/${name}.d.ts` API 文档，生成 API JSON 到 `temp/${name}.api.json`。

* `tsgo lint`

    ESLint 检查源码。

* `tsgo fix`

    ESLint 格式化源码。

## bundleOnly 编译时变量表

| `__TSGO_FORMAT__` | `umd` | `cjs` | `esm-bundler` | `esm-browser` | `esm-node` | `iife` |
| :-----: | :----: | :----: | :----: | :----: | :----: | :----: |
| 文件后缀 | `.js` | `.cjs.js` | `.esm-bundler.js` | `.esm-browser.js` | `.mjs` | `.global.js` |
| 预处理 `process.env.NODE_ENV` | ✔ | ✔ | ❌ | ✔ | ❌ | ✔ |
| `__TSGO_DEV__` <br/>（为开发构建） | 不压缩则 `true` | 不压缩则 `true` | `process.env.NODE_ENV !== 'production'` | 不压缩则 `true` | `process.env.NODE_ENV !== 'production'` | 不压缩则 `true` |
| `__TSGO_GLOBAL__` <br/>（可在浏览器全局引入） | ✔ | ❌ | ❌ |❌ | ❌ | ✔ |

## 默认配置

根目录 `tsgo.config.js`

``` js
const defaultConfig = {
  entry: 'lib/esm/index.js', // UMD 模块打包的入口
  output: {
    name: packageJson.name, // UMD 模块文件名
    rollup: 'dist', // UMD 模块输出目录
    doc: 'docs/api' // API 文档输出目录
  },
  bundleOnly: false, // ('umd' | 'cjs' | 'esm-bundler' | 'esm-browser' | 'esm-node' | 'iife')[]
  bundleDefine: {},
  rollupGlobals: {},
  bundler: ['rollup'], // 只采用 rollup 打包
  library: packageJson.name, // UMD 全局暴露变量名
  tsconfig: {
    cjs: 'tsconfig.cjs.json', // es5 cjs
    cjsModern: 'tsconfig.json', // modern cjs
    esm: 'tsconfig.esm.json', // es5 esm
    esmModern: 'tsconfig.modern.json' // modern esm
  },
  tsTransform: {
    // 自动转换import/export模块的后缀名
    // 还可以是 'none' （不转换） 和
    // 'node' （ESM 转换成 '.mjs'）
    moduleSuffix: 'default',
    tslibLocalPath: '', // 从本地 tslib 导入 helper 函数，tslib 模块的位置
    ignoreErrorCodes: [] // 这里的 TS 错误码不报错
  },
  resolveOnly: [],
  dtsFormat: 'umd',
  webpackTarget: 'web',
  replaceESModule: false, // 兼容 IE8
  terserOptions: { // 看 terser 文档
    ie8: false,
    output: {
      comments: false
    }
  },
  namespaceWrapper: false, // 简单支持 import * as ___ from './___' 导入本地模块，api-extractor 暂不支持 
  externalApiDeclarationDir: 'api' // 额外的 .d.ts 存放目录，编译时被复制 
}
```
