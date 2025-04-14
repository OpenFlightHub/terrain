import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
    silent: false,

    clearMocks: true,
    coverageProvider: 'v8',
    moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],

    roots: ['<rootDir>/src'],

    testMatch: ['**/__tests__/**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    }
}

export default config
