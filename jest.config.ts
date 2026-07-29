/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest'
import { compilerOptions } from './tsconfig.json'

const config: Config = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  roots: ["<rootDir>/"],
  modulePaths: ['<rootDir>/'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.(ts|js)',
  ],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
  globalSetup: '<rootDir>/__tests__/beforeAll.ts',
};

export default config;
