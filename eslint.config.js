// eslint.config.js
export default [
    {
        files: ["backend/**/*.js"],
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off"
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module"
        }
    }
];
