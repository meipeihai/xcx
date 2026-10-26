const app = getApp()

Page({
  data: {
    search: "",

    allItems: [],     // 今日餐单全部条目
    myItems: [],      // 我点的（还没上桌）
    taItems: [],      // TA 点的（还没上桌）
    servedItems: [],  // 已上桌

    totalPrice: 0,
    openid: '',

    slideButtons: [
      {extClass: 'useBtn', text: '上桌', src: "Images/icon_use.svg"},
      {extClass: 'starBtn', text: '星标', src: "Images/icon_star.svg"},
      {extClass: 'removeBtn', text: '删除', src: 'Images/icon_del.svg'}
    ],
  },

  // 页面加载时运行
  async onShow() {
    await app.ready()
    this.setData({
      statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
      openid: app.globalData.openid,
    })

    const res = await wx.cloud.callFunction({
      name: 'getList',
      data: { list: app.globalData.collectionCartList }
    })
    this.setData({ allItems: res.result.data || [] })
    this.filterItem()
  },

  // 转到条目详情
  toDetailPage(element, which) {
    const index = element.currentTarget.dataset.index
    let item
    if (which === 'my') item = this.data.myItems[index]
    else if (which === 'ta') item = this.data.taItems[index]
    else item = this.data.servedItems[index]
    wx.navigateTo({ url: '../OrderDetail/index?id=' + item._id })
  },
  toDetailPageMy(e) { this.toDetailPage(e, 'my') },
  toDetailPageTa(e) { this.toDetailPage(e, 'ta') },
  toDetailPageServed(e) { this.toDetailPage(e, 'served') },

  // 设置搜索
  onSearch(element) {
    this.setData({ search: element.detail.value })
    this.filterItem()
  },

  // 划分为：我点的 / TA点的 / 已上桌
  filterItem() {
    let list = this.data.allItems
    if (this.data.search) {
      list = list.filter(item => (item.title || '').indexOf(this.data.search) !== -1)
    }

    const pending = list.filter(item => item.available !== false)
    const served = list.filter(item => item.available === false)

    const total = pending.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.count || 1)), 0)

    this.setData({
      myItems: pending.filter(item => item._openid === this.data.openid),
      taItems: pending.filter(item => item._openid !== this.data.openid),
      servedItems: served,
      totalPrice: Math.round(total * 100) / 100,
    })
  },

  // 响应左划按钮事件
  slideButtonTapMy(e) { this.slideButtonTap(e, 'my') },
  slideButtonTapTa(e) { this.slideButtonTap(e, 'ta') },
  slideButtonTapServed(e) { this.slideButtonTap(e, 'served') },

  async slideButtonTap(element, which) {
    const { index } = element.detail
    const itemIndex = element.currentTarget.dataset.index
    let bucket = which === 'my' ? this.data.myItems : (which === 'ta' ? this.data.taItems : this.data.servedItems)
    const item = bucket[itemIndex]
    if (!item) return

    // 标记上桌
    if (index === 0) {
      if (which === 'served') {
        return wx.showToast({ title: '这道菜已经上过桌了', icon: 'none', duration: 2000 })
      }
      return this.serveItem(item)
    }

    // 星标与删除只能操作自己点的
    if (item._openid !== this.data.openid) {
      return wx.showToast({ title: '只能编辑自己点的菜', icon: 'none', duration: 2000 })
    }

    if (index === 1) {
      wx.cloud.callFunction({
        name: 'editStar',
        data: { _id: item._id, list: app.globalData.collectionCartList, value: !item.star }
      })
      item.star = !item.star
    } else if (index === 2) {
      wx.cloud.callFunction({
        name: 'deleteElement',
        data: { _id: item._id, list: app.globalData.collectionCartList }
      })
      // 同步本地数据后再重新分组，避免刷新时又被拉回来
      this.setData({ allItems: this.data.allItems.filter(i => i._id !== item._id) })
      this.filterItem()
      return
    }

    this.setData({
      myItems: this.data.myItems,
      taItems: this.data.taItems,
      servedItems: this.data.servedItems,
    })
  },

  // 标记上桌
  async serveItem(item) {
    await wx.cloud.callFunction({
      name: 'editAvailable',
      data: { _id: item._id, value: false, list: app.globalData.collectionCartList }
    })

    // 同步更新菜品库的「最近一次吃」
    if (item.dishId) {
      wx.cloud.callFunction({
        name: 'editNumber',
        data: {
          list: app.globalData.collectionDishList,
          _id: item.dishId,
          field: 'eatCount',
          value: 0,
          extra: { lastEatDate: new Date().toISOString() }
        }
      })
    }

    item.available = false
    wx.showToast({ title: '已上桌，开动吧！', icon: 'success', duration: 2000 })
    this.filterItem()
  },
})
