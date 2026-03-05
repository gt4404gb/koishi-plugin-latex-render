// @ts-ignore - katex and marked are available in parent workspace
import katex from 'katex'
import 'katex/contrib/mhchem' // 引入化学方程式支持
import { marked } from 'marked'
import { Context } from 'koishi'
import * as fs from 'fs'
import * as path from 'path'

// 运行时读取内置 CSS（消除外部 CDN 依赖）
const katexCss = fs.readFileSync(path.join(__dirname, 'katex.css'), 'utf-8')

interface Config {
  width?: number
  backgroundColor?: string
  textColor?: string
  debug?: boolean
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

/**
 * 核心黑科技：智能包裹裸露的 LaTeX 公式
 */
function autoWrapLatex(text: string): string {
  const lines = text.split('\n')
  let inCodeBlock = false

  return lines.map(line => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      return line
    }
    if (inCodeBlock) return line

    const dollarCount = (line.match(/\$/g) || []).length
    if ((dollarCount >= 2 && dollarCount % 2 === 0) || line.includes('\\[') || line.includes('\\(') || line.includes('\\begin')) {
      // 修复 AI 畸形格式：$$\ce{...$$} -> $$\ce{...}$$，改用函数替换避免 $ 转义陷阱
      return line.replace(/\$\$(\\ce\{.+?)\$\$\}/g, (_, p1) => `$$${p1}$$`)
                 .replace(/\$(\\ce\{.+?)\$\}/g, (_, p1) => `$${p1}$`)
    }

    const latexPattern = /(\\[a-zA-Z]+|\^|_[0-9a-zA-Z\{])/
    if (!latexPattern.test(line)) return line

    let result = ''
    const chunks = line.split(/([\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]+)/)

    for (let chunk of chunks) {
      if (/[\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]/.test(chunk)) {
        result += chunk
      } else {
        if (chunk.includes('http') || chunk.includes('](')) {
          result += chunk
          continue
        }

        const trimmed = chunk.trim()
        if (trimmed.length > 0 && latexPattern.test(trimmed)) {
          const isEnglishSentence = /^[a-zA-Z0-9_\s\.,!?'"-]+$/.test(trimmed) &&
                                    trimmed.split(/\s+/).length > 3 &&
                                    !/(\\[a-zA-Z]+|[\+\-\=\/\<\>\*])/.test(trimmed)
          if (isEnglishSentence) {
            result += chunk
            continue
          }

          const leading = chunk.slice(0, chunk.indexOf(trimmed))
          const trailing = chunk.slice(chunk.indexOf(trimmed) + trimmed.length)

          const mathMatch = trimmed.match(/^([\s：:,，。;；\*\#`~]*)(.*?)([\s：:,，。;；\*\#`~]*)$/)
          const prefix = mathMatch ? mathMatch[1] : ''
          const coreMath = mathMatch ? mathMatch[2] : trimmed
          const suffix = mathMatch ? mathMatch[3] : ''

          // 废弃 isWholeLine 的强制 $$ 逻辑
          const listMatch = coreMath.match(/^((?:[-*+]|\d+\.)\s+)(.*)/)

          // 新增：判断是否本身就已经包裹了界定符
          const isAlreadyWrapped = coreMath.startsWith('$') || coreMath.startsWith('\\[') || coreMath.startsWith('\\(') || coreMath.startsWith('\\begin');

          if (listMatch) {
             // 列表项：保留前缀，包裹剩余部分，并防止内部有多余的 $
             result += `${leading}${prefix}${listMatch[1]}$${listMatch[2].replace(/^\$+|\$+$/g, '')}$${suffix}${trailing}`
          } else if (isAlreadyWrapped) {
             // 如果 AI 已经写了 $ 或者 \begin，直接放行，不二次套娃
             result += `${leading}${prefix}${coreMath}${suffix}${trailing}`
          } else {
             // 统一使用单 $ 包裹裸露公式
             result += `${leading}${prefix}$${coreMath}$${suffix}${trailing}`
          }
        } else {
          result += chunk
        }
      }
    }
    return result
  }).join('\n')
}

function containsMarkdown(content: string): boolean {
  return /^#{1,6}\s/m.test(content) || /\*\*[^*]+\*\*/.test(content) ||
    /\*[^*]+\*/.test(content) || /`[^`]+`/.test(content) ||
    /```[\s\S]+?```/.test(content) || /^\s*[-*+]\s/m.test(content) ||
    /^\s*\d+\.\s/m.test(content) || /^\s*>\s/m.test(content) || /\[.+?\]\(.+?\)/.test(content)
}

function parseMessage(content: string): Array<{ type: 'text' | 'latex'; content: string; display?: boolean }> {
  const result: Array<{ type: 'text' | 'latex'; content: string; display?: boolean }> = []
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^\$\n]+?\$|\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g

  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text) result.push({ type: 'text', content: text })
    }

    const latex = match[1]
    let isDisplay = false
    let formula = latex.trim()

    // 判断是否为块级公式
    if (formula.startsWith('$$') || formula.startsWith('\\[')) {
      isDisplay = true
    } else if (formula.startsWith('\\begin')) {
      isDisplay = true
    }

    // 🌟 终极护城河：无视 AI 的逆天套娃！
    // 1. 彻底去除两端所有合法的界定符（加上 \s* 兼容残留的换行和空格）
    formula = formula.replace(/^\s*\\\[|\s*\\\]$/g, '')
                     .replace(/^\s*\\\(|\s*\\\)$/g, '')
                     .replace(/^\s*\$\$|\s*\$\$$/g, '')
                     .replace(/^\s*\$|\s*\$$/g, '');

    // 2. 暴力清洗：移除内部所有未被反斜杠转义的 $ 符号！
    // 关键修复：防止 \begin 里的换行符 \\$ 被误判，先临时替换换行符 \\
    formula = formula.replace(/\\\\/g, '卐NEWLINE卍')
                     .replace(/(?<!\\)\$/g, '') // 安全地干掉所有裸露的 $
                     .replace(/卐NEWLINE卍/g, '\\\\')
                     .trim();

    result.push({ type: 'latex', content: formula, display: isDisplay })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text) result.push({ type: 'text', content: text })
  }
  return result
}

function processChineseInLatex(formula: string): string {
  return formula.replace(/(?<!\\text\{)([\u4e00-\u9fff]+)(?!\})/g, '\\text{$1}').replace(/\\_/g, '_')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function generateHtml(content: string, config: Config): string {
  const textColor = config.textColor || '#333333'
  const bgColor = config.backgroundColor || '#ffffff'
  const width = config.width || 800

  let decodedContent = decodeHtmlEntities(content)
  const wrappedContent = autoWrapLatex(decodedContent)
  const items = parseMessage(wrappedContent)

  const hasMarkdown = items.some(item => item.type === 'text' && containsMarkdown(item.content))
  let htmlContent: string

  const katexOptions: any = {
    throwOnError: false, // 保持不报错降级
    strict: false,
    output: 'html'      // 强制只输出 HTML 排版，绝不生成辅助阅读的 MathML
  }

  if (hasMarkdown) {
    const latexCache: { placeholder: string; html: string; isDisplay: boolean }[] = []
    let combinedMarkdown = ''
    let latexIndex = 0

    for (const item of items) {
      if (item.type === 'latex') {
        try {
          const processedContent = processChineseInLatex(item.content)
          const latexHtml = katex.renderToString(processedContent, { ...katexOptions, displayMode: item.display || false })

          const placeholder = `卐LATEX${latexIndex}卍`
          if (item.display) {
            // 块级公式：改用 div，并用换行符隔开，防止 marked 把它和文字粘连
            latexCache.push({ placeholder, html: `<div class="latex-display">${latexHtml}</div>`, isDisplay: true })
            combinedMarkdown += `\n\n${placeholder}\n\n`
          } else {
            // 行内公式：用 span
            latexCache.push({ placeholder, html: `<span class="latex-inline">${latexHtml}</span>`, isDisplay: false })
            combinedMarkdown += placeholder
          }
          latexIndex++
        } catch (e: any) {
          console.error(`[latex-render] 公式渲染降级: ${item.content}，原因: ${e.message}`)
          combinedMarkdown += `\`${item.content}\``
        }
      } else {
        combinedMarkdown += item.content
      }
    }

