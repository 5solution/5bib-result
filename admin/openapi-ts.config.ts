// openapi-typescript config
// Run: pnpm generate:api

const config = {
  input: "http://localhost:8081/swagger/json",
  output: "src/lib/api-types.ts",
};

export default config;
