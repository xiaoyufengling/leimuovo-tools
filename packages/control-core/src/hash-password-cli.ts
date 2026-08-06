import { emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";
import { hashPassword } from "./auth.ts";

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") throw new Error("请在交互式终端中运行此命令");
  stdout.write(prompt);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("已取消"));
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        stdout.write("\n");
        resolve(value);
      } else if (key.name === "backspace") {
        value = value.slice(0, -1);
      } else if (character && !key.ctrl) {
        value += character;
      }
    };
    stdin.on("keypress", onKeypress);
  });
}

try {
  const password = await readHidden("输入控制中心密码（至少 16 个字符，不会显示）：");
  const confirmation = await readHidden("再次输入密码：");
  if (password !== confirmation) throw new Error("两次输入的密码不一致");
  stdout.write(`${await hashPassword(password)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "无法生成密码哈希");
  process.exitCode = 1;
}