    htmlContent = marked.parse(combinedMarkdown, { async: false }) as string
    for (const { placeholder, html, isDisplay } of latexCache) {
      if (isDisplay) {
        // 🌟 神级剥离：清除 marked 自动生成的多余 p 标签，彻底消灭嵌套边距！
        htmlContent = htmlContent.replace(`<p>${placeholder}</p>`, html)
      }
      // 兜底替换
      htmlContent = htmlContent.replace(placeholder, html)
    }
  } else {
    const parts: string[] = []
    for (const item of items) {
      if (item.type === 'latex') {
        try {
          const processedContent = processChineseInLatex(item.content)
          const latexHtml = katex.renderToString(processedContent, { ...katexOptions, displayMode: item.display || false })
          // 纯文本下强制加上 block 样式
          const className = item.display ? 'latex-display block' : 'latex-inline'
          parts.push(`<span class="${className}">${latexHtml}</span>`)
        } catch (e: any) {
          console.error(`[latex-render] 公式渲染降级: ${item.content}，原因: ${e.message}`)
          parts.push(`<code>${escapeHtml(item.content)}</code>`)
        }
      } else {
        // 🌟 纯文本模式：用 <br> 替代 \n，彻底抛弃会引发灾难的 pre-wrap
        const textHtml = escapeHtml(item.content).replace(/\n/g, '<br>')
        parts.push(`<span class="text-line">${textHtml}</span>`)
      }
    }
    htmlContent = parts.join('')
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* KaTeX 内联样式（消除外部依赖） */
    ${katexCss}
    /* 🌟 彻底干掉辅助阅读的 MathML，防止重影 */
    .katex-mathml {
      display: none !important;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      font-size: 16px;
      line-height: 1.5; /* 稍微收紧基础行高 */
      color: ${textColor};
      background-color: ${bgColor};
      padding: 24px 30px;
      width: ${width}px;
    }
    .content {
      word-wrap: break-word;
      /* ！！！这里必须删掉之前加的 white-space: pre-wrap; ！！！ */
    }

    /* 严格控制基础段落间距 */
    .content p { margin: 6px 0; }
    .content p:empty { display: none; }

    /* 🌟 核心修复：干掉 KaTeX 默认自带的巨大上下 Margin (1em) */
    .katex-display { margin: 0 !important; }

    /* 将公式容器设为 block，并接管精确的间距 */
    .latex-display {
      display: block;
      margin: 10px 0; /* 这是真正的块级公式间距 */
      text-align: center;
      overflow-x: auto;
    }
    /* 兼容纯文本分支的 span */
    .latex-display.block { display: block; }

    .latex-inline { margin: 0 2px; }
    .text-line { margin: 2px 0; }

    /* 标题和列表排版优化，使其更紧凑 */
    .content h1, .content h2, .content h3, .content h4 { margin: 16px 0 8px 0; font-weight: 600; }
    .content ul, .content ol { margin: 6px 0; padding-left: 24px; }
    .content li { margin: 4px 0; }

    .content blockquote { margin: 8px 0; padding: 8px 16px; border-left: 4px solid #ddd; background-color: #f5f5f5; }
    .content code { background-color: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: "Consolas", monospace; font-size: 0.9em; }
    .content pre { background-color: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 10px 0; }
    .content pre code { background: none; padding: 0; }
    .content strong { font-weight: 600; }
    .content em { font-style: italic; }
    .content a { color: #0066cc; text-decoration: none; }
  </style>
</head>
<body>
  <div class="content">${htmlContent}</div>
</body>
</html>`
}

function estimateHeight(content: string): number {
  const lines = Math.ceil(content.length / 35)
  return Math.max(100, lines * 24 + 48)
}

export async function renderLatex(ctx: Context, content: string, config: Config): Promise<string> {
  const debug = config.debug || false
  if (debug) console.log('[latex-render] 开始渲染...')
  const width = config.width || 800
  const height = estimateHeight(content)

  let html: string
  try {
    html = generateHtml(content, config)
    if (debug) console.log('[latex-render] HTML 生成完成')
  } catch (error) {
    throw new Error(`HTML 生成失败: ${error}`)
  }

  let page = null
  try {
    page = await (ctx as any).puppeteer.page()
    await page.setContent(html, {
      waitUntil: 'networkidle2', // 修改 1：改成 networkidle2，防止国内 CDN 少量挂起导致超时
      timeout: 30000,
    })

    // 核心修复！强制浏览器阻塞，直到 KaTeX 的所有数学符号字体全部加载渲染完毕
    await page.evaluateHandle('document.fonts.ready')

    // 保底的一小段延迟，确保 DOM 重绘彻底完成
    await new Promise(resolve => setTimeout(resolve, 500))

    const actualHeight = await page.evaluate(() => document.body ? document.body.scrollHeight : 0)
    const finalHeight = Math.max(actualHeight + 20, height)

    const buffer = await page.screenshot({
      clip: { x: 0, y: 0, width: width, height: finalHeight },
      type: 'png'
    })

    await page.close().catch(() => {})
    page = null

    const base64 = Buffer.from(buffer).toString('base64')
    return await (ctx as any).assets.upload(`data:image/png;base64,${base64}`, 'latex-render.png')
  } catch (error: any) {
    if (page) await page.close().catch(() => {})
    throw new Error(`LaTeX 渲染失败: ${error?.message || error}`)
  }
}

export function containsLatex(content: string): boolean {
  const decoded = decodeHtmlEntities(content)
  return /\$\$/.test(decoded) || /\\begin\{/.test(decoded) || /\\\[[\s\S]*?\\\]/.test(decoded) ||
         /\\\([\s\S]*?\\\)/.test(decoded) || /\\[a-zA-Z]+/.test(decoded) || /\^[^{]/.test(decoded) ||
         /_[^{]/.test(decoded) || /\$[^\$\n]/.test(decoded)
}
