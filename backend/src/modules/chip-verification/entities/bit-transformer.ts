/** Transformer cho cột bit(1) trong MySQL legacy → boolean. Chia sẻ giữa các entity read-only. */
export const bitTransformer = {
  from: (v: unknown): boolean => {
    if (Buffer.isBuffer(v)) return v[0] === 1;
    return Boolean(v);
  },
  to: (v: boolean) => v,
};
