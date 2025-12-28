export const BOT_NAMES = [
  "Ada", "Turing", "Grace", "Hopper", "Linus",
  "Edsger", "Katherine", "Claude", "Hedy", "Ken",
];

export function botName(i: number) {
  return `${BOT_NAMES[i % BOT_NAMES.length]} 🤖`;
}