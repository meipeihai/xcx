/**
 * 一键上传并部署 cloudfunctions 下所有云函数
 *
 * 准备（只需做一次）：
 *   1. 微信公众平台 → 开发管理 → 开发设置 →「小程序代码上传密钥」→ 下载 private.key
 *      放到本项目根目录（即与本文件同级）
 *   2. 同一页面里关闭「IP 白名单」，或把当前公网 IP 加进白名单
 *   3. npm install miniprogram-ci
 *
 * 运行：
 *   node deploy-cloudfunctions.js
 *
 * 可选环境变量：
 *   MP_APPID       小程序 appid，默认读 project.config.json
 *   MP_ENV         云环境 ID，默认读 miniprogram/envList.js
 *   MP_KEY         私钥路径，默认 ./private.key
 *   MP_LOCAL_DEPS=1  打包各云函数本地 node_modules（默认 0，走云端安装依赖）
 *
 * 注意：appid 和环境 ID 不再写死在代码里，避免把隐私信息提交到仓库。
 */
const path = require('path')
const fs = require('fs')
const ci = require('miniprogram-ci')

// 云环境 ID：环境变量 → miniprogram/envList.js（该文件已在 .gitignore 中）
function readEnvId() {
  if (process.env.MP_ENV) return process.env.MP_ENV
  try {
    const list = require('./miniprogram/envList.js').envList || []
    const id = list.length ? list[0].envId : ''
    if (id && !/你的环境ID/.test(id)) return id
  } catch (e) {}
  return ''
}

// appid：环境变量 → project.config.json
function readAppid() {
  if (process.env.MP_APPID) return process.env.MP_APPID
  try {
    return require('./project.config.json').appid || ''
  } catch (e) {
    return ''
  }
}

const APPID = readAppid()
const ENV_ID = readEnvId()
const KEY = process.env.MP_KEY || path.resolve(__dirname, 'private.key')
const remoteNpmInstall = process.env.MP_LOCAL_DEPS !== '1'

if (!APPID) {
  console.error('\n[!] 拿不到 appid：请设置环境变量 MP_APPID，或确认 project.config.json 里填了 appid。\n')
  process.exit(1)
}

if (!ENV_ID) {
  console.error('\n[!] 拿不到云环境 ID：请按 README 把 miniprogram/envList.example.js 复制成 envList.js 并填入环境 ID，')
  console.error('    或者直接设置环境变量 MP_ENV。\n')
  process.exit(1)
}

if (!fs.existsSync(KEY)) {
  console.error('\n[!] 缺少上传密钥：' + KEY)
  console.error('    请到 微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传密钥 下载，')
  console.error('    保存为 private.key 放到项目根目录后重试。\n')
  process.exit(1)
}

const project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, 'miniprogram'),
  privateKeyPath: KEY,
  ignores: ['node_modules/**/*'],
})

const cfRoot = path.resolve(__dirname, 'cloudfunctions')
const names = fs.readdirSync(cfRoot).filter(n => {
  if (n === 'node_modules') return false
  const p = path.join(cfRoot, n)
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'index.js'))
})

console.log('appid  : ' + APPID)
console.log('env    : ' + ENV_ID)
console.log('依赖   : ' + (remoteNpmInstall ? '云端安装' : '本地打包'))
console.log('待部署 ' + names.length + ' 个: ' + names.join(', ') + '\n')

async function main() {
  let ok = 0
  const failed = []

  for (const name of names) {
    try {
      const r = await ci.cloud.uploadFunction({
        project,
        env: ENV_ID,
        name,
        path: path.join(cfRoot, name),
        remoteNpmInstall,
      })
      console.log('OK   ' + name + '  (files=' + r.filesCount + ', ' + r.packSize + 'B)')
      ok++
    } catch (e) {
      console.log('FAIL ' + name + ' -> ' + (e && e.message))
      failed.push(name)
    }
  }

  console.log('\n--- 成功 ' + ok + '/' + names.length)
  if (failed.length) {
    console.log('--- 失败: ' + failed.join(', '))
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error('\n运行出错: ' + (e && e.message))
  console.error((e && e.stack) || '')
  process.exitCode = 1
})
