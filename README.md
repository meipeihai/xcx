# 云开发情侣点菜小程序

两个人共建一份菜单，每天决定吃什么、谁点的、吃完了互相打分。

基于微信云开发：**云数据库**存数据、**云函数**跑逻辑、**云存储**放菜品图。

## 用起来是这样的

1. **共建菜单** → 两人都能加菜（菜名、做法、分类、口味标签、参考价格、菜品图）
2. **点菜** → 在菜单页点卡片上的「＋」，菜进入「今日餐单」，可改份数和备注（少辣 / 不要香菜）
3. **决定吃什么** → 首页「帮我抽一个」随机摇一道，也可以从常吃榜单里挑
4. **上桌** → 餐单里左滑「上桌」，菜移到「已上桌」
5. **打分** → 在「点菜记录」里给吃过的菜打星、写评价

## 页面

四个 tab：

| Tab | 目录 | 作用 |
|---|---|---|
| 今天吃啥 | `pages/MainPage` | 「帮我抽一个」、常吃榜单（奖牌 + 热度条）、三个快捷入口 |
| 菜单 | `pages/Dish` | 左侧分类栏 + 菜品列表、搜索、**分类管理**、右下角可拖拽的加菜按钮 |
| 点菜记录 | `pages/Cook` | 历史记录（待完成 / 已完成）、打星 + 写评价 |
| 今日餐单 | `pages/Cart` | 按「我点的 / TA 点的 / 已上桌」分组，显示份数、备注、今日合计 |

不在 tab 里的子页面：

| 目录 | 作用 |
|---|---|
| `pages/DishAdd` | 加菜 / 编辑菜（内置 12 道预设菜，一键填充） |
| `pages/DishDetail` | 菜品详情（做法、价格、人气、上下架） |
| `pages/OrderDetail` | 餐单条目详情（改份数、写备注） |

## 分类管理

菜单页左侧分类栏底部有个「⚙️ 管理」，点开可以**对菜品种类增删改**：

| 操作 | 怎么用 | 说明 |
|---|---|---|
| 增 | 底部「＋ 新增分类」 | 自动配一个图标，重名会拦下来 |
| 改 | ✏️ 改名 / 点图标换 emoji | 改名后**该分类下的菜会一起搬过去**，不会让菜留在旧分类里找不着 |
| 删 | 🗑 | 会提示底下有几道菜，删除后这些菜移到「未分类」 |

分类存在云端 `CategoryList` 集合，**两个人共用同一份**（你改了，对方手机上也变）。
第一次打开会自动写入 8 个默认分类：主食 / 荤菜 / 素菜 / 汤羹 / 甜品 / 饮品 / 小吃 / 外卖。

## 数据

需要手动建的只有 3 个集合：

| 集合 | 用途 |
|---|---|
| `DishList` | 菜品 |
| `CartList` | 今日餐单 + 点菜记录（同一份数据） |
| `UserList` | 用户资料（A / B 两个人的称呼） |
| `CategoryList` | 菜品分类 —— **不用手动建**，首次打开自动创建并写入默认分类 |

字段：

```
DishList   菜品
  title         菜名
  desc          做法 / 备注
  price         参考价格（元）
  category      分类（来自 CategoryList）
  tags[]        口味标签：辣 / 清淡 / 下饭 / 快手 / 减脂 ...
  ingredients[] 食材（预设菜自带）
  imageFileID   云存储图片 fileID
  eatCount      被点次数
  lastEatDate   最近一次吃
  available     true = 在菜单，false = 不爱吃了
  star          星标

CartList   今日餐单 / 点菜记录
  dishId        关联菜品 _id
  title / price / imageFileID   冗余的菜品信息（改菜名后餐单不受影响）
  count         份数
  remark        备注（少辣 / 不要香菜）
  mealType      餐次：breakfast / lunch / dinner / night
  available     true = 还没上桌，false = 已上桌
  rating        评分 1-5（在「点菜记录」里打）
  comment       评价

UserList   用户资料
  openid        微信 openid（自动写入）
  nickname      称呼（首页点名字可改）

CategoryList   菜品分类
  name          分类名
  icon          图标 emoji
  sort          排序（越小越靠前）
```

## 部署方式

1. 注册小程序账号：https://mp.weixin.qq.com/cgi-bin/wx
2. 登录后下载 **微信开发者工具**，导入本项目文件夹
   - 导入前先生成项目配置：把 `project.config.example.json` **复制一份**命名为 `project.config.json`，再把里面的 `appid` 换成你自己的（微信公众平台 → 开发管理 → 开发设置 里可查）
