const app = getApp()

Page({
  data: {
    _id: '',
    dish: null,
    dateStr: '',
    timeStr: '',
    pricePercent: 0,
    owner: '',
    maxPrice: app.globalData.maxPrice,
    list: app.globalData.collectionDishList,

    // 备菜：一份配料清单，got=true 表示已买到
    ingredients: [],   // [{ name, got }]
    gotList: [],
    buyList: [],
    ingredientDraft: '',
  },

  onLoad(options) {
    if (options.id !== undefined) {
      this.setData({ _id: options.id })
    }
  },

  getDate(dateStr) {
    const date = new Date()
    date.setTime(Date.parse(dateStr))
    return date
  },

  // 根据 _id 查询并显示菜品
  async onShow() {
    await app.ready()
    if (!this.data._id) return

    const res = await wx.cloud.callFunction({
      name: 'getElementById',
      data: { list: this.data.list, _id: this.data._id }
    })
    const dish = res.result.data[0]
    if (!dish) return

    this.setData({
      dish,
      dateStr: this.getDate(dish.date).toDateString(),
      timeStr: this.getDate(dish.date).toTimeString(),
      pricePercent: Math.min(100, (Number(dish.price || 0) / this.data.maxPrice) * 100),
      owner: app.nickNameOf(dish._openid),
    })

    // 兼容老数据：字符串数组 + prepared -> [{name, got}]
    const ingredients = this.normalizeIngredients(dish)
    this.setData({
      ingredients,
      gotList: ingredients.filter(i => i.got),
      buyList: ingredients.filter(i => !i.got),
      ingredientDraft: '',
    })
  },

  // ---------- 备菜：一份配料清单，增 / 删 / 改 / 切换已买 ----------
  // 老数据兼容：字符串数组 + prepared 数组 -> [{ name, got }]
  normalizeIngredients(dish) {
    const raw = dish.ingredients || []
    const prepared = dish.prepared || []
    return raw.map(item => {
      if (typeof item === 'string') {
        return { name: item, got: prepared.indexOf(item) !== -1 }
      }
      return { name: item.name, got: !!item.got }
    })
  },

  // 统一入口：更新本地 + 刷新两个分区 + 写云端
  async applyIngredients(ingredients) {
    this.setData({
      ingredients,
      gotList: ingredients.filter(i => i.got),
      buyList: ingredients.filter(i => !i.got),
    })
    await this.saveIngredients(ingredients)
  },

  // 点一下：已买 <-> 待买
  async toggleIngredient(e) {
    const name = e.currentTarget.dataset.name
    const next = this.data.ingredients.map(i =>
      i.name === name ? { name: i.name, got: !i.got } : i)
    await this.applyIngredients(next)
  },

  onIngredientInput(e) { this.setData({ ingredientDraft: e.detail.value }) },

  async addIngredient() {
    const name = (this.data.ingredientDraft || '').trim()
    if (!name) {
      return wx.showToast({ title: '先写个配料名', icon: 'none', duration: 1200 })
    }
    if (this.data.ingredients.some(i => i.name === name)) {
      return wx.showToast({ title: '这个已经加过啦', icon: 'none', duration: 1200 })
    }
    this.setData({ ingredientDraft: '' })
    await this.applyIngredients(this.data.ingredients.concat({ name, got: false }))
  },

  async removeIngredient(e) {
    const name = e.currentTarget.dataset.name
    await this.applyIngredients(this.data.ingredients.filter(i => i.name !== name))
  },

  // 长按改名
  renameIngredient(e) {
    const name = e.currentTarget.dataset.name
    wx.showModal({
      title: '改配料名',
      editable: true,
      placeholderText: name,
      content: name,
      success: (res) => {
        if (!res.confirm) return
        const val = (res.content || '').trim()
        if (!val || val === name) return
        if (this.data.ingredients.some(i => i.name === val)) {
          return wx.showToast({ title: '已经有同名的啦', icon: 'none', duration: 1200 })
        }
        const next = this.data.ingredients.map(i =>
          i.name === name ? { name: val, got: i.got } : i)
        this.applyIngredients(next)
      }
    })
  },

  // 下次重做这道菜时，把所有配料都放回"待买"
  async resetPrepared() {
    const next = this.data.ingredients.map(i => ({ name: i.name, got: false }))
    await this.applyIngredients(next)
    wx.showToast({ title: '已全部回到待买', icon: 'none', duration: 1200 })
  },

  // ingredients 是普通数组字段，借 editNumber 的 extra 透传写入
  saveIngredients(ingredients) {
    return wx.cloud.callFunction({
      name: 'editNumber',
      data: {
        list: this.data.list,
        _id: this.data._id,
        field: 'eatCount',
        value: 0,
        // prepared 是旧字段，一并清空，避免两份状态打架
        extra: { ingredients, prepared: [] },
      }
    })
  },
})
