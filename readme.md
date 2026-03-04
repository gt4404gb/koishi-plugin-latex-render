# koishi-plugin-latex-render

[![npm](https://img.shields.io/npm/v/koishi-plugin-latex-render?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-latex-render)

## 简介

**本插件专为 [ChatLuna](https://github.com/ChatLunaLab/chatluna) 设计**，用于将 AI 返回的 LaTeX 公式渲染为图片并发送。

当 ChatLuna 的 AI 返回包含 LaTeX 公式的消息时，本插件会自动：
1. 拦截消息
2. 使用 KaTeX 解析并渲染公式
3. 使用 Puppeteer 截图生成图片
4. 将图片发送给用户

## 特性

- **整条消息渲染为一张图片** - 不是每个公式单独一张
- **支持多种 LaTeX 格式** - `$$...$$`, `\[...\]`, `\(...\)`, `$...$`, `\begin{}...\end{}`
- **中文支持** - 使用微软雅黑字体
- **可自定义样式** - 支持配置背景色、文字颜色、图片宽度

## 依赖

本插件依赖以下 Koishi 插件：
- `koishi-plugin-puppeteer` - 用于浏览器截图
- `koishi-plugin-assets-local` - 用于图片上传托管（可选）

## 安装

```bash
# 使用 yarn
yarn add koishi-plugin-latex-render

# 或使用 npm
npm install koishi-plugin-latex-render
```

## 配置

在 `koishi.yml` 中配置插件：

```yaml
latex-render:
  width: 800          # 图片宽度，默认 800
  backgroundColor: "#ffffff"  # 背景色，默认白色
  textColor: "#333333"        # 文字颜色，默认深灰色

# 必须启用 puppeteer 插件
puppeteer: {}

# 建议配置 assets-local 的 selfUrl
assets-local:5fyoiw:
  selfUrl: http://127.0.0.1:5140
```

## 工作原理

1. 监听 `chatluna/after-chat` 事件
2. 检测消息中是否包含 LaTeX 公式
3. 使用 KaTeX 将公式渲染为 HTML
4. 使用 Puppeteer 打开 HTML 并截图
5. 通过 assets 服务上传图片
6. 发送图片消息给用户

## 支持的 LaTeX 格式

| 格式 | 示例 | 类型 |
|------|------|------|
| 行内公式 | `$x^2$` | inline |
| 行内公式 | `\(x^2\)` | inline |
| 块级公式 | `$$x^2$$` | display |
| 块级公式 | `\[x^2\]` | display |
| 环境 | `\begin{cases}...\end{cases}` | display |

## 注意事项

- **本插件极度特化于 ChatLuna** - 仅监听 ChatLuna 的消息事件
- 需要网络访问 `cdn.jsdelivr.net` 加载 KaTeX CSS
- Puppeteer 插件必须在插件列表中启用

## 开发

```bash
# 构建
yarn build

# 或在项目根目录
npm run build latex-render
```

## License

MIT
