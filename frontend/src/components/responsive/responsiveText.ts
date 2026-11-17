import { isValidElement, type ReactNode } from "react";

export function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return isValidElement<{ children?: ReactNode }>(node)
    ? nodeText(node.props.children)
    : "";
}
