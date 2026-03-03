import katex from 'katex'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'fs/promises'
import { Context } from 'koishi'

interface Config {
  width?: number
  backgroundColor?: string
  textColor?: string
}

// 字体缓存
let fontData: ArrayBuffer | null = null

/**
 * 加载字体数据
 */
async function loadFont(): Promise<ArrayBuffer> {
  if (fontData) return fontData

  try {
    // 尝试加载系统字体
    const fontPaths = [
      // Windows
      'C:/Windows/Fonts/msyh.ttc',   // 微软雅黑
      'C:/Windows/Fonts/simhei.ttf', // 黑体
      'C:/Windows/Fonts/simsun.ttc', // 宋体
      // macOS
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
      // Linux
      '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
      '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
    ]

    for (const fontPath of fontPaths) {
      try {
        const buffer = await readFile(fontPath)
        fontData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        return fontData
      } catch {
        continue
      }
    }

    throw new Error('No font found')
  } catch (error) {
    // 如果找不到字体，创建一个简单的位图字体
    throw error
  }
}

/**
 * 解析消息文本，提取 LaTeX 公式和普通文本
 */
function parseMessage(content: string): Array<{ type: 'text' | 'latex'; content: string; display?: boolean }> {
  const result: Array<{ type: 'text' | 'latex'; content: string; display?: boolean }> = []

  // 正则匹配 LaTeX 公式
  // $$...$$ 是展示公式，$...$ 是行内公式
  const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g

  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    // 添加普通文本
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) {
        result.push({ type: 'text', content: text })
      }
    }

    // 添加 LaTeX 公式
    const latex = match[1]
    const isDisplay = latex.startsWith('$$')
    const formula = isDisplay ? latex.slice(2, -2) : latex.slice(1, -1)

    result.push({
      type: 'latex',
      content: formula,
      display: isDisplay,
    })

    lastIndex = match.index + match[0].length
  }

  // 添加剩余的普通文本
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      result.push({ type: 'text', content: text })
    }
  }

  return result
}

/**
 * 渲染 LaTeX 为 HTML
 */
function renderLatexToHtml(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula, {
      throwOnError: false,
      displayMode,
      trust: true,
      strict: false,
    })
  } catch (error) {
    return `<span style="color:red">${formula}</span>`
  }
}

/**
 * 生成 Satori 元素
 */
function generateSatoriElements(
  parsed: Array<{ type: 'text' | 'latex'; content: string; display?: boolean }>,
  config: Config
): any[] {
  const elements: any[] = []
  const textColor = config.textColor || '#333333'

  // 创建 HTML 容器来渲染混合内容
  let htmlContent = ''

  for (const item of parsed) {
    if (item.type === 'text') {
      // 转义 HTML
      const escaped = item.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      htmlContent += `<span>${escaped}</span>`
    } else {
      // 渲染 LaTeX
      const html = renderLatexToHtml(item.content, item.display || false)
      // KaTeX 输出包含外部样式表，需要内联样式
      const styledHtml = html
        .replace(/class="katex"/g, 'style="font-size:1.1em"')
      htmlContent += `<span>${styledHtml}</span>`
    }
  }

  // 使用 HTML 元素
  elements.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        padding: '20px',
        backgroundColor: config.backgroundColor || '#ffffff',
        fontSize: '16px',
        lineHeight: '1.6',
        color: textColor,
        fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              dangerouslySetInnerHTML: htmlContent,
            },
          },
        },
      ],
    },
  })

  return elements
}

/**
 * 计算内容高度
 */
function calculateHeight(parsed: Array<{ type: 'text' | 'latex'; content: string }>): number {
  // 简单估算：每 50 个字符一行，加上公式的高度
  let charCount = 0
  for (const item of parsed) {
    if (item.type === 'text') {
      charCount += item.content.length
    } else {
      charCount += 20 // 公式预估
    }
  }

  const lines = Math.ceil(charCount / 40)
  return Math.max(60, lines * 28 + 40)
}

/**
 * 主渲染函数
 */
export async function renderLatex(
  ctx: Context,
  content: string,
  config: Config
): Promise<string> {
  // 解析消息
  const parsed = parseMessage(content)

  if (parsed.length === 0) {
    throw new Error('No content to render')
  }

  const width = config.width || 800
  const height = calculateHeight(parsed)

  // 加载字体
  let font: ArrayBuffer
  try {
    font = await loadFont()
  } catch {
    // 如果没有字体，使用默认处理
    ctx.logger.warn('无法加载字体，将使用默认处理')
    // 创建一个简单的 SVG 文本
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${config.backgroundColor || '#ffffff'}"/>
      <text x="10" y="30" fill="${config.textColor || '#333333'}" font-size="16">${content}</text>
    </svg>`

    const resvg = new Resvg(svg)
    const pngData = resvg.render()
    const buffer = Buffer.from(pngData.asPng())

    // 上传图片
    const url = await (ctx as any).assets.upload(buffer, 'latex-render.png')
    return url
  }

  // 生成 Satori 元素
  const elements = generateSatoriElements(parsed, config)

  // 使用 Satori 渲染为 SVG
  const svg = await satori(elements, {
    width,
    height,
    fonts: [
      {
        name: 'System',
        data: font,
        weight: 400,
        style: 'normal',
      },
    ],
  })

  // 使用 Resvg 渲染为 PNG
  const resvg = new Resvg(svg)
  const pngData = resvg.render()
  const buffer = Buffer.from(pngData.asPng())

  // 上传图片
  const url = await (ctx as any).assets.upload(buffer, 'latex-render.png')
  return url
}
