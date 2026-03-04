// @ts-ignore - katex is available in parent workspace
import katex from 'katex'
import { Context } from 'koishi'

interface Config {
  width?: number
  backgroundColor?: string
  textColor?: string
}

/**
 * 检测是否为 LaTeX 公式（增强版）
 */
export function containsLatex(content: string): boolean {
  // 匹配各种 LaTeX 格式
  return /\$\$/ .test(content) || /\\begin\{/.test(content) || /\\\[[\s\S]*?\\\]/.test(content) || /\\\([\s\S]*?\\\)/.test(content) || /\$[^\$\n]/.test(content)
}

/**
 * 解码 HTML 实体
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * 解析消息文本，提取 LaTeX 公式和普通文本
 */
function parseMessage(content: string): Array<{ type: 'text' | 'latex'; content: string; display?: boolean }> {
  content = decodeHtmlEntities(content)

  const result: Array<{ type: 'text' | 'latex'; content: string; display?: boolean }> = []

  // 增强的正则：支持更多格式
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:[^\$\n]|\$(?!\$)|[\s\S])*?\$|\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g

  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) {
        result.push({ type: 'text', content: text })
      }
    }

    const latex = match[1]
    let isDisplay = false
    let formula = latex

    if (latex.startsWith('$$') && latex.endsWith('$$')) {
      isDisplay = true
      formula = latex.slice(2, -2).trim()
    } else if (latex.startsWith('\\[') && latex.endsWith('\\]')) {
      isDisplay = true
      formula = latex.slice(2, -2).trim()
    } else if (latex.startsWith('\\(') && latex.endsWith('\\)')) {
      formula = latex.slice(2, -2).trim()
    } else if (latex.startsWith('$') && latex.endsWith('$')) {
      formula = latex.slice(1, -1).trim()
    } else if (latex.startsWith('\\begin')) {
      isDisplay = true
    }

    result.push({
      type: 'latex',
      content: formula,
      display: isDisplay,
    })

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      result.push({ type: 'text', content: text })
    }
  }

  return result
}

/**
 * 简化的 KaTeX 基础样式（回退用）
 */
const fallbackStyles = `
.katex { font: normal 1.1em "KaTeX_Main", "Times New Roman", serif; line-height: 1.2; }
.katex-display { display: block; margin: 1em 0; text-align: center; }
.katex-display > .katex { display: block; text-align: center; }
.katex .mord { color: inherit; }
.katex .base { display: inline-block; }
.katex .strut { display: inline-block; }
.katex .mrel { margin-left: 0.2em; margin-right: 0.2em; }
.katex .mbin { margin-left: 0.2em; margin-right: 0.2em; }
.katex .mopen, .katex .mclose { margin-left: 0.1em; margin-right: 0.1em; }
`

/**
 * 生成 HTML（使用 KaTeX 渲染公式）
 * 使用 CDN 加载 KaTeX CSS，设置更长超时
 */
function generateHtml(
  parsed: Array<{ type: 'text' | 'latex'; content: string; display?: boolean }>,
  config: Config
): string {
  const textColor = config.textColor || '#333333'
  const bgColor = config.backgroundColor || '#ffffff'
  const width = config.width || 800

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      font-size: 16px;
      line-height: 1.8;
      color: ${textColor};
      background-color: ${bgColor};
      padding: 24px;
      width: ${width}px;
      min-height: 100px;
    }
    .content {
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .latex-display {
      margin: 12px 0;
      text-align: center;
      overflow-x: auto;
    }
    .latex-inline {
      margin: 0 2px;
    }
    .text-line {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="content">`

  for (const item of parsed) {
    if (item.type === 'text') {
      // 处理普通文本
      const escaped = item.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      html += `<span class="text-line">${escaped}</span>`
    } else {
      // 处理 LaTeX 公式
      try {
        const htmlContent = katex.renderToString(item.content, {
          throwOnError: false,
          displayMode: item.display || false,
          trust: true,
          strict: false,
        })
        const className = item.display ? 'latex-display' : 'latex-inline'
        html += `<span class="${className}">${htmlContent}</span>`
      } catch (e) {
        // 渲染失败时显示原文
        html += `<span class="latex-display"><code>${item.content}</code></span>`
      }
    }
  }

  html += `</div></body></html>`
  return html
}

/**
 * 计算预估高度
 */
function estimateHeight(parsed: Array<{ type: 'text' | 'latex'; content: string }>): number {
  let charCount = 0
  for (const item of parsed) {
    if (item.type === 'text') {
      charCount += item.content.length
    } else {
      charCount += item.content.length * 1.5
    }
  }
  const lines = Math.ceil(charCount / 35)
  return Math.max(100, lines * 24 + 48)
}

/**
 * 主渲染函数 - 使用 Puppeteer + KaTeX
 */
export async function renderLatex(
  ctx: Context,
  content: string,
  config: Config
): Promise<string> {
  console.log('[latex-render] 开始渲染...')

  // 解析消息
  let parsed: Array<{ type: 'text' | 'latex'; content: string; display?: boolean }>
  try {
    parsed = parseMessage(content)
    console.log('[latex-render] 解析完成，共', parsed.length, '个片段')
  } catch (error) {
    console.error('[latex-render] 解析消息失败:', error)
    throw new Error(`消息解析失败: ${error}`)
  }

  if (parsed.length === 0) {
    throw new Error('No content to render')
  }

  const width = config.width || 800
  const height = estimateHeight(parsed)

  // 生成 HTML
  let html: string
  try {
    html = generateHtml(parsed, config)
    console.log('[latex-render] HTML 生成完成，长度:', html.length)
  } catch (error) {
    console.error('[latex-render] HTML 生成失败:', error)
    throw new Error(`HTML 生成失败: ${error}`)
  }

  // Puppeteer 截图
  let page = null
  try {
    // 获取 Puppeteer 页面
    page = await (ctx as any).puppeteer.page()
    console.log('[latex-render] Puppeteer 页面获取成功')

    // 设置 HTML 内容 - 使用 networkidle2 允许 CSS 加载
    await page.setContent(html, {
      waitUntil: 'networkidle2',
      timeout: 30000,  // 30秒超时等待 CSS
    })
    console.log('[latex-render] HTML 内容设置完成')

    // 等待一小段时间确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 500))

    // 获取内容实际高度
    const actualHeight = await page.evaluate(() => {
      const body = document.body
      return body ? body.scrollHeight : 0
    }).catch((e) => {
      console.warn('[latex-render] 获取高度失败，使用预估高度:', e)
      return height
    })

    const finalHeight = Math.max(actualHeight + 20, height)
    console.log('[latex-render] 实际高度:', finalHeight)

    // 截图
    const buffer = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        width: width,
        height: finalHeight
      },
      type: 'png'
    })
    console.log('[latex-render] 截图完成，buffer 长度:', buffer.length)

    // 关闭页面
    await page.close().catch(() => {})
    page = null

    // 上传图片 - 使用 data URL
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`
    const url = await (ctx as any).assets.upload(dataUrl, 'latex-render.png')
    console.log('[latex-render] 图片上传完成，URL:', url)

    return url
  } catch (error: any) {
    console.error('[latex-render] Puppeteer 渲染失败:', error?.message || error)
    console.error('[latex-render] 错误详情:', error?.stack || '无堆栈信息')

    // 确保关闭页面
    if (page) {
      try {
        await page.close()
      } catch (e) {
        // 忽略关闭错误
      }
    }

    // 抛出具体错误
    throw new Error(`LaTeX 渲染失败: ${error?.message || error}`)
  }
}
