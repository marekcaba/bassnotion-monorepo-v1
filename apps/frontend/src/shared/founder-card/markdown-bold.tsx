import { Fragment, ReactNode } from 'react';

/**
 * Inline `**bold**` renderer for admin-editable strings. Splits on `**…**`
 * and wraps the matched chunks in a styled `<b>`. Anything outside the
 * delimiters renders as a plain text node.
 *
 * Intentionally minimal — no nesting, no escaping. The admin form's
 * server-side Zod validation already caps string length, and the bold
 * marker is the only formatting affordance we expose to admins.
 */
const BOLD_RE = /\*\*(.+?)\*\*/g;

export function renderBoldMarkers(
  text: string,
  boldClassName = 'text-[#F5F1EB] font-semibold',
): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = BOLD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>,
      );
    }
    nodes.push(
      <b key={key++} className={boldClassName}>
        {match[1]}
      </b>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return nodes.length === 0 ? text : nodes;
}
