const app = getApp()

Page({
  data: {
    userA: '',
    userB: '',

    // 当前登录者是哪一位（用来在自己的名字后标「我」）
    isA: false,
    isB: false,

    // 抽签
    rolling: false,
    lucky: null,
    dishCount: 0,

    // 今日餐单数
    cartCount: 0,

    // 常吃推荐
    hotDishes: [],
  },

  async onShow() {
    await app.ready()
    this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight })

    const me = app.globalData.openid
    this.setData({
      userA: app.globalData.userA,
      userB: app.globalData.userB,
      // 第三个人（体验者）两行都不标
      isA: !!me && me === app.globalData._openidA,
      isB: !!me && me === app.globalData._openidB,
    })

    await Promise.all([this.loadDishes(), this.loadCart()])
  },

  // 拉取菜品库（抽签用）
  async loadDishes() {
    const res = await wx.cloud.callFunction({
      name: 'getList',
      data: { list: app.globalData.collectionDishList }
    })
    const dishes = (res.result.data || []).filter(d => d.available !== false)
    this.dishes = dishes

    // 常吃榜单：只排被点过的菜，附带名次、奖牌和相对热度
    const ranked = dishes
      .filter(d => (d.eatCount || 0) > 0)
      .sort((a, b) => (b.eatCount || 0) - (a.eatCount || 0))
      .slice(0, 3)
    const top = ranked.length ? (ranked[0].eatCount || 0) : 0
    const medals = ['🥇', '🥈', '🥉']
    const hotDishes = ranked.map((d, i) => {
      const count = d.eatCount || 0
      return Object.assign({}, d, {
        rank: i + 1,
        medal: medals[i],
        // 相对第一名的热度，最低留 15% 保证条看得见
        percent: top > 0 ? Math.max(Math.round(count / top * 100), 15) : 0,
      })
    })

    this.setData({ dishCount: dishes.length, hotDishes })
  },

  // 今日餐单数量
  async loadCart() {
    const res = await wx.cloud.callFunction({
      name: 'getList',
      data: { list: app.globalData.collectionCartList }
    })
    const items = (res.result.data || []).filter(i => i.available !== false)
    this.setData({ cartCount: items.length })
  },

  // 抽签：今天吃什么
  randomPick() {
    const pool = this.dishes || []
    if (!pool.length) {
      return wx.showToast({ title: '菜单还是空的~', icon: 'none', duration: 2000 })
    }

    this.setData({ rolling: true })
    setTimeout(() => {
      const pick = pool[Math.floor(Math.random() * pool.length)]
      this.setData({ lucky: pick, rolling: false })
    }, 1200)
  },

  // 把抽中的菜加入今日餐单
  async addLuckyToCart() {
    const dish = this.data.lucky
    if (!dish) return

    await wx.cloud.callFunction({
      name: 'addElement',
      data: {
        list: app.globalData.collectionCartList,
        dishId: dish._id,
        title: dish.title,
        desc: dish.desc || '',
        price: dish.price || 0,
        imageFileID: dish.imageFileID || '',
        count: 1,
        remark: '',
        mealType: this.guessMealType(),
        state: 'want',
      }
    })
    wx.cloud.callFunction({
      name: 'editNumber',
      data: { list: app.globalData.collectionDishList, _id: dish._id, field: 'eatCount', value: 1 }
    })

    wx.showToast({ title: '就吃这个！', icon: 'success', duration: 1500 })
    this.loadCart()
  },

  guessMealType() {
    const h = new Date().getHours()
    if (h < 10) return 'breakfast'
    if (h < 15) return 'lunch'
    if (h < 21) return 'dinner'
    return 'night'
  },

  goDish() { wx.switchTab({ url: '../Dish/index' }) },

  // 点榜单里的某道菜，直接进它的详情
  goDishDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '../DishDetail/index?id=' + id })
  },

  goRecord() { wx.switchTab({ url: '../Cook/index' }) },
  goCart() { wx.switchTab({ url: '../Cart/index' }) },

  // 改称呼：点首页「我们的称呼」里的名字就能改，存到云端，两个人都能看到
  renameUser(e) {
    const which = e.currentTarget.dataset.which   // 'A' 或 'B'
    const userId = which === 'A' ? app.globalData.userIdA : app.globalData.userIdB
    const old = which === 'A' ? app.globalData.userA : app.globalData.userB

    // 只有你们俩能改，避免体验者或其他人乱改称呼
    const me = app.globalData.openid
    if (me !== app.globalData._openidA && me !== app.globalData._openidB) {
      return wx.showToast({ title: '只有你们俩能改称呼哦', icon: 'none', duration: 1500 })
    }

    if (!userId) {
      return wx.showToast({ title: 'TA 还没登录过，改不了', icon: 'none', duration: 1500 })
    }

    wx.showModal({
      title: '改称呼',
      editable: true,
      placeholderText: old,
      content: old,
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name || name === old) return

        await wx.cloud.callFunction({
          name: 'editNumber',
          data: {
            list: app.globalData.collectionUserList,
            _id: userId,        // 用户文档自己的 _id
            field: 'nickname',
            value: 0,           // 0 = 只覆盖 extra，不改数值字段
            extra: { nickname: name },
          }
        })

        // 本地和全局同步改掉，其它页面进来就是新名字
        if (which === 'A') {
          app.globalData.userA = name
          this.setData({ userA: name })
        } else {
          app.globalData.userB = name
          this.setData({ userB: name })
        }
        wx.showToast({ title: '改好啦', icon: 'success', duration: 1200 })
      }
    })
  },
})
