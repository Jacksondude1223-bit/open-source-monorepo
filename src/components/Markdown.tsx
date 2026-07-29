import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Elements we allow user-authored markdown to produce. Anything not in this
 * list (e.g. raw HTML, script, iframe, img) is stripped. react-markdown does
 * not render raw HTML unless rehype-raw is added, so this is defence in depth.
 */
const ALLOWED_ELEMENTS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'a',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

/** Only allow safe link protocols; everything else is dropped. */
function safeUrlTransform(url: string): string {
  const transformed = defaultUrlTransform(url);
  if (!transformed) return '';
  try {
    const parsed = new URL(transformed, 'https://readmin.app');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return transformed;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Renders user-authored markdown safely. Raw HTML is never rendered, links are
 * restricted to http/https/mailto and open in a new tab with noopener.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        'prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 break-words'
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        skipHtml
        urlTransform={safeUrlTransform}
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow ugc" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
