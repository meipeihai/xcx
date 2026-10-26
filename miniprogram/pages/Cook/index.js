const app = getApp()

// 星级提示语 / 餐次中文
const RATE_HINT = ['', '不太行', '还行吧', '还不错', '很好吃', '绝了！']
const MEAL = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', night: '夜宵' }

Page({
  data: {
    allList: [],
    todoList: [],   // 待完成
    doneList: [],   // 已完成
    showList: [],

    total: 0,
    todoCount: 0,
    doneCount: 0,
    tabIndex: 0,

    // 评价弹层
    starList: [1, 2, 3, 4, 5],
    ratingId: '',
    ratingTitle: '',
    ratingScore: 0,
    ratingComment: '',
    ratingHint: '',
  },

  async onShow() {
    await app.ready()
    this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight })
    await this.loadRecords()
  },

  // 拉取点菜记录（CartList），按点菜时间倒序
  async loadRecords() {
    const res = await wx.cloud.callFunction({
      name: 'getList',
      data: { list: app.globalData.collectionCartList }
    })

    const me = app.globalData.openid
    const all = (res.result.data || []).slice()
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map(item => {
        const rating = Number(item.rating || 0)
        return Object.assign({}, item, {
          who: app.nickNameOf(item._openid),
          isMine: item._openid === me,
          done: item.available === false,
          dateText: this.formatDate(item.date),
          mealText: MEAL[item.mealType] || '',
          stars: '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating),
        })
      })

    const todo = all.filter(r => !r.done)
    const done = all.filter(r => r.done)

    this.setData({
      allList: all,
      todoList: todo,
      doneList: done,
      total: all.length,
      todoCount: todo.length,
      doneCount: done.length,
    })
    this.applyFilter()
  },

  applyFilter() {
    const t = this.data.tabIndex
    const list = t === 1 ? this.data.todoList : (t === 2 ? this.data.doneList : this.data.allList)
    this.setData({ showList: list })
  },

  onTabTap(e) {
    this.setData({ tabIndex: Number(e.currentTarget.dataset.index) })
    this.applyFilter()
  },

  // 标记为已完成
  async finishItem(e) {
    const id = e.currentTarget.dataset.id
    await wx.cloud.callFunction({
      name: 'editAvailable',
      data: { _id: id, value: false, list: app.globalData.collectionCartList }
    })
    wx.showToast({ title: '已完成 ✅', icon: 'success', duration: 1500 })
    await this.loadRecords()
  },

  // 删除一条记录
  async removeItem(e) {
    const id = e.currentTarget.dataset.id
    const ok = await new Promise(resolve => {
      wx.showModal({
        title: '删除这条记录',
        content: '删掉就找不回来了哦',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!ok) return

    await wx.cloud.callFunction({
      name: 'deleteElement',
      data: { _id: id, list: app.globalData.collectionCartList }
    })
    await this.loadRecords()
    wx.showToast({ title: '已删除', icon: 'none', duration: 1200 })
  },

  // ---------- 评价打分（点菜人可写） ----------
  openRating(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.allList.find(r => r._id === id)
    if (!item) return
    this.setData({
      ratingId: id,
      ratingTitle: item.title,
      ratingScore: Number(item.rating || 0),
      ratingComment: item.comment || '',
      ratingHint: RATE_HINT[Number(item.rating || 0)] || '',
    })
  },

  pickScore(e) {
    const score = Number(e.currentTarget.dataset.score)
    // 再点一次当前星级 = 取消
    const next = score === this.data.ratingScore ? 0 : score
    this.setData({ ratingScore: next, ratingHint: RATE_HINT[next] || '' })
  },

  onCommentInput(e) {
    this.setData({ ratingComment: e.detail.value })
  },

  closeRating() {
    this.setData({ ratingId: '', ratingScore: 0, ratingComment: '', ratingHint: '' })
  },

  stopPop() {},

  async submitRating() {
    if (!this.data.ratingScore) {
      return wx.showToast({ title: '先选个星级吧', icon: 'none', duration: 1500 })
    }
    await wx.cloud.callFunction({
      name: 'editNumber',
      data: {
        list: app.globalData.collectionCartList,
        _id: this.data.ratingId,
        field: 'eatCount',
        value: 0,   // 0 = 只写 extra，不动数值字段
        extra: {
          rating: this.data.ratingScore,
          comment: (this.data.ratingComment || '').trim(),
          ratedBy: app.globalData.openid,
        },
      }
    })
    this.closeRating()
    await this.loadRecords()
    wx.showToast({ title: '评价已保存', icon: 'success', duration: 1500 })
  },

  formatDate(d) {
    if (!d) return ''
    const date = new Date(d)
    if (isNaN(date.getTime())) return String(d).slice(0, 10)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
  },
})
