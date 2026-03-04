import { Context, Schema, h } from 'koishi'
import { renderLatex, containsLatex } from './renderer'

export const name = 'latex-render'

export const inject = ['assets', 'puppeteer']

export interface Config {
  /** 图片宽度 */
  width?: number
  /** 背景色 */
  backgroundColor?: string
  /** 文字颜色 */
  textColor?: string
  /** 调试模式 */
  debug?: boolean
}

export const Config: Schema<Config> = Schema.object({
  width: Schema.number().default(800).description('图片宽度'),
  backgroundColor: Schema.string().default('#ffffff').description('背景色'),
  textColor: Schema.string().default('#333333').description('文字颜色'),
  debug: Schema.boolean().default(false).description('调试模式'),
})

export function apply(ctx: Context, config: Config) {
  const debug = config.debug || false

  // 监听 chatluna/after-chat 事件
  const handler = async (
    conversationId: string,
    sourceMessage: any,
    displayResponse: any,
    promptVariables: any,
    chatInterface: any,
    session: any
  ) => {
    try {
      // 提取 content
      let content: string | undefined
      if (Array.isArray(displayResponse)) {
        content = displayResponse[0]?.content
      } else if (displayResponse?.content) {
        content = displayResponse.content
      } else if (typeof displayResponse === 'string') {
        content = displayResponse
      }

      if (!content) return

      const contentStr = typeof content === 'string' ? content : JSON.stringify(content)

      if (containsLatex(contentStr)) {
        // 检测到 LaTeX，输出日志
        if (debug) {
          console.log('[latex-render] 检测到 LaTeX 公式，开始渲染...')
        }

        try {
          const imageUrl = await renderLatex(ctx, contentStr, config)

          // 发送图片消息
          if (session) {
            await session.send(h.image(imageUrl))
          }

          // 替换消息内容
          const imageContent = h.image(imageUrl).toString()
          if (Array.isArray(displayResponse)) {
            displayResponse[0].content = imageContent
          } else {
            displayResponse.content = imageContent
          }
        } catch (error) {
          // 渲染失败时保留原始文本
          if (debug) {
            console.error('[latex-render] 渲染失败:', error)
          }
        }
      }
    } catch (error) {
      if (debug) {
        console.error('[latex-render] 处理失败:', error)
      }
    }
  }

  (ctx as any).on('chatluna/after-chat', handler)
}
