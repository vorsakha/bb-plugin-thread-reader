export const passageLimit = 800;

export function passages(text: string): string[] {
  const parts: string[] = [];
  let remaining = text.trim();
  while (remaining.length > passageLimit) {
    const prefix = remaining.slice(0, passageLimit);
    const sentence = [...prefix.matchAll(/[.!?。！？](?:\s+|(?=[^\x00-\x7F]))|\n+/gu)].at(-1);
    const space = prefix.search(/\s+\S*$/u);
    let end = passageLimit;
    if (sentence) {
      end = sentence.index + sentence[0].length;
    } else if (space > 0) {
      end = space;
    } else if (/[\uD800-\uDBFF]/u.test(prefix.slice(-1))) {
      end--;
    }
    parts.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) {
    parts.push(remaining);
  }
  return parts;
}
