"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe renderer for assistant replies: paragraphs, "- " bullets,
 * **bold**, and [label](href) links. Links render as buttons only when
 * `isSafeLink` allows them; otherwise just the label is shown. No HTML is
 * ever injected.
 */
export default function AssistantText({
  text,
  isSafeLink,
  renderLink,
}: {
  text: string;
  isSafeLink: (href: string) => boolean;
  renderLink: (label: string, href: string, key: string) => ReactNode;
}) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+\.)\s/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="my-1.5 space-y-1.5 pl-1">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2">
                  <span className="opacity-50">•</span>
                  <span className="min-w-0 flex-1">
                    {inline(l.replace(/^\s*([-*•]|\d+\.)\s/, ""), `${bi}-${li}`, isSafeLink, renderLink)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="my-1.5 first:mt-0 last:mb-0">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`, isSafeLink, renderLink)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function inline(
  line: string,
  keyBase: string,
  isSafeLink: (href: string) => boolean,
  renderLink: (label: string, href: string, key: string) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1] !== undefined) {
      out.push(isSafeLink(m[2]) ? renderLink(m[1], m[2], key) : <Fragment key={key}>{m[1]}</Fragment>);
    } else {
      out.push(<strong key={key}>{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
