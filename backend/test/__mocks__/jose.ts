// Jest moduleNameMapper stub for `jose` (real package ships ESM-only and
// fails the default ts-jest CommonJS transform). Tests do not exercise JWT
// validation — guards are mocked at the DI layer — so a no-op stub is safe.
export const createRemoteJWKSet = (): unknown => () => undefined;
export const jwtVerify = async (): Promise<{ payload: Record<string, unknown> }> => ({
  payload: {},
});
