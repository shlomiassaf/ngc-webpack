export const enum InternalSymbolName {
  Call = "__call", // Call signatures
  Constructor = "__constructor", // Constructor implementations
  New = "__new", // Constructor signatures
  Index = "__index", // Index signatures
  ExportStar = "__export", // Module export * declarations
  Global = "__global", // Global self-reference
  Missing = "__missing", // Indicates missing symbol
  Type = "__type", // Anonymous type literal symbol
  Object = "__object", // Anonymous object literal declaration
  JSXAttributes = "__jsxAttributes", // Anonymous JSX attributes object literal declaration
  Class = "__class", // Unnamed class expression
  Function = "__function", // Unnamed function expression
  Computed = "__computed", // Computed property name declaration with dynamic name
  Resolving = "__resolving__", // Indicator symbol used to mark partially resolved type aliases
  ExportEquals = "export=", // Export assignment symbol
  Default = "default", // Default export symbol (technically not wholly internal, but included here for usability)
}

/**
 * This represents a string whose leading underscore have been escaped by adding extra leading underscores.
 * The shape of this brand is rather unique compared to others we've used.
 * Instead of just an intersection of a string and an object, it is that union-ed
 * with an intersection of void and an object. This makes it wholly incompatible
 * with a normal string (which is good, it cannot be misused on assignment or on usage),
 * while still being comparable with a normal string via === (also good) and castable from a string.
 */
export type __String = (string & { __escapedIdentifier: void }) | (void & { __escapedIdentifier: void }) | InternalSymbolName;

/** ReadonlyMap where keys are `__String`s. */
export interface ReadonlyUnderscoreEscapedMap<T> {
  get(key: __String): T | undefined;
  has(key: __String): boolean;
  forEach(action: (value: T, key: __String) => void): void;
  readonly size: number;
  keys(): Iterator<__String>;
  values(): Iterator<T>;
  entries(): Iterator<[__String, T]>;
}

/** Map where keys are `__String`s. */
export interface UnderscoreEscapedMap<T> extends ReadonlyUnderscoreEscapedMap<T> {
  set(key: __String, value: T): this;
  delete(key: __String): boolean;
  clear(): void;
}

/** SymbolTable based on ES6 Map interface. */
export type SymbolTable = UnderscoreEscapedMap<Symbol>;
