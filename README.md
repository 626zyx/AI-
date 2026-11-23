# AI 演练场 Demo

在线演示：https://626zyx.github.io/AI-/

基于 AI 演练场 3.0 的可编辑前端 Demo，包含企业靶标接入、态势总览、模型与智能体演练、策略资源、报告明细和功能模型设置。

## 启动

Windows 安装 Python 3 后，双击 `启动服务.bat`，打开 http://127.0.0.1:8093/ 。

无需 npm 安装或构建；请通过 HTTP 服务打开，不能直接双击 `index.html`。

## 修改

```text
index.html       页面入口与样式清单
src/main.js      页面路由与应用装配
src/pages/       页面、表单与报告
src/styles/      页面样式
src/domain/      状态、规则与交互逻辑
src/core/        共享 UI、路由与工具
src/data/        演示数据和报告内容
src/vendor/      页面使用的内置依赖
```

本仓库仅保留 Demo 展示和修改所需文件。交互使用本地演示数据，无需接入真实企业平台或模型服务；刷新恢复初始状态。

## 发布

推送至 `main` 后，由 GitHub Pages 自动发布仓库根目录。
