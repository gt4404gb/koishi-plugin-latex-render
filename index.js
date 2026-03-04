var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");

// src/renderer.ts
var import_katex = __toESM(require("katex"));
function containsLatex(content) {
  return /\$\$/.test(content) || /\\begin\{/.test(content) || /\\\[[\s\S]*?\\\]/.test(content) || /\\\([\s\S]*?\\\)/.test(content) || /\$[^\$\n]/.test(content);
}
__name(containsLatex, "containsLatex");
function decodeHtmlEntities(text) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
__name(decodeHtmlEntities, "decodeHtmlEntities");
function parseMessage(content) {
  content = decodeHtmlEntities(content);
  const result = [];
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:[^\$\n]|\$(?!\$)|[\s\S])*?\$|\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        result.push({ type: "text", content: text });
      }
    }
    const latex = match[1];
    let isDisplay = false;
    let formula = latex;
    if (latex.startsWith("$$") && latex.endsWith("$$")) {
      isDisplay = true;
      formula = latex.slice(2, -2).trim();
    } else if (latex.startsWith("\\[") && latex.endsWith("\\]")) {
      isDisplay = true;
      formula = latex.slice(2, -2).trim();
    } else if (latex.startsWith("\\(") && latex.endsWith("\\)")) {
      formula = latex.slice(2, -2).trim();
    } else if (latex.startsWith("$") && latex.endsWith("$")) {
      formula = latex.slice(1, -1).trim();
    } else if (latex.startsWith("\\begin")) {
      isDisplay = true;
    }
    result.push({
      type: "latex",
      content: formula,
      display: isDisplay
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      result.push({ type: "text", content: text });
    }
  }
  return result;
}
__name(parseMessage, "parseMessage");
function generateHtml(parsed, config) {
  const textColor = config.textColor || "#333333";
  const bgColor = config.backgroundColor || "#ffffff";
  const width = config.width || 800;
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
  <div class="content">`;
  for (const item of parsed) {
    if (item.type === "text") {
      const escaped = item.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += `<span class="text-line">${escaped}</span>`;
    } else {
      try {
        const htmlContent = import_katex.default.renderToString(item.content, {
          throwOnError: false,
          displayMode: item.display || false,
          trust: true,
          strict: false
        });
        const className = item.display ? "latex-display" : "latex-inline";
        html += `<span class="${className}">${htmlContent}</span>`;
      } catch (e) {
        html += `<span class="latex-display"><code>${item.content}</code></span>`;
      }
    }
  }
  html += `</div></body></html>`;
  return html;
}
__name(generateHtml, "generateHtml");
function estimateHeight(parsed) {
  let charCount = 0;
  for (const item of parsed) {
    if (item.type === "text") {
      charCount += item.content.length;
    } else {
      charCount += item.content.length * 1.5;
    }
  }
  const lines = Math.ceil(charCount / 35);
  return Math.max(100, lines * 24 + 48);
}
__name(estimateHeight, "estimateHeight");
async function renderLatex(ctx, content, config) {
  console.log("[latex-render] 开始渲染...");
  let parsed;
  try {
    parsed = parseMessage(content);
    console.log("[latex-render] 解析完成，共", parsed.length, "个片段");
  } catch (error) {
    console.error("[latex-render] 解析消息失败:", error);
    throw new Error(`消息解析失败: ${error}`);
  }
  if (parsed.length === 0) {
    throw new Error("No content to render");
  }
  const width = config.width || 800;
  const height = estimateHeight(parsed);
  let html;
  try {
    html = generateHtml(parsed, config);
    console.log("[latex-render] HTML 生成完成，长度:", html.length);
  } catch (error) {
    console.error("[latex-render] HTML 生成失败:", error);
    throw new Error(`HTML 生成失败: ${error}`);
  }
  let page = null;
  try {
    page = await ctx.puppeteer.page();
    console.log("[latex-render] Puppeteer 页面获取成功");
    await page.setContent(html, {
      waitUntil: "networkidle2",
      timeout: 3e4
      // 30秒超时等待 CSS
    });
    console.log("[latex-render] HTML 内容设置完成");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const actualHeight = await page.evaluate(() => {
      const body = document.body;
      return body ? body.scrollHeight : 0;
    }).catch((e) => {
      console.warn("[latex-render] 获取高度失败，使用预估高度:", e);
      return height;
    });
    const finalHeight = Math.max(actualHeight + 20, height);
    console.log("[latex-render] 实际高度:", finalHeight);
    const buffer = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        width,
        height: finalHeight
      },
      type: "png"
    });
    console.log("[latex-render] 截图完成，buffer 长度:", buffer.length);
    await page.close().catch(() => {
    });
    page = null;
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;
    const url = await ctx.assets.upload(dataUrl, "latex-render.png");
    console.log("[latex-render] 图片上传完成，URL:", url);
    return url;
  } catch (error) {
    console.error("[latex-render] Puppeteer 渲染失败:", error?.message || error);
    console.error("[latex-render] 错误详情:", error?.stack || "无堆栈信息");
    if (page) {
      try {
        await page.close();
      } catch (e) {
      }
    }
    throw new Error(`LaTeX 渲染失败: ${error?.message || error}`);
  }
}
__name(renderLatex, "renderLatex");

// src/index.ts
var name = "latex-render";
var inject = ["assets", "puppeteer"];
var Config = import_koishi.Schema.object({
  width: import_koishi.Schema.number().default(800).description("图片宽度"),
  backgroundColor: import_koishi.Schema.string().default("#ffffff").description("背景色"),
  textColor: import_koishi.Schema.string().default("#333333").description("文字颜色"),
  debug: import_koishi.Schema.boolean().default(false).description("调试模式")
});
function apply(ctx, config) {
  const debug = config.debug || false;
  const handler = /* @__PURE__ */ __name(async (conversationId, sourceMessage, displayResponse, promptVariables, chatInterface, session) => {
    try {
      let content;
      if (Array.isArray(displayResponse)) {
        content = displayResponse[0]?.content;
      } else if (displayResponse?.content) {
        content = displayResponse.content;
      } else if (typeof displayResponse === "string") {
        content = displayResponse;
      }
      if (!content) return;
      const contentStr = typeof content === "string" ? content : JSON.stringify(content);
      if (containsLatex(contentStr)) {
        if (debug) {
          console.log("[latex-render] 检测到 LaTeX 公式，开始渲染...");
        }
        try {
          const imageUrl = await renderLatex(ctx, contentStr, config);
          if (session) {
            await session.send(import_koishi.h.image(imageUrl));
          }
          const imageContent = import_koishi.h.image(imageUrl).toString();
          if (Array.isArray(displayResponse)) {
            displayResponse[0].content = imageContent;
          } else {
            displayResponse.content = imageContent;
          }
        } catch (error) {
          if (debug) {
            console.error("[latex-render] 渲染失败:", error);
          }
        }
      }
    } catch (error) {
      if (debug) {
        console.error("[latex-render] 处理失败:", error);
      }
    }
  }, "handler");
  ctx.on("chatluna/after-chat", handler);
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name
});
