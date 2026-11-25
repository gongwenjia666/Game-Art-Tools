// 逐环 × 逐象限定位丢失区域
const fs=require("fs");
let src=fs.readFileSync("_t2.js","utf8");
// 只执行到 evalOpt 定义为止的公共部分：重写一个精简脚本
