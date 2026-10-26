App({
  /**
   * 全局配置（同步赋值，保证页面初始化时可读）
   */
  globalData: {
    // 当前使用者的 openid，登录成功后写入
    openid: '',

    // 两位使用者的 openid，登录后按注册顺序自动填充（A = 先注册）
    _openidA: '',
    _openidB: '',

    isUserA: false,

    // 两位使用者的昵称（首页点名字即可修改，存在云端）
    userA: '宝贝A',
    userB: '宝贝B',

    // 用户文档的 _id，改称呼时用 editNumber 定位（注意不是 openid）
    userIdA: '',
    userIdB: '',

    // 云数据库集合名称
    collectionDishList: 'DishList',   // 菜品库
    collectionCartList: 'CartList',   // 今日餐单
    collectionUserList: 'UserList',   // 用户资料（昵称）
    collectionCategoryList: 'CategoryList', // 菜品分类（菜单页可增删改）

    // 分类文档（含图标），菜单页的管理面板直接读
    categoryDocs: [],

    // 菜品分类
    categories: ['主食', '荤菜', '素菜', '汤羹', '甜品', '饮品', '小吃', '外卖'],

    // 口味 / 场景标签
    dishTags: ['辣', '微辣', '清淡', '下饭', '快手', '减脂', '汤汁多', '有汤', '凉菜', '网红'],

    // 餐次
    mealTypes: ['早餐', '午餐', '晚餐', '夜宵'],

    // 单次最大价格
    maxPrice: 200,
  },

  onLaunch() {
    this.initcloud()
    // 登录并自动开户 → 再取一次分类，页面通过 await getApp().ready() 等待完成
    this._ready = (async () => {
      await this.ensureUser()
      await this.loadCategories()
    })().catch(err => {
      console.error('[app] 初始化失败', err)
      this.showCloudError(err)
    })
  },

  /** 云环境配置错误时给出可操作的提示，避免页面静默空白 */
  showCloudError(err) {
    const msg = String((err && err.errMsg) || err || '')
    if (/Env Not Exists|env not exists|INVALID_ENV/i.test(msg)) {
      wx.showModal({
        title: '云环境不可用',
        content: 'miniprogram/envList.js 里的环境 ID 不属于当前 appid。请换成自己小程序的云环境 ID（微信开发者工具 → 云开发 → 设置 → 环境 ID）。',
        showCancel: false,
      })
      return
    }
    if (/FunctionName parameter could not be found|function not exists/i.test(msg)) {
      wx.showModal({
        title: '云函数未部署',
        content: '请右键 cloudfunctions 下每个目录选择「上传并部署：云端安装依赖」。',
        showCancel: false,
      })
    }
  },

  /** 页面用 await getApp().ready() 等待登录与数据就绪 */
  ready() {
    return this._ready || Promise.resolve()
  },

  /**
   * 登录：取 openid → 若未开户则自动创建 → 拉取双方 openid
   */
  async ensureUser() {
    const openid = (await wx.cloud.callFunction({ name: 'getOpenId' })).result
    this.globalData.openid = openid

    let users = (await wx.cloud.callFunction({
      name: 'getList',
      data: { list: this.globalData.collectionUserList }
    })).result.data || []

    // 第一次进入：自动开户
    if (!users.some(u => u._openid === openid)) {
      await wx.cloud.callFunction({
        name: 'addElement',
        data: { list: this.globalData.collectionUserList }
      })
      users = (await wx.cloud.callFunction({
        name: 'getList',
        data: { list: this.globalData.collectionUserList }
      })).result.data || []
    }

    // 按注册顺序确定 A / B（先注册的为 A）
    users.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    this.globalData._openidA = users[0] ? users[0]._openid : ''
    this.globalData._openidB = users[1] ? users[1]._openid : ''

    // 改称呼要按文档 _id 更新，先存下来
    this.globalData.userIdA = users[0] ? users[0]._id : ''
    this.globalData.userIdB = users[1] ? users[1]._id : ''

    // 云端存过称呼就用云端的，没存过用默认
    this.globalData.userA = (users[0] && users[0].nickname) || '宝贝A'
    this.globalData.userB = (users[1] && users[1].nickname) || '宝贝B'

    // 超过两人都按 B 处理，昵称回退
    this.globalData.isUserA = openid === this.globalData._openidA
  },

  /**
   * 菜品分类：存在云端，两个人共用同一份
   * 第一次用时自动写入默认分类（集合不存在时云函数会自动建）
   */
  async loadCategories() {
    const list = this.globalData.collectionCategoryList
    const orderBy = { field: 'sort', desc: false }
    const DEFAULT = [
      { name: '主食', icon: '🍚' }, { name: '荤菜', icon: '🍖' },
      { name: '素菜', icon: '🥬' }, { name: '汤羹', icon: '🥣' },
      { name: '甜品', icon: '🍰' }, { name: '饮品', icon: '🥤' },
      { name: '小吃', icon: '🍡' }, { name: '外卖', icon: '🛵' },
    ]

    const read = async () => (await wx.cloud.callFunction({
      name: 'getList',
      data: { list, orderBy }
    })).result.data || []

    let docs = await read()

    // 还没建过分类：把默认那套写进云端
    if (docs.length === 0) {
      for (let i = 0; i < DEFAULT.length; i++) {
        await wx.cloud.callFunction({
          name: 'addElement',
          data: { list, name: DEFAULT[i].name, icon: DEFAULT[i].icon, sort: i }
        })
      }
      docs = await read()
    }

    this.globalData.categoryDocs = docs
    // 加菜页的分类选择器直接读这个数组，所以一并覆盖
    this.globalData.categories = docs.map(d => d.name).filter(Boolean)
  },

  /** 判断某个 openid 对应的昵称 */
  nickNameOf(openid) {
    if (openid === this.globalData._openidA) return this.globalData.userA
    if (openid === this.globalData._openidB) return this.globalData.userB
    return '对方'
  },

  /** 判断某条记录是不是自己创建的 */
  isMine(openid) {
    return openid === this.globalData.openid
  },

  /**
   * 初始化云开发环境
   */
  async initcloud() {
    const normalinfo = require('./envList.js').envList || []
    if (normalinfo.length != 0 && normalinfo[0].envId != null) {
      wx.cloud.init({
        traceUser: true,
        env: normalinfo[0].envId
      })
      this.cloud = () => wx.cloud
    } else {
      this.cloud = () => {
        wx.showModal({ content: '无云开发环境', showCancel: false })
        throw new Error('无云开发环境')
      }
    }
  },

  // 获取云数据库实例
  async database() {
    return (await this.cloud()).database()
  },
})
