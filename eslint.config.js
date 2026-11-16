import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'audit_output/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
