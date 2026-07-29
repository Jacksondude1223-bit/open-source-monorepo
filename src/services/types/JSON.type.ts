export type Stringified<T> = string & {
    [P in keyof T]: { "_ value": T[P] }
};

export declare function parse<T>(text: Stringified<T>): T;
export declare function stringify<T>(value: T): Stringified<T>;
