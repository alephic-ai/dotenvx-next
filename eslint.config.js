// @ts-check

import js from '@eslint/js'
import { importX } from 'eslint-plugin-import-x'
import nodePlugin from 'eslint-plugin-n'
import { configs as perfectionistConfigs } from 'eslint-plugin-perfectionist'
import { defineConfig, globalIgnores } from 'eslint/config'
import { configs as tsConfigs } from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**']),
  js.configs.recommended,
  tsConfigs.recommendedTypeChecked,
  nodePlugin.configs['flat/recommended'],
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  perfectionistConfigs['recommended-natural'],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
])
