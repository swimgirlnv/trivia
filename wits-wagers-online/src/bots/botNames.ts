import { MdSmartToy } from "react-icons/md";
import React from "react";

export const BOT_NAMES = [
  "Ada", "Turing", "Grace", "Hopper", "Linus",
  "Edsger", "Katherine", "Claude", "Hedy", "Ken",
];

export function botName(i: number) {
  return BOT_NAMES[i % BOT_NAMES.length];
}

export function BotIcon() {
  return React.createElement(MdSmartToy, { style: { marginLeft: 4, verticalAlign: "middle", fontSize: 18 }, title: "AI Bot" });
}