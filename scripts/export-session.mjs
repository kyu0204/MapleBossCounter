/**
 * Claude Code 세션 기록(jsonl)을 저장소용으로 내보낸다.
 *  - 비밀값(넥슨 API 키, 이메일, base64 시크릿 후보) 마스킹
 *  - 원본 jsonl(마스킹본) + 사람이 읽는 markdown(사용자 메시지 · 어시스턴트 텍스트만) 생성
 * 사용: node scripts/export-session.mjs <session.jsonl> <출력 basename>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [src, outBase] = process.argv.slice(2);
if (!src || !outBase) {
  console.error("usage: node scripts/export-session.mjs <session.jsonl> <docs/sessions/name>");
  process.exit(1);
}

const REDACTIONS = [
  [/\b(test|live)_[0-9a-f]{40,}\b/gi, "$1_[REDACTED_NEXON_KEY]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[REDACTED_EMAIL]"],
  [/(AUTH_SECRET|NEXON_KEY_ENC_SECRET|JOBS_SECRET|AUTH_DISCORD_SECRET|AUTH_DISCORD_ID)=([^\s"'\\]+)/g, "$1=[REDACTED]"],
  [/x-nxopen-api-key["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, "x-nxopen-api-key: [REDACTED]"],
  // 넥슨 계정 식별자 (character/list 의 account_id)
  [/(계정\s+|account_id["']?\s*[:=]\s*["']?)[0-9a-f]{32}/g, "$1[REDACTED_ACCOUNT_ID]"],
];
const redact = (s) => REDACTIONS.reduce((acc, [re, rep]) => acc.replace(re, rep), s);

const raw = readFileSync(src, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);
mkdirSync(path.dirname(outBase), { recursive: true });

// 1) 마스킹된 jsonl
const redactedLines = lines.map(redact);
writeFileSync(`${outBase}.jsonl`, redactedLines.join("\n") + "\n");

// 2) markdown: user / assistant 텍스트만 (tool 호출·결과 제외)
const md = [`# Claude Code 세션 기록 (${path.basename(src, ".jsonl")})`, "", "> 도구 호출·출력은 생략. 비밀값 마스킹.", ""];
let n = 0;
for (const line of redactedLines) {
  let obj;
  try { obj = JSON.parse(line); } catch { continue; }
  const msg = obj.message ?? obj;
  const role = obj.type === "user" || msg.role === "user" ? "user" : obj.type === "assistant" || msg.role === "assistant" ? "assistant" : null;
  if (!role) continue;
  const content = msg.content;
  const parts = [];
  if (typeof content === "string") parts.push(content);
  else if (Array.isArray(content)) for (const c of content) if (c?.type === "text" && c.text) parts.push(c.text);
  const text = parts.join("\n").trim();
  if (!text) continue;
  if (role === "user" && /^<(system-reminder|local-command|ide_|task-notification)/.test(text)) continue;
  if (role === "user" && text.startsWith("[SYSTEM NOTIFICATION")) continue;
  const clean = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, "").replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, "").trim();
  if (!clean) continue;
  const ts = obj.timestamp ? new Date(obj.timestamp).toISOString().slice(0, 16).replace("T", " ") : "";
  md.push(`## ${role === "user" ? "👤 사용자" : "🤖 Claude"} ${ts}`, "", clean, "");
  n++;
}
writeFileSync(`${outBase}.md`, md.join("\n"));
console.log(`written ${outBase}.jsonl (${redactedLines.length} lines), ${outBase}.md (${n} messages)`);
const leak = redactedLines.join("\n").match(/\b(test|live)_[0-9a-f]{40,}\b/gi);
console.log("leak check:", leak ? `FOUND ${leak.length}` : "clean");
