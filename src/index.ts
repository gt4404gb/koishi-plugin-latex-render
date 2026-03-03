import { Context, Schema, h, Element, Fragment } from 'koishi'
import { renderLatex } from './renderer'

export const name = 'latex-render'

export const inject = ['assets']

export interface Config {
  /** 图片宽度 */
  width?: number
  /** 背景色 */
  backgroundColor?: string
  /** 文字颜色 */
  textColor?: string
}

export const Config: Schema<Config> = Schema.object({
  width: Schema.number().default(800).description('图片宽度'),
  backgroundColor: Schema.string().default('#ffffff').description('背景色'),
  textColor: Schema.string().default('#333333').description('文字颜色'),
})

/**
 * 将 Fragment 转换为字符串
 */
function fragmentToString(fragment: Fragment): string {
  if (typeof fragment === 'string') return fragment
  if (Array.isArray(fragment)) {
    return fragment.map(fragmentToString).join('')
  }
  // 使用 Element 的 toString 方法
  return String(fragment)
}

export function apply(ctx: Context, config: Config) {
  // 注册中间件，拦截所有消息
  ctx.middleware(async (session, next) => {
    const result = await next()
    if (!result) return

    // 将结果转为字符串检测是否包含 LaTeX
    const content = fragmentToString(result)

    // 检测是否包含 LaTeX 公式 ($...$ 或 $$...$$)
    if (!containsLatex(content)) {
      return result
    }

    try {
      // 渲染整条消息为图片
      const imageUrl = await renderLatex(ctx, content, config)
      return h.image(imageUrl)
    } catch (error) {
      // 如果渲染失败，返回原始消息
      ctx.logger.warn('LaTeX 渲染失败:', error)
      return result
    }
  })
}

/**
 * 检测字符串是否包含 LaTeX 公式
 */
function containsLatex(content: string): boolean {
  // 检测行内公式 $...$ 或块级公式 $$...$$
  return /\$[^\$\n]+?\$/.test(content)
}
