// Monkey Language File-Based Module Loader
// Resolves, parses, evaluates, and caches file-based module imports.
// Usage: import "./math-utils.monkey" or import "../lib/helpers.monkey"

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { MonkeyHash, MonkeyString, Environment, NULL } from './object.js';

// Global module loader instance — shared across the evaluator
let globalLoader = null;

export class ModuleLoader {
  constructor(baseDir = process.cwd()) {
    this.baseDir = baseDir;
    this.cache = new Map();       // resolved path → MonkeyHash (exports)
    this.loading = new Set();     // resolved paths currently being loaded (circular detection)
  }

  // Resolve a module path relative to the importing file's directory
  resolve(moduleName, fromFile) {
    const base = fromFile ? dirname(fromFile) : this.baseDir;
    let resolved = resolve(base, moduleName);
    // Add .monkey extension if not present
    if (!resolved.endsWith('.monkey') && !resolved.endsWith('.mk')) {
      resolved += '.monkey';
    }
    return resolved;
  }

  // Check if a module name is a file path (vs built-in module name)
  static isFilePath(name) {
    return name.startsWith('./') || name.startsWith('../') || name.startsWith('/');
  }

  // Load a file-based module, returning a MonkeyHash of its exports
  // evalFn is the evaluator's Eval function (avoids circular dependency)
  load(moduleName, fromFile, evalFn) {
    const resolvedPath = this.resolve(moduleName, fromFile);

    // Check cache
    if (this.cache.has(resolvedPath)) {
      return this.cache.get(resolvedPath);
    }

    // Circular dependency detection
    if (this.loading.has(resolvedPath)) {
      return { error: `circular import detected: ${resolvedPath}` };
    }

    // Read file
    let source;
    try {
      source = readFileSync(resolvedPath, 'utf-8');
    } catch (e) {
      return { error: `cannot read module: ${moduleName} (${resolvedPath})` };
    }

    // Parse
    const lexer = new Lexer(source);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    if (parser.errors.length > 0) {
      return { error: `parse errors in ${moduleName}: ${parser.errors.join(', ')}` };
    }

    // Mark as loading (circular detection)
    this.loading.add(resolvedPath);

    // Create module environment with __file__ set
    const moduleEnv = new Environment();
    moduleEnv.set('__file__', new MonkeyString(resolvedPath));

    // Evaluate the module
    const result = evalFn(program, moduleEnv, resolvedPath);
    
    this.loading.delete(resolvedPath);

    // Check for errors
    if (result && result.type && result.type() === 'ERROR') {
      return { error: `error in module ${moduleName}: ${result.inspect()}` };
    }

    // Build exports hash from module's top-level environment
    const exports = new MonkeyHash(new Map());
    const store = moduleEnv.store || moduleEnv._store;
    if (store) {
      for (const [name, value] of store.entries()) {
        // Skip private names (starting with _) and built-in __file__
        if (name.startsWith('_')) continue;
        const key = new MonkeyString(name);
        const hk = key.fastHashKey ? key.fastHashKey() : key.hashKey();
        exports.pairs.set(hk, { key, value });
      }
    }

    // Cache the module
    this.cache.set(resolvedPath, exports);
    return exports;
  }

  // Clear cache (for testing)
  clearCache() {
    this.cache.clear();
    this.loading.clear();
  }
}

// Get or create the global module loader
export function getModuleLoader(baseDir) {
  if (!globalLoader || (baseDir && globalLoader.baseDir !== baseDir)) {
    globalLoader = new ModuleLoader(baseDir);
  }
  return globalLoader;
}

// Reset global loader (for testing)
export function resetModuleLoader() {
  globalLoader = null;
}
