const app = getApp()

Page({
  // 保存正在编辑的菜品
  data: {
    title: '',
    desc: '',

    price: 0,
    maxPrice: app.globalData.maxPrice,
    categoryIndex: 0,
    categories: app.globalData.categories,

    tagList: app.globalData.dishTags,
    tags: [],

    // 备菜：这道菜需要的配料
    ingredients: [],
    ingredientDraft: '',

    imageFileID: '',

    presetIndex: 0,
    presets: [{
      name: "无预设",
      title: "",
      desc: "",
      price: 0,
      category: "",
      tags: [],
      ingredients: [],
    }, {
      name: "番茄牛腩",
      title: "番茄牛腩",
      desc: "牛腩焯水去血沫，番茄炒出沙，下牛腩小火炖40分钟，收汁撒葱花。",
      price: 45, category: "荤菜", tags: ["下饭", "汤汁多"],
      ingredients: ["牛腩", "番茄", "姜", "葱", "料酒", "生抽"],
    }, {
      name: "可乐鸡翅",
      title: "可乐鸡翅",
      desc: "鸡翅两面煎至金黄，倒入可乐没过鸡翅，中火收汁至浓稠。",
      price: 28, category: "荤菜", tags: ["快手", "网红"],
      ingredients: ["鸡翅", "可乐", "姜", "生抽"],
    }, {
      name: "红烧肉",
      title: "红烧肉",
      desc: "五花肉切块煎出油，炒糖色后加生抽老抽料酒，小火炖1小时。",
      price: 48, category: "荤菜", tags: ["下饭", "有汤"],
      ingredients: ["五花肉", "冰糖", "生抽", "老抽", "料酒", "姜"],
    }, {
      name: "清蒸鲈鱼",
      title: "清蒸鲈鱼",
      desc: "鲈鱼改刀铺姜丝，水开上锅蒸8分钟，倒掉腥水淋蒸鱼豉油，泼热油。",
      price: 58, category: "荤菜", tags: ["清淡", "减脂"],
      ingredients: ["鲈鱼", "姜", "葱", "蒸鱼豉油"],
    }, {
      name: "蒜蓉西兰花",
      title: "蒜蓉西兰花",
      desc: "西兰花焯水30秒过凉，蒜蓉爆香后大火快炒，加盐出锅。",
      price: 16, category: "素菜", tags: ["清淡", "减脂", "快手"],
      ingredients: ["西兰花", "蒜", "盐"],
    }, {
      name: "酸辣土豆丝",
      title: "酸辣土豆丝",
      desc: "土豆切丝泡水去淀粉，干辣椒花椒爆香，大火快炒加醋。",
      price: 14, category: "素菜", tags: ["辣", "下饭"],
      ingredients: ["土豆", "干辣椒", "花椒", "醋"],
    }, {
      name: "番茄蛋汤",
      title: "番茄蛋汤",
      desc: "番茄炒软加水煮开，淋入蛋液搅散，加盐香油出锅。",
      price: 12, category: "汤羹", tags: ["清淡", "快手", "有汤"],
      ingredients: ["番茄", "鸡蛋", "香油", "盐"],
    }, {
      name: "蛋炒饭",
      title: "蛋炒饭",
      desc: "隔夜饭抓散，蛋液炒至半凝固下饭，大火快炒加葱花。",
      price: 15, category: "主食", tags: ["快手"],
      ingredients: ["米饭", "鸡蛋", "葱", "盐"],
    }, {
      name: "阳春面",
      title: "阳春面",
      desc: "面条煮熟过凉，高汤加生抽猪油，撒葱花即成。",
      price: 18, category: "主食", tags: ["清淡", "快手", "有汤"],
      ingredients: ["面条", "高汤", "生抽", "猪油", "葱"],
    }, {
      name: "杨枝甘露",
      title: "杨枝甘露",
      desc: "芒果打泥，加西柚粒、西米和椰浆，冷藏后风味更佳。",
      price: 22, category: "甜品", tags: ["凉菜", "网红"],
      ingredients: ["芒果", "西柚", "西米", "椰浆"],
    }, {
      name: "手打柠檬茶",
      title: "手打柠檬茶",
      desc: "香水柠檬捶打出汁，加绿茶汤和糖浆，摇匀加冰。",
      price: 16, category: "饮品", tags: ["凉菜", "网红"],
      ingredients: ["香水柠檬", "绿茶", "糖浆", "冰块"],
    }],
    list: app.globalData.collectionDishList,
  },

  // 每次进来都重取一次分类：菜单页刚增删改过的话，这里要跟上
  onShow() {
    const categories = app.globalData.categories || []
    this.setData({
      categories,
      // 分类被删少了，选中项可能越界
      categoryIndex: Math.min(this.data.categoryIndex, Math.max(0, categories.length - 1)),
    })
  },

  // ---------- 表单输入 ----------
  onTitleInput(e) { this.setData({ title: e.detail.value }) },
  onDescInput(e) { this.setData({ desc: e.detail.value }) },
  onPriceInput(e) { this.setData({ price: e.detail.value }) },

  onPresetChange(e) {
    const p = this.data.presets[e.detail.value]
    this.setData({
      presetIndex: e.detail.value,
      title: p.title,
      desc: p.desc,
      price: p.price || 0,
      categoryIndex: p.category ? Math.max(0, this.data.categories.indexOf(p.category)) : 0,
      tags: p.tags || [],
      ingredients: p.ingredients || [],
      ingredientDraft: '',
    })
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  onTagChange(e) {
    this.setData({ tags: e.detail.value })
  },

  // ---------- 备菜：配料增删 ----------
  onIngredientInput(e) { this.setData({ ingredientDraft: e.detail.value }) },

  addIngredient() {
    const name = (this.data.ingredientDraft || '').trim()
    if (!name) {
      return wx.showToast({ title: '先写个配料名', icon: 'none', duration: 1200 })
    }
    if (this.data.ingredients.indexOf(name) !== -1) {
      return wx.showToast({ title: '这个已经加过啦', icon: 'none', duration: 1200 })
    }
    this.setData({
      ingredients: this.data.ingredients.concat(name),
      ingredientDraft: '',
    })
  },

  removeIngredient(e) {
    const name = e.currentTarget.dataset.name
    this.setData({ ingredients: this.data.ingredients.filter(i => i !== name) })
  },

  // ---------- 上传菜品图到云存储 ----------
  async chooseImage() {
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] })
      wx.showLoading({ title: '上传中...' })
      const up = await wx.cloud.uploadFile({
        cloudPath: `dishes/${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
        filePath: res.tempFiles[0].tempFilePath
      })
      this.setData({ imageFileID: up.fileID })
      wx.hideLoading()
      wx.showToast({ title: '图片已上传', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '已取消上传', icon: 'none' })
    }
  },

  removeImage() {
    this.setData({ imageFileID: '' })
  },

  // ---------- 保存菜品 ----------
  async saveDish() {
    if (!this.data.title) {
      return wx.showToast({ title: '菜名未填写', icon: 'error', duration: 2000 })
    }
    if (this.data.title.length > 12) {
      return wx.showToast({ title: '菜名过长', icon: 'error', duration: 2000 })
    }
    if (this.data.desc.length > 100) {
      return wx.showToast({ title: '做法描述过长', icon: 'error', duration: 2000 })
    }

    wx.showLoading({ title: '保存中...' })
    await wx.cloud.callFunction({
      name: 'addElement',
      data: {
        list: app.globalData.collectionDishList,
        title: this.data.title,
        desc: this.data.desc,
        price: Number(this.data.price) || 0,
        category: this.data.categories[this.data.categoryIndex],
        tags: this.data.tags,
        ingredients: this.data.ingredients.map(name => ({ name, got: false })),
        imageFileID: this.data.imageFileID,
        eatCount: 0,
        available: true,
      }
    })
    wx.hideLoading()

    wx.showToast({ title: '菜品已上架', icon: 'success', duration: 1000 })
    setTimeout(() => wx.navigateBack(), 1000)
  },

  // 重置所有表单项
  resetDish() {
    this.setData({
      title: '',
      desc: '',
      price: 0,
      categoryIndex: 0,
      tags: [],
      ingredients: [],
      ingredientDraft: '',
      imageFileID: '',
      presetIndex: 0,
      list: app.globalData.collectionDishList,
    })
  }
})
