// 这是模板文件，请复制一份命名为 envList.js，再填入你自己的云环境 ID
//
// 获取方式：微信开发者工具 → 云开发 → 设置 → 环境 ID
// 注意：这个环境必须属于 project.config.json 里的 appid，否则会报 "Env Not Exists"
//
// envList.js 已写进 .gitignore，不会提交到仓库 —— 换环境 ID 时改那个文件即可

const envList = [{ "envId": "你的环境ID", "alias": "cloud" }]

module.exports = {
    envList,
}
