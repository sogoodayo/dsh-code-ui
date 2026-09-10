// 消息引用卡解析器一致性测试（与 lib/client.js 中 parseRefsFromMessage 保持同一组正则）
// 覆盖两种格式：新版带编号（- 1: 代码引用 …）与旧版不带编号（- 代码引用 …），两者都必须可解析。
function parse(text) {
  const out = []
  const reCode = /^- (?:(\d+): )?代码引用 (.+):(\d+)-(\d+)（(.+)）$/gm
  const reTr = /^- (?:(\d+): )?翻译引用 (.+):(\d+)-(\d+)（(.+)）$/gm
  const reTrFile = /^- (?:(\d+): )?翻译引用 ([^:\n]+)（(.+)）$/gm // 名字段禁冒号：避免吞掉带行号条目
  const reFile = /^- (?:(\d+): )?文件引用 ([^:\n]+)（整文件，绝对路径：(.+)）$/gm
  let m
  while ((m = reCode.exec(text)) !== null) out.push({ num: m[1] ? +m[1] : null, name: m[2], lineStart: +m[3], lineEnd: +m[4], path: m[5], kind: 'cite' })
  while ((m = reTr.exec(text)) !== null) out.push({ num: m[1] ? +m[1] : null, name: m[2], lineStart: +m[3], lineEnd: +m[4], path: m[5], kind: 'translate' })
  while ((m = reFile.exec(text)) !== null) out.push({ num: m[1] ? +m[1] : null, name: m[2], path: m[3], kind: 'cite' })
  while ((m = reTrFile.exec(text)) !== null) out.push({ num: m[1] ? +m[1] : null, name: m[2], path: m[3], kind: 'translate' })
  return out
}

// —— 新版（带编号）：buildSendPayload 当前输出格式 ——
const numbered = parse([
  '帮我看下这两段',
  '',
  '[code UI] 已标记 2 段代码引用、1 个文件引用、1 条翻译请求（代码正文不进消息，请调用 get_referenced_snippets 工具读取；条目编号与用户输入框上的引用 tag 序号一致，用户说「引用N」即指该条）：',
  '- 1: 代码引用 client.js:10-25（D:\\my\\deepseek-ai\\dsh-code-ui\\lib\\client.js）',
  '- 2: 代码引用 index.js:409-416（D:\\my\\deepseek-ai\\dsh-code-ui\\lib\\index.js）',
  '- 3: 文件引用 README.md（整文件，绝对路径：D:\\my\\deepseek-ai\\dsh-code-ui\\README.md）',
  '- 4: 翻译引用 a.ts:1-9（D:\\x\\a.ts）',
  '- 5: 翻译引用 b.md（D:\\x\\b.md）',
].join('\n'))
const byN = (list, n) => list.find((r) => r.num === n)
const okNumbered = numbered.length === 5
  && byN(numbered, 1).name === 'client.js' && byN(numbered, 1).lineStart === 10 && byN(numbered, 1).lineEnd === 25 && byN(numbered, 1).kind === 'cite'
  && byN(numbered, 2).path.includes('\\lib\\index.js')
  && byN(numbered, 3).path.includes('README.md') && byN(numbered, 3).lineStart === undefined
  && byN(numbered, 4).lineStart === 1 && byN(numbered, 4).lineEnd === 9 && byN(numbered, 4).kind === 'translate'
  && byN(numbered, 5).kind === 'translate' && byN(numbered, 5).lineStart === undefined

// —— 旧版（不带编号）：历史消息仍可解析 ——
const legacy = parse([
  '[code UI] 已标记 1 段代码引用（代码正文不进消息，请调用 get_referenced_snippets 工具读取）：',
  '- 代码引用 client.js:10-25（D:\\my\\deepseek-ai\\dsh-code-ui\\lib\\client.js）',
  '- 文件引用 README.md（整文件，绝对路径：D:\\my\\deepseek-ai\\dsh-code-ui\\README.md）',
].join('\n'))
const by = (list, n) => list.find((r) => r.name === n)
const okLegacy = legacy.length === 2
  && by(legacy, 'client.js').num === null && by(legacy, 'client.js').lineStart === 10 && by(legacy, 'client.js').lineEnd === 25
  && by(legacy, 'README.md').num === null && by(legacy, 'README.md').lineStart === undefined

console.log(JSON.stringify({ numbered, legacy }, null, 1))
const ok = okNumbered && okLegacy
console.log(ok ? 'PARSE-OK' : 'PARSE-FAIL' + (okNumbered ? '' : ' (numbered)') + (okLegacy ? '' : ' (legacy)'))
process.exit(ok ? 0 : 1)
