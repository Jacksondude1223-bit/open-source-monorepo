import {
  FlowCondition,
  FlowConditionGroup,
} from '~/services/NewMongoTypes/Flow.type';

// ─────────────────────────────────────────────────────────────────────────────
// Condition evaluation + token templating against a flow's evaluation context.
//
// The context is a plain object such as:
//   { event: {...}, subject: {...}, actor: {...}, accumulator: {...}, flow: {...} }
// Fields are addressed with dotted paths ("subject.tenureDays").
// ─────────────────────────────────────────────────────────────────────────────

export type FlowContext = Record<string, any>;

/** Safely resolve a dotted path against the context. Returns undefined if absent. */
export function resolvePath(context: FlowContext, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<any>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, context);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function evaluateCondition(context: FlowContext, condition: FlowCondition): boolean {
  const actual = resolvePath(context, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case 'equals':
      if (Array.isArray(actual))
        return actual.map(String).includes(String(expected));
      return String(actual) === String(expected);
    case 'notEquals':
      if (Array.isArray(actual))
        return !actual.map(String).includes(String(expected));
      return String(actual) !== String(expected);
    case 'in':
      if (!Array.isArray(expected)) return false;
      if (Array.isArray(actual))
        return actual.map(String).some((a) => expected.map(String).includes(a));
      return expected.map(String).includes(String(actual));
    case 'notIn':
      if (!Array.isArray(expected)) return true;
      if (Array.isArray(actual))
        return !actual.map(String).some((a) => expected.map(String).includes(a));
      return !expected.map(String).includes(String(actual));
    case 'gt': {
      const a = toNumber(actual);
      const b = toNumber(expected);
      return a !== null && b !== null && a > b;
    }
    case 'gte': {
      const a = toNumber(actual);
      const b = toNumber(expected);
      return a !== null && b !== null && a >= b;
    }
    case 'lt': {
      const a = toNumber(actual);
      const b = toNumber(expected);
      return a !== null && b !== null && a < b;
    }
    case 'lte': {
      const a = toNumber(actual);
      const b = toNumber(expected);
      return a !== null && b !== null && a <= b;
    }
    case 'contains':
      return String(actual ?? '')
        .toLowerCase()
        .includes(String(expected ?? '').toLowerCase());
    case 'matchesRegex':
      try {
        return new RegExp(String(expected)).test(String(actual ?? ''));
      } catch {
        return false;
      }
    case 'isEmpty':
      return (
        actual === undefined ||
        actual === null ||
        actual === '' ||
        (Array.isArray(actual) && actual.length === 0)
      );
    case 'isNotEmpty':
      return !(
        actual === undefined ||
        actual === null ||
        actual === '' ||
        (Array.isArray(actual) && actual.length === 0)
      );
    default:
      return false;
  }
}

/**
 * Evaluate a (possibly nested) condition group. An empty/undefined group is
 * treated as "always passes" so a flow with no filters fires on every event.
 */
export function evaluateConditionGroup(
  context: FlowContext,
  group?: FlowConditionGroup | null,
): boolean {
  if (!group) return true;

  const leaves = (group.conditions || []).map((c) =>
    evaluateCondition(context, c),
  );
  const nested = (group.groups || []).map((g) =>
    evaluateConditionGroup(context, g),
  );
  const all = [...leaves, ...nested];

  if (all.length === 0) return true;
  return group.combinator === 'or' ? all.some(Boolean) : all.every(Boolean);
}

/**
 * Render `{{dotted.path}}` tokens in a string against the context. Unknown
 * tokens render as an empty string. Non-string inputs are returned untouched.
 */
export function renderTemplate(template: string, context: FlowContext): string {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = resolvePath(context, path);
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

/** Deeply render every string in an action config object. */
export function renderConfig(
  config: Record<string, any>,
  context: FlowContext,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(config || {})) {
    out[key] = typeof value === 'string' ? renderTemplate(value, context) : value;
  }
  return out;
}
