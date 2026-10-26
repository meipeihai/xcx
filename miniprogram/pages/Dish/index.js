const app = getApp()

// 左侧分类栏每个分类配一个图标
const CATEGORY_ICON = {
  '全部': '🍽',
  '热菜': '🍖', '荤菜': '🍖', '素菜': '🥬', '主食': '🍚',
  '汤': '🥣', '汤羹': '🥣', '甜品': '🍰', '饮品': '🥤', '饮料': '🥤',
  '小菜': '🥗', '凉菜': '🥗', '小吃': '🍡', '早餐': '🥐', '夜宵': '🌙',
  '未分类': '📝',
}

Page({
  data: {
    screenWidth: 1000,
    screenHeight: 1000,

    search: '',
    categoryIndex: 0,
    categories: ['全部'],
    catDocs: [],      // 云端分类文档（管理面板用）
    managing: false,  // 分类管理面板是否打开

    user: '',
    openid: '',

    _openidA: '',
    _openidB: '',
    userA: '',
    userB: '',

    allDishes: [],   // 全部菜品
    onMenu: [],      // 在菜单里
    offMenu: [],     // 已下架（不爱吃了）

    slideButtons: [
      {extClass: 'addBtn', text: '加菜', src: "Images/icon_buy.svg"},
      {extClass: 'starBtn', text: '星标', src: "Images/icon_star.svg"},
      {extClass: 'removeBtn', text: '删除', src: 'Images/icon_del.svg'}
    ],
  },

  // 页面加载时运行
  async onShow() {
    await app.ready()
    this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight })

    const docs = app.globalData.categoryDocs || []
    const rest = docs.length
      ? docs.map(d => ({ name: d.name, icon: d.icon || CATEGORY_ICON[d.name] || '🍴' }))
      : app.globalData.categories.map(name => ({ name, icon: CATEGORY_ICON[name] || '🍴' }))

    this.setData({
      categories: [{ name: '全部', icon: '🍽' }].concat(rest),
      catDocs: docs,
      openid: app.globalData.openid,
      _openidA: app.globalData._openidA,
      _openidB: app.globalData._openidB,
      userA: app.globalData.userA,
      userB: app.globalData.userB,
      user: app.nickNameOf(app.globalData.openid),
    })

    await this.loadDishes()
    this.getScreenSize()
  },

  // 拉取菜品库
  async loadDishes() {
    const res = await wx.cloud.callFunction({
      name: 'getList',
      data: { list: app.globalData.collectionDishList }
    })
    this.setData({ allDishes: res.result.data || [] })
    this.filterDish()
  },

  // 获取页面大小
  getScreenSize() {
    wx.getSystemInfo({
      success: (res) => {
        this.setData({ screenWidth: res.windowWidth, screenHeight: res.windowHeight })
      }
    })
  },

  // 切换分类
  onCategoryTap(e) {
    this.setData({ categoryIndex: Number(e.currentTarget.dataset.index) })
    this.filterDish()
  },

  // 转到菜品详情
  toDetailPage(element, isUpper) {
    const index = element.currentTarget.dataset.index
    const dish = isUpper ? this.data.onMenu[index] : this.data.offMenu[index]
    wx.navigateTo({ url: '../DishDetail/index?id=' + dish._id })
  },
  toDetailPageUpper(element) { this.toDetailPage(element, true) },
  toDetailPageLower(element) { this.toDetailPage(element, false) },

  // 转到加菜页
  toAddPage() {
    wx.navigateTo({ url: '../DishAdd/index' })
  },

  // 卡片右侧的「＋」：直接加入今日餐单
  addDish(e) {
    const index = Number(e.currentTarget.dataset.index)
    const dish = this.data.onMenu[index]
    if (dish) return this.addToCart(dish)
  },

  // 搜索
  onSearch(element) {
    this.setData({ search: element.detail.value })
    this.filterDish()
  },

  // 按搜索词 + 分类过滤，并划分为：在菜单 / 已下架
  filterDish() {
    let list = this.data.allDishes

    if (this.data.search) {
      list = list.filter(item => (item.title || '').indexOf(this.data.search) !== -1)
    }

    const cur = this.data.categories[this.data.categoryIndex]
    const cat = cur && cur.name
    if (cat && cat !== '全部') {
      list = list.filter(item => (item.category || '未分类') === cat)
    }

    // 补上备菜进度，供列表直接展示
    const decorate = (item) => {
      // 兼容两种格式：老数据 ['番茄'] + prepared，新格式 [{name, got}]
      const list = (item.ingredients || []).map(i => {
        if (typeof i === 'string') {
          return { name: i, got: (item.prepared || []).indexOf(i) !== -1 }
        }
        return { name: i.name, got: !!i.got }
      })
      return Object.assign({}, item, {
        ingredientTotal: list.length,
        ingredientDone: list.filter(i => i.got).length,
      })
    }

    const onList = list.filter(item => item.available === true).map(decorate)

    // 被点次数最多的那道菜挂「人气 No.1」角标（没人点过就不挂）
    let topIdx = -1
    let topCount = 0
    onList.forEach((d, i) => {
      if ((d.eatCount || 0) > topCount) {
        topCount = d.eatCount || 0
        topIdx = i
      }
    })
    if (topIdx >= 0 && topCount > 0) onList[topIdx].isTop = true

    this.setData({
      onMenu: onList,
      offMenu: list.filter(item => item.available === false).map(decorate),
    })
  },

  // 响应左划按钮事件[上]
  slideButtonTapUpper(element) { this.slideButtonTap(element, true) },
  // 响应左划按钮事件[下]
  slideButtonTapLower(element) { this.slideButtonTap(element, false) },

  // 响应左划按钮事件逻辑
  async slideButtonTap(element, isUpper) {
    const { index } = element.detail
    const dishIndex = element.currentTarget.dataset.index
    const dish = isUpper ? this.data.onMenu[dishIndex] : this.data.offMenu[dishIndex]
    const openid = app.globalData.openid

    // 加入今日餐单（菜单是共用的，自己加的菜也能点）
    if (index === 0) {
      if (isUpper) {
        this.addToCart(dish)
      } else {
        wx.showToast({ title: '这道菜已经下架啦', icon: 'none', duration: 2000 })
      }
      return
    }

    // 星标与删除只能操作自己添加的菜
    if (dish._openid !== openid) {
      return wx.showToast({ title: '只能编辑自己加的菜', icon: 'none', duration: 2000 })
    }

    if (index === 1) {
      wx.cloud.callFunction({
        name: 'editStar',
        data: { _id: dish._id, list: app.globalData.collectionDishList, value: !dish.star }
      })
      dish.star = !dish.star
    } else if (index === 2) {
      wx.cloud.callFunction({
        name: 'deleteElement',
        data: { _id: dish._id, list: app.globalData.collectionDishList }
      })
      // 同步本地数据后再重新分组，避免刷新时又被拉回来
      this.setData({ allDishes: this.data.allDishes.filter(d => d._id !== dish._id) })
      this.filterDish()
      return
    }

    this.setData({ onMenu: this.data.onMenu, offMenu: this.data.offMenu })
  },

  // 加菜：写入今日餐单，并累计这道菜的点单次数
  async addToCart(dish) {
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

    // 累计被点次数（等它写完再提示，避免列表刷新时数字还没变）
    await wx.cloud.callFunction({
      name: 'editNumber',
      data: { list: app.globalData.collectionDishList, _id: dish._id, field: 'eatCount', value: 1 }
    })

    wx.showToast({ title: '已加入今日餐单', icon: 'success', duration: 1500 })
  },

  // 按当前时间猜一个餐次
  guessMealType() {
    const h = new Date().getHours()
    if (h < 10) return 'breakfast'
    if (h < 15) return 'lunch'
    if (h < 21) return 'dinner'
    return 'night'
  },

  // ================= 分类管理 =================

  // 重新读一次云端分类：刷新左侧栏 + 面板 + 加菜页用的那份
  async refreshCategories() {
    const res = await wx.cloud.callFunction({
      name: 'getList',
      data: {
        list: app.globalData.collectionCategoryList,
        orderBy: { field: 'sort', desc: false },
      }
    })
    const docs = res.result.data || []

    app.globalData.categoryDocs = docs
    app.globalData.categories = docs.map(d => d.name).filter(Boolean)

    this.setData({
      catDocs: docs,
      categories: [{ name: '全部', icon: '🍽' }].concat(
        docs.map(d => ({ name: d.name, icon: d.icon || CATEGORY_ICON[d.name] || '🍴' }))
      ),
    })

    // 分类删少了，当前选中项可能越界
    if (this.data.categoryIndex >= this.data.categories.length) {
      this.setData({ categoryIndex: 0 })
    }
    this.filterDish()
  },

  openManager() {
    this.setData({ managing: true, catDocs: app.globalData.categoryDocs || [] })
  },

  closeManager() {
    this.setData({ managing: false })
  },

  // 新增分类
  async addCategory() {
    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '例如：凉菜',
      success: async (res) => {
        if (!res.confirm || !res.content) return
        const name = String(res.content).trim()
        if (!name) return

        if (this.data.catDocs.some(d => d.name === name)) {
          return wx.showToast({ title: '已经有这个分类了', icon: 'none', duration: 1500 })
        }

        await wx.cloud.callFunction({
          name: 'addElement',
          data: {
            list: app.globalData.collectionCategoryList,
            name,
            icon: CATEGORY_ICON[name] || '🍴',
            sort: this.data.catDocs.length,
          }
        })
        await this.refreshCategories()
        wx.showToast({ title: '加好了', icon: 'success', duration: 1500 })
      }
    })
  },

  // 改名：该分类下的菜一起搬过去，免得菜留在旧分类里找不着
  async renameCategory(e) {
    const cat = this.data.catDocs[Number(e.currentTarget.dataset.index)]
    if (!cat) return

    wx.showModal({
      title: '给分类改名',
      editable: true,
      content: cat.name,
      placeholderText: '分类名称',
      success: async (res) => {
        if (!res.confirm || !res.content) return
        const name = String(res.content).trim()
        const oldName = cat.name
        if (!name || name === oldName) return

        // value: 0 表示只覆盖 extra，不做自增
        await wx.cloud.callFunction({
          name: 'editNumber',
          data: {
            list: app.globalData.collectionCategoryList,
            _id: cat._id, field: 'sort', value: 0, extra: { name },
          }
        })

        // 按旧名字找菜：分类文档本身已经改成新名了
        const hit = this.data.allDishes.filter(d => (d.category || '未分类') === oldName)
        for (const d of hit) {
          await wx.cloud.callFunction({
            name: 'editNumber',
            data: {
              list: app.globalData.collectionDishList,
              _id: d._id, field: 'eatCount', value: 0, extra: { category: name },
            }
          })
        }

        await this.loadDishes()
        await this.refreshCategories()
        wx.showToast({
          title: hit.length ? `已改名，${hit.length} 道菜一起搬过去了` : '已改名',
          icon: 'none', duration: 2000,
        })
      }
    })
  },

  // 换图标
  async pickIcon(e) {
    const cat = this.data.catDocs[Number(e.currentTarget.dataset.index)]
    if (!cat) return

    const icons = ['🍖', '🥬', '🍚', '🥣', '🍰', '🥤']
    wx.showActionSheet({
      itemList: icons,
      success: async (res) => {
        const icon = icons[res.tapIndex]
        await wx.cloud.callFunction({
          name: 'editNumber',
          data: {
            list: app.globalData.collectionCategoryList,
            _id: cat._id, field: 'sort', value: 0, extra: { icon },
          }
        })
        await this.refreshCategories()
      },
      fail: () => {}
    })
  },

  // 删除分类：下面的菜挪到「未分类」
  async removeCategory(e) {
    const cat = this.data.catDocs[Number(e.currentTarget.dataset.index)]
    if (!cat) return

    const oldName = cat.name
    const hit = this.data.allDishes.filter(d => (d.category || '未分类') === oldName)
    wx.showModal({
      title: '删除分类',
      content: hit.length
        ? `「${oldName}」下有 ${hit.length} 道菜，删除后它们会移到「未分类」，确定吗？`
        : `确定删除「${cat.name}」吗？`,
      success: async (res) => {
        if (!res.confirm) return

        for (const d of hit) {
          await wx.cloud.callFunction({
            name: 'editNumber',
            data: {
              list: app.globalData.collectionDishList,
              _id: d._id, field: 'eatCount', value: 0, extra: { category: '未分类' },
            }
          })
        }
        await wx.cloud.callFunction({
          name: 'deleteElement',
          data: { list: app.globalData.collectionCategoryList, _id: cat._id }
        })

        await this.loadDishes()
        await this.refreshCategories()
        wx.showToast({ title: '已删除', icon: 'none', duration: 1500 })
      }
    })
  },
})
