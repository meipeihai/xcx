// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ // 初始化云开发环境
  env: cloud.DYNAMIC_CURRENT_ENV // 当前环境的常量
})
const db = cloud.database()

const MAX_LIMIT = 100 // 云函数端单次取数上限

// 云函数入口函数
// 默认全量返回（自动突破 100 条上限）；只有显式传入 page（>=0）时才分页
// 支持排序：orderBy = { field: 'date', desc: true }
exports.main = async (event) => {
  const { list, page = -1, size = 20, orderBy } = event

  if (!list) {
    return { errMsg: '缺少 list 参数' }
  }

  // 先探一次集合：不存在就自动创建，避免首次使用时直接报
  // DATABASE_COLLECTION_NOT_EXIST（-502005）
  let total
  try {
    total = (await db.collection(list).count()).total
  } catch (e) {
    const msg = String((e && e.message) || e || '')
    if (/not exists|ResourceNotFound|502005/i.test(msg)) {
      try {
        await db.createCollection(list)
      } catch (_) {
        // 并发调用时可能已被创建，忽略
      }
      return { data: [], errMsg: 'collection.get:ok', created: true }
    }
    throw e
  }

  let query = db.collection(list)
  if (orderBy && orderBy.field) {
    query = query.orderBy(orderBy.field, orderBy.desc ? 'desc' : 'asc')
  }

  // 分页模式：调用方显式传了 page
  if (Number(page) >= 0) {
    const p = Number(page)
    const s = Math.min(Number(size) || 20, MAX_LIMIT)
    return await query.skip(p * s).limit(s).get()
  }

  // 全量模式：分批拉取，突破 100 条上限
  if (total === 0) return { data: [], errMsg: 'collection.get:ok' }

  const batchTimes = Math.ceil(total / MAX_LIMIT)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(query.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get())
  }
  const results = await Promise.all(tasks)
  return {
    data: results.reduce((acc, cur) => acc.concat(cur.data || []), []),
    errMsg: 'collection.get:ok'
  }
}
