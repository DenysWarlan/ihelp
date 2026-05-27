import playwright from "eslint-plugin-playwright";
import baseConfig from "../../eslint.config.mjs";

export default [
    playwright.configs["flat/recommended"],
    ...baseConfig,
    {
        files: [
            "**/*.ts",
            "**/*.js"
        ],
        rules: {
            "playwright/no-networkidle": "warn",
            "playwright/no-conditional-in-test": "warn",
            "playwright/no-conditional-expect": "warn",
            "playwright/prefer-web-first-assertions": "warn",
            "playwright/valid-title": "warn",
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/no-unused-expressions": "warn",
        }
    }
];
