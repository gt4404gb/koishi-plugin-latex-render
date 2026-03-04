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
var import_mhchem = require("katex/contrib/mhchem");
var import_marked = require("marked");
function decodeHtmlEntities(text) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
__name(decodeHtmlEntities, "decodeHtmlEntities");
function autoWrapLatex(text) {
  const lines = text.split("\n");
  let inCodeBlock = false;
  return lines.map((line) => {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      return line;
    }
    if (inCodeBlock) return line;
    const dollarCount = (line.match(/\$/g) || []).length;
    if (dollarCount >= 2 && dollarCount % 2 === 0 || line.includes("\\[") || line.includes("\\(") || line.includes("\\begin")) {
      return line.replace(/\$\$(\\ce\{.+?)\$\$\}/g, (_, p1) => `$$${p1}$$`).replace(/\$(\\ce\{.+?)\$\}/g, (_, p1) => `$${p1}$`);
    }
    const latexPattern = /(\\[a-zA-Z]+|\^|_[0-9a-zA-Z\{])/;
    if (!latexPattern.test(line)) return line;
    let result = "";
    const chunks = line.split(/([\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]+)/);
    for (let chunk of chunks) {
      if (/[\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]/.test(chunk)) {
        result += chunk;
      } else {
        if (chunk.includes("http") || chunk.includes("](")) {
          result += chunk;
          continue;
        }
        const trimmed = chunk.trim();
        if (trimmed.length > 0 && latexPattern.test(trimmed)) {
          const isEnglishSentence = /^[a-zA-Z0-9_\s\.,!?'"-]+$/.test(trimmed) && trimmed.split(/\s+/).length > 3 && !/(\\[a-zA-Z]+|[\+\-\=\/\<\>\*])/.test(trimmed);
          if (isEnglishSentence) {
            result += chunk;
            continue;
          }
          const leading = chunk.slice(0, chunk.indexOf(trimmed));
          const trailing = chunk.slice(chunk.indexOf(trimmed) + trimmed.length);
          const mathMatch = trimmed.match(/^([\s：:,，。;；]*)(.*?)([\s：:,，。;；]*)$/);
          const prefix = mathMatch ? mathMatch[1] : "";
          const coreMath = mathMatch ? mathMatch[2] : trimmed;
          const suffix = mathMatch ? mathMatch[3] : "";
          const listMatch = coreMath.match(/^((?:[-*+]|\d+\.)\s+)(.*)/);
          const isAlreadyWrapped = coreMath.startsWith("$") || coreMath.startsWith("\\[") || coreMath.startsWith("\\(") || coreMath.startsWith("\\begin");
          if (listMatch) {
            result += `${leading}${prefix}${listMatch[1]}$${listMatch[2].replace(/^\$+|\$+$/g, "")}$${suffix}${trailing}`;
          } else if (isAlreadyWrapped) {
            result += `${leading}${prefix}${coreMath}${suffix}${trailing}`;
          } else {
            result += `${leading}${prefix}$${coreMath}$${suffix}${trailing}`;
          }
        } else {
          result += chunk;
        }
      }
    }
    return result;
  }).join("\n");
}
__name(autoWrapLatex, "autoWrapLatex");
function containsMarkdown(content) {
  return /^#{1,6}\s/m.test(content) || /\*\*[^*]+\*\*/.test(content) || /\*[^*]+\*/.test(content) || /`[^`]+`/.test(content) || /```[\s\S]+?```/.test(content) || /^\s*[-*+]\s/m.test(content) || /^\s*\d+\.\s/m.test(content) || /^\s*>\s/m.test(content) || /\[.+?\]\(.+?\)/.test(content);
}
__name(containsMarkdown, "containsMarkdown");
function parseMessage(content) {
  const result = [];
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^\$\n]+?\$|\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text) result.push({ type: "text", content: text });
    }
    const latex = match[1];
    let isDisplay = false;
    let formula = latex.trim();
    if (formula.startsWith("$$") || formula.startsWith("\\[")) {
      isDisplay = true;
    } else if (formula.startsWith("\\begin")) {
      isDisplay = true;
    }
    formula = formula.replace(/^\s*\\\[|\s*\\\]$/g, "").replace(/^\s*\\\(|\s*\\\)$/g, "").replace(/^\s*\$\$|\s*\$\$$/g, "").replace(/^\s*\$|\s*\$$/g, "");
    formula = formula.replace(/\\\\/g, "卐NEWLINE卍").replace(/(?<!\\)\$/g, "").replace(/卐NEWLINE卍/g, "\\\\").trim();
    result.push({ type: "latex", content: formula, display: isDisplay });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text) result.push({ type: "text", content: text });
  }
  return result;
}
__name(parseMessage, "parseMessage");
function processChineseInLatex(formula) {
  return formula.replace(/(?<!\\text\{)([\u4e00-\u9fff]+)(?!\})/g, "\\text{$1}").replace(/\\_/g, "_");
}
__name(processChineseInLatex, "processChineseInLatex");
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(escapeHtml, "escapeHtml");
function generateHtml(content, config) {
  const textColor = config.textColor || "#333333";
  const bgColor = config.backgroundColor || "#ffffff";
  const width = config.width || 800;
  let decodedContent = decodeHtmlEntities(content);
  const wrappedContent = autoWrapLatex(decodedContent);
  const items = parseMessage(wrappedContent);
  const hasMarkdown = items.some((item) => item.type === "text" && containsMarkdown(item.content));
  let htmlContent;
  const katexOptions = {
    throwOnError: false,
    // 保持不报错降级
    strict: false
  };
  if (hasMarkdown) {
    const latexCache = [];
    let combinedMarkdown = "";
    let latexIndex = 0;
    for (const item of items) {
      if (item.type === "latex") {
        try {
          const processedContent = processChineseInLatex(item.content);
          const latexHtml = import_katex.default.renderToString(processedContent, { ...katexOptions, displayMode: item.display || false });
          const placeholder = `卐LATEX${latexIndex}卍`;
          if (item.display) {
            latexCache.push({ placeholder, html: `<div class="latex-display">${latexHtml}</div>`, isDisplay: true });
            combinedMarkdown += `

${placeholder}

`;
          } else {
            latexCache.push({ placeholder, html: `<span class="latex-inline">${latexHtml}</span>`, isDisplay: false });
            combinedMarkdown += placeholder;
          }
          latexIndex++;
        } catch (e) {
          console.warn(`[latex-render] 公式渲染降级: ${item.content}，原因: ${e.message}`);
          combinedMarkdown += `\`${item.content}\``;
        }
      } else {
        combinedMarkdown += item.content;
      }
    }
    htmlContent = import_marked.marked.parse(combinedMarkdown, { async: false });
    for (const { placeholder, html, isDisplay } of latexCache) {
      if (isDisplay) {
        htmlContent = htmlContent.replace(`<p>${placeholder}</p>`, html);
      }
      htmlContent = htmlContent.replace(placeholder, html);
    }
  } else {
    const parts = [];
    for (const item of items) {
      if (item.type === "latex") {
        try {
          const processedContent = processChineseInLatex(item.content);
          const latexHtml = import_katex.default.renderToString(processedContent, { ...katexOptions, displayMode: item.display || false });
          const className = item.display ? "latex-display block" : "latex-inline";
          parts.push(`<span class="${className}">${latexHtml}</span>`);
        } catch (e) {
          console.warn(`[latex-render] 公式渲染降级: ${item.content}，原因: ${e.message}`);
          parts.push(`<code>${escapeHtml(item.content)}</code>`);
        }
      } else {
        const textHtml = escapeHtml(item.content).replace(/\n/g, "<br>");
        parts.push(`<span class="text-line">${textHtml}</span>`);
      }
    }
    htmlContent = parts.join("");
  }
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
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
</html>`;
}
__name(generateHtml, "generateHtml");
function estimateHeight(content) {
  const lines = Math.ceil(content.length / 35);
  return Math.max(100, lines * 24 + 48);
}
__name(estimateHeight, "estimateHeight");
async function renderLatex(ctx, content, config) {
  console.log("[latex-render] 开始渲染...");
  const width = config.width || 800;
  const height = estimateHeight(content);
  let html;
  try {
    html = generateHtml(content, config);
    console.log("[latex-render] HTML 生成完成");
  } catch (error) {
    throw new Error(`HTML 生成失败: ${error}`);
  }
  let page = null;
  try {
    page = await ctx.puppeteer.page();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 3e4
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    const actualHeight = await page.evaluate(() => document.body ? document.body.scrollHeight : 0);
    const finalHeight = Math.max(actualHeight + 20, height);
    const buffer = await page.screenshot({
      clip: { x: 0, y: 0, width, height: finalHeight },
      type: "png"
    });
    await page.close().catch(() => {
    });
    page = null;
    const base64 = Buffer.from(buffer).toString("base64");
    return await ctx.assets.upload(`data:image/png;base64,${base64}`, "latex-render.png");
  } catch (error) {
    if (page) await page.close().catch(() => {
    });
    throw new Error(`LaTeX 渲染失败: ${error?.message || error}`);
  }
}
__name(renderLatex, "renderLatex");
function containsLatex(content) {
  const decoded = decodeHtmlEntities(content);
  return /\$\$/.test(decoded) || /\\begin\{/.test(decoded) || /\\\[[\s\S]*?\\\]/.test(decoded) || /\\\([\s\S]*?\\\)/.test(decoded) || /\\[a-zA-Z]+/.test(decoded) || /\^[^{]/.test(decoded) || /_[^{]/.test(decoded) || /\$[^\$\n]/.test(decoded);
}
__name(containsLatex, "containsLatex");

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
