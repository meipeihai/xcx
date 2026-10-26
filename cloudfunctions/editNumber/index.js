// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ // 初始化云开发环境
  env: cloud.DYNAMIC_CURRENT_ENV // 当前环境的常量
})
const db = cloud.database()

// 云函数入口函数
// 通用数字字段自增：{ list, _id, field:'eatCount', value:1 }
// 额外字段覆盖：{ list, _id, field:'eatCount', value:1, extra:{ lastEatDate: ... } }
exports.main = async (event) => {
  const { list, _id, field, value = 1, extra } = event

  if (!list || !_id || !field) {
    return { errMsg: '缺少 list / _id / field 参数' }
  }

  const data = {}

  // value 为 0 时只覆盖 extra 字段，不做自增（inc(0) 在部分环境下不合法）
  if (Number(value) !== 0) {
    data[field] = db.command.inc(Number(value))
  }
  if (extra) Object.assign(data, extra)

  if (!Object.keys(data).length) {
    return { errMsg: '没有需要更新的字段' }
  }

  return await db.collection(list).where({ _id }).update({ data })
}
