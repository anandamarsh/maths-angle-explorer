import rawTexts from "./texts.json";

type TextValue = string | number;

export const texts = rawTexts;

export function formatText(template: string, values: Record<string, TextValue>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
