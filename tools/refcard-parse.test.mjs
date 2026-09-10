// 消息引用卡解析器一致性测试（与 lib/client.js 中 parseRefsFromMessage 保持同一组正则）
const text = [
  '帮我看下这段',
  '',
  '[code UI] 已标记 2 段代码引用、1 个文件引用、1 条翻译请求（代码正文不进消息，请调用 get_referenced_snippets 工具读取）：',
  '- 代码引用 client.js:10-25（D:\\my\\deepseek-ai\\dsh-code-ui\\lib\\client.js）',
  '- 代码引用 index.js:409-416（D:\\my\\deepseek-ai\\dsh-code-ui\\lib\\index.js）',
  '- 文件引用 README.md（整文件，绝对路径：D:\\my\\deepseek-ai\\dsh-code-ui\\README.md）',
  '- 翻译引用 a.ts:1-9（D:\\x\\a.ts）',
  '- 翻译引用 b.md（D:\\x\\b.md）',
].join('\n')
const out = []
const reCode = /^- 代码引用 (.+):(\d+)-(\d+)（(.+)）$/gm
const reTr = /^- 翻译引用 (.+):(\d+)-(\d+)（(.+)）$/gm
const reTrFile = /^- 翻译引用 ([^:\n]+)（(.+)）$/gm
const reFile = /^- 文件引用 ([^:\n]+)（整文件，绝对路径：(.+)）$/gm
let m
while ((m = reCode.exec(text)) !== null) out.push({ name: m[1], lineStart: +m[2], lineEnd: +m[3], path: m[4], kind: 'cite' })
while ((m = reTr.exec(text)) !== null) out.push({ name: m[1], lineStart: +m[2], lineEnd: +m[3], path: m[4], kind: 'translate' })
while ((m = reFile.exec(text)) !== null) out.push({ name: m[1], path: m[2], kind: 'cite' })
while ((m = reTrFile.exec(text)) !== null) out.push({ name: m[1], path: m[2], kind: 'translate' })
console.log(JSON.stringify(out, null, 1))
const by = (n) => out.find((r) => r.name === n)
const ok = out.length === 5
  && by('client.js').lineStart === 10 && by('client.js').lineEnd === 25 && by('client.js').kind === 'cite'
  && by('index.js').path.includes('\\lib\\index.js')
  && by('README.md').path.includes('README.md') && by('README.md').lineStart === undefined
  && by('a.ts').lineStart === 1 && by('a.ts').lineEnd === 9 && by('a.ts').kind === 'translate'
  && by('b.md').kind === 'translate' && by('b.md').lineStart === undefined
console.log(ok ? 'PARSE-OK' : 'PARSE-FAIL')
process.exit(ok ? 0 : 1)
