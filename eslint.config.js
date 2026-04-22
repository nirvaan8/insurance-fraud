export default [
    {
        files: ["**/*.js"],
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "warn"
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module"
        }
    }
];
