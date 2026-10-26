// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ // 初始化云开发环境
  env: cloud.DYNAMIC_CURRENT_ENV // 当前环境的常量
})
const db = cloud.database()

// 云函数入口函数
// 通用新增：event.list 指定集合，其余字段原样写入
// 例：{ list: 'DishList', title:'番茄牛腩', price:38, category:'荤菜', tags:['下饭'] }
exports.main = async (event) => {
  const { list, ...rest } = event

  if (!list) {
    return { errMsg: '缺少 list 参数' }
  }

  const write = () => db.collection(list).add({
    data: {
      _openid: cloud.getWXContext().OPENID,
      date: db.serverDate(),

      // 通用默认字段
      available: rest.available === undefined ? true : rest.available,
      star: rest.star === undefined ? false : rest.star,

      ...rest
    }
  })

  try {
    return await write()
  } catch (e) {
    const msg = String((e && e.message) || e || '')
    // 集合不存在时自动建一次再写，避免首次直接加菜就报错
    if (/not exists|ResourceNotFound|502005/i.test(msg)) {
      try {
        await db.createCollection(list)
      } catch (_) {
        // 并发时可能已被创建，忽略
      }
      return await write()
    }
    throw e
  }
}