3. 工具栏「云开发」→ 开通环境（有免费额度），复制**环境 ID**
4. 生成环境配置文件，填入你的环境 ID：

   把 `miniprogram/envList.example.js` **复制一份**，命名为 `miniprogram/envList.js`，再把里面的 `envId` 换成你的：

```js
const envList = [{ envId: '你的环境ID', alias: 'cloud' }]
module.exports = { envList }
```

> `envList.js` 和 `project.config.json` 都写进了 `.gitignore`，**不会被提交**——云环境 ID 和 appid 都不会进仓库。
> 同理，`project.private.config.json`（开发者工具的私人配置，含本地路径和个人编译设置）也在忽略列表里。

5. 云开发控制台 → 数据库，新建 3 个集合（权限都设为「所有用户可读，仅创建者可写」）：

```
DishList
CartList
UserList
```

> `CategoryList` 不用建，代码第一次打开会自动创建并写入 8 个默认分类。
>
> 从很早的版本升级上来的，建议**清空旧数据**，字段结构已变更（旧的 `MissionList` / `MarketList` / `StorageList` / `CookList` 都不再使用）。

6. 右键 `cloudfunctions` 下的文件夹 →「上传并部署：云端安装依赖」。

   实际会用到的 8 个：`addElement`、`deleteElement`、`editAvailable`、`editNumber`、`editStar`、`getElementById`、`getList`、`getOpenId`

   > `editCredit` / `getElementByOpenId` / `information` 是早期版本留下的，前端已经不调用，**不部署也不影响**。

7. **两个人各自打开一次小程序**，会自动在 `UserList` 开户（先注册的是 A，后注册的是 B）。
8. 改你俩的称呼，打开 `miniprogram/app.js`：

```js
userA: '宝贝A',
userB: '宝贝B',
```

> 也可以直接在首页点名字改，改完存在云端，对方那边也同步。

9. 右上角「上传」→ 小程序后台设为体验版，即可分享给对方。

## 云函数

| 云函数 | 作用 |
|---|---|
| `getOpenId` | 取当前用户 openid |
| `getList` | 读集合，支持排序与分页（已修掉超过 100 条静默丢数据的问题） |
| `getElementById` | 按 `_id` 取单条 |
| `addElement` | 新增，通用字段透传；**集合不存在时会自动创建** |
| `editNumber` | 通用字段自增；带 `extra` 时可覆盖任意字段（分类改名、批量搬菜都靠它） |
| `editAvailable` | 改上下架 / 上桌状态 |
| `editStar` | 改星标 |
| `deleteElement` | 删除 |

## 界面

- **沉浸式渐变背景**：粉色从屏幕最顶端（含状态栏）铺下来往下渐隐。渐变用 `background-size: 100% 100vh` 锁在首屏，页面再长也不会被拉花
- **配色**：统一写在 `miniprogram/app.wxss` 的 CSS 变量里（主色 `--primary`、文字层级 `--text-1/2/3`、圆角 `--radius`、阴影 `--shadow`）
- **字号**：9 档阶梯，全站只用变量，不再有 23rpx / 25rpx 这种随手值

```css
--fs-2xs: 22rpx;  --fs-xs:  24rpx;  --fs-sm:  26rpx;
--fs-base: 28rpx; --fs-md:  30rpx;  --fs-lg:  34rpx;
--fs-xl:  40rpx;  --fs-2xl: 44rpx;  --fs-num: 52rpx;
```

> 750rpx 设计宽，28rpx ≈ 14px。四页主标题 52rpx、副标题 26rpx、菜名 30rpx、辅助 22-24rpx。
> 想整体调大或调小，改这几行就行，全站跟着变。

## 与原项目的差异

- **分类改为云端存储**（`CategoryList`），菜单页可增删改，两人共用；原来是写死在 `app.js` 里的数组
- 页面重命名：`Market → Dish`、`Mission → Cook`、`Account → Cart`、`ItemDetail → OrderDetail`
- 去掉硬编码的 `_openidA` / `_openidB`，改为**首次进入自动开户**，按注册顺序识别 A / B
- `addElement` 改为通用字段透传，不再写死 `credit/title/desc`
- `getList` 修复超过 100 条静默丢数据，支持分页与排序
- 新增 `editNumber`（通用自增 + `extra` 覆盖任意字段）
- 新增菜品图片云存储上传
- UI 重做：沉浸式渐变背景、统一配色与字号阶梯、卡片化布局、按压反馈
- **已移除**：下厨任务与积分体系（`CookList`）、订阅消息推送（相关云函数保留但前端不再调用）

## 声明

小程序内所有图片均来自网络，此项目非商用，侵删。
