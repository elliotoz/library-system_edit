import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: { "^.+\\.ts$": "ts-jest" },
  testEnvironment: "node",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  globalSetup: "<rootDir>/test/helpers/setup.ts",
  globalTeardown: "<rootDir>/test/helpers/teardown.ts",
  testTimeout: 30000,
};

export default config;
