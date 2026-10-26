// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 给「另一个人」推送今天吃什么 / 有人加菜了的服务通知
// 不再硬编码 openid：自动从 UserList 里找到除自己之外的那位
exports.main = async (event) => {
  try {
    const myOpenid = cloud.getWXContext().OPENID

    // 找到对方（UserList 按注册顺序，取第一个不是自己的）
    let targetOpenid = event.toOpenid
    if (!targetOpenid) {
      const users = (await db.collection('UserList').limit(10).get()).data || []
      const other = users.find(u => u._openid !== myOpenid)
      targetOpenid = other ? other._openid : myOpenid
    }

    // 优先使用调用方传来的菜名，否则取菜单最后一道菜
    let dishName = event.title || '今天也要好好吃饭'
    if (!event.title) {
      const dishes = (await db.collection('DishList').limit(20).get()).data || []
      const mine = dishes.filter(d => d._openid === myOpenid)
      if (mine.length) dishName = mine[mine.length - 1].title
    }

    const result = await cloud.openapi.subscribeMessage.send({
      touser: targetOpenid,
      data: {
        thing6: { value: String(dishName).slice(0, 20) },
        thing9: { value: String(event.remark || '你的宝喊你吃饭啦～').slice(0, 20) }
      },
      templateId: event.templateId,
      miniprogramState: 'developer',
      page: 'pages/MainPage/index'
    })

    return { success: true, result }
  } catch (err) {
    console.error('[information] 推送失败', err)
    return { success: false, err }
  }
}
