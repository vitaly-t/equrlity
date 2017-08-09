export interface IReadonlyMap<K, V> { get: (key: K) => V, has: (key: K) => boolean }
