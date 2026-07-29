import { ObjectId } from 'mongodb';
import { BrandColors } from './Workspace.type';

export type FilterOperation = '<' | '>' | '=' | '!=' | '<=' | '>=';
export type SortType = 'ASC' | 'DESC';

export type Categories = 'totalMinutes' | 'activeMinutes' | 'typingMinutes' | 'idleMinutes' | 'messages' | 'sessions';

export type Filter = {
    id: string;
    name: Categories;
    type: FilterOperation;
    value: number;
};
export type Sort = {
    id: string;
    name: Categories;
    type: SortType;
};

// Stable identifiers for every column the view table can render.
export type ViewColumnKey =
    | 'index'
    | 'name'
    | 'role'
    | 'tags'
    | 'plays'
    | 'totalMinutes'
    | 'activeMinutes'
    | 'idleMinutes'
    | 'typingMinutes'
    | 'messages'
    | 'sessions'
    | 'goals'
    | 'lastSeen';

// Per-view column configuration so staff can show/hide and reorder columns.
export type ViewColumnConfig = {
    key: ViewColumnKey;
    visible: boolean;
};

// A custom column derived from a safe arithmetic expression over a row's
// numeric fields (e.g. "active / total * 100"). Evaluated read-only; no eval().
export type ComputedColumn = {
    key: string;
    label: string;
    expression: string;
    format?: 'number' | 'percent';
};

// A conditional-formatting rule that tints a cell's background when the value
// in the target column matches the comparison.
export type ConditionalRule = {
    id: string;
    column: Categories;
    type: FilterOperation;
    value: number;
    color: BrandColors;
};

export type View = {
    _id?: ObjectId;
    viewId: string;
    groupId: string;
    name: string;
    departments: ObjectId[];
    filters: Filter[];
    sort: Sort[];
    created: Date;
    // --- Views 2.0 (all optional & backward compatible) ---
    color?: BrandColors;
    icon?: string;
    columns?: ViewColumnConfig[];
    computedColumns?: ComputedColumn[];
    conditionalRules?: ConditionalRule[];
};
