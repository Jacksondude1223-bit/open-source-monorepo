/**
 * Safe arithmetic evaluator for view "computed columns".
 *
 * Users write simple formulas like `active / total * 100` or
 * `(messages + sessions) / plays`. We deliberately do NOT use eval(); instead
 * we tokenize, convert to RPN with the shunting-yard algorithm, and evaluate
 * the RPN. Only numbers, the whitelisted field identifiers below, the operators
 * + - * / and parentheses are permitted. Anything else throws, which the caller
 * surfaces as an empty/"—" cell.
 */

// Whitelisted field identifiers usable inside a formula, mapped at call time
// from a computed row's numbers.
export const COMPUTED_FIELDS = [
  'total',
  'active',
  'idle',
  'typing',
  'messages',
  'sessions',
  'plays',
  'attended',
] as const;

export type ComputedField = (typeof COMPUTED_FIELDS)[number];

type Token =
  | { type: 'number'; value: number }
  | { type: 'field'; value: ComputedField }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = expression.trim();

  while (i < src.length) {
    const ch = src[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Number (supports decimals)
    if (ch && /[0-9.]/.test(ch)) {
      let num = '';
      while (i < src.length && src[i] && /[0-9.]/.test(src[i] as string)) {
        num += src[i];
        i++;
      }
      const parsed = Number(num);
      if (Number.isNaN(parsed)) throw new Error(`Invalid number: ${num}`);
      tokens.push({ type: 'number', value: parsed });
      continue;
    }

    // Identifier (a whitelisted field)
    if (ch && /[a-zA-Z]/.test(ch)) {
      let ident = '';
      while (i < src.length && src[i] && /[a-zA-Z]/.test(src[i] as string)) {
        ident += src[i];
        i++;
      }
      if (!COMPUTED_FIELDS.includes(ident as ComputedField)) {
        throw new Error(`Unknown field: ${ident}`);
      }
      tokens.push({ type: 'field', value: ident as ComputedField });
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  return tokens;
}

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const ops: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'field') {
      output.push(token);
    } else if (token.type === 'op') {
      while (
        ops.length > 0 &&
        ops[ops.length - 1]?.type === 'op' &&
        PRECEDENCE[(ops[ops.length - 1] as { value: string }).value]! >= PRECEDENCE[token.value]!
      ) {
        output.push(ops.pop() as Token);
      }
      ops.push(token);
    } else if (token.value === '(') {
      ops.push(token);
    } else if (token.value === ')') {
      while (ops.length > 0 && (ops[ops.length - 1] as Token).type !== 'paren') {
        output.push(ops.pop() as Token);
      }
      if (ops.length === 0) throw new Error('Mismatched parentheses');
      ops.pop(); // discard '('
    }
  }

  while (ops.length > 0) {
    const op = ops.pop() as Token;
    if (op.type === 'paren') throw new Error('Mismatched parentheses');
    output.push(op);
  }

  return output;
}

function evalRpn(rpn: Token[], fields: Record<ComputedField, number>): number {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.type === 'number') {
      stack.push(token.value);
    } else if (token.type === 'field') {
      stack.push(fields[token.value] ?? 0);
    } else if (token.type === 'op') {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Invalid expression');
      switch (token.value) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          stack.push(b === 0 ? 0 : a / b);
          break;
      }
    }
  }

  if (stack.length !== 1) throw new Error('Invalid expression');
  return stack[0] as number;
}

/**
 * Evaluate a formula against a row's field values. Returns `null` when the
 * formula is malformed so the UI can render a neutral placeholder.
 */
export function evaluateComputedColumn(
  expression: string,
  fields: Record<ComputedField, number>,
): number | null {
  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) return null;
    const rpn = toRpn(tokens);
    const result = evalRpn(rpn, fields);
    if (!Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

/** Returns true if a formula is syntactically valid (used by the builder UI). */
export function isValidExpression(expression: string): boolean {
  const zeroed = COMPUTED_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f]: 1 }),
    {} as Record<ComputedField, number>,
  );
  return evaluateComputedColumn(expression, zeroed) !== null;
}
