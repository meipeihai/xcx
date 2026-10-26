const app = getApp()

Page({
  data: {
    _id: '',
    order: null,
    dateStr: '',
    timeStr: '',
    owner: '',
    list: app.globalData.collectionCartList,
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

  async onShow() {
    await app.ready()
    if (!this.data._id) return

    const res = await wx.cloud.callFunction({
      name: 'getElementById',
      data: { list: this.data.list, _id: this.data._id }
    })
    const order = res.result.data[0]
    if (!order) return

    this.setData({
      order,
      dateStr: this.getDate(order.date).toDateString(),
      timeStr: this.getDate(order.date).toTimeString(),
      owner: app.nickNameOf(order._openid),
    })
  },

  // 加减份数（份数限制在 1~20，到边界时不再请求云端，避免云端与本地不一致）
  async changeCount(delta) {
    const order = this.data.order
    if (!order) return

    const cur = Number(order.count || 1)
    const next = Math.max(1, Math.min(20, cur + delta))
    if (next === cur) return

    await wx.cloud.callFunction({
      name: 'editNumber',
      data: { list: this.data.list, _id: order._id, field: 'count', value: delta }
    })
    order.count = next
    this.setData({ order })
  },
  addCount() { this.changeCount(1) },
  minusCount() { this.changeCount(-1) },

  // 修改备注（失焦时保存，避免每输入一个字都请求云端）
  onRemarkInput(e) {
    const remark = e.detail.value
    const order = this.data.order
    if (!order) return
    order.remark = remark
    this.setData({ order })
    wx.cloud.callFunction({
      name: 'editNumber',
      data: { list: this.data.list, _id: order._id, field: 'count', value: 0, extra: { remark } }
    })
  },
})
