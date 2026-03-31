// type-inference.js — Type inference pass for Monkey AST
//
// Infers types for expressions and variables:
//   'int', 'bool', 'string', 'array', 'hash', 'function', 'null', 'unknown'
//
// Uses: constraint-based inference with bidirectional flow.
// Annotates AST nodes with .inferredType property.

import * as ast from './ast.js';

export const Types = {
  INT: 'int',
  BOOL: 'bool',
  STRING: 'string',
  ARRAY: 'array',
  HASH: 'hash',
  FUNCTION: 'function',
  NULL: 'null',
  UNKNOWN: 'unknown',
};

export class TypeEnv {
  constructor(parent = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  get(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    return Types.UNKNOWN;
  }

  set(name, type) {
    this.bindings.set(name, type);
  }

  child() {
    return new TypeEnv(this);
  }
}

export class TypeInference {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  infer(program) {
    const env = new TypeEnv();
    // Built-in functions
    env.set('puts', Types.FUNCTION);
    env.set('len', Types.FUNCTION);
    env.set('first', Types.FUNCTION);
    env.set('last', Types.FUNCTION);
    env.set('rest', Types.FUNCTION);
    env.set('push', Types.FUNCTION);
    env.set('str', Types.FUNCTION);
    env.set('type', Types.FUNCTION);
    env.set('int', Types.FUNCTION);

    this.inferStatements(program.statements, env);
    return { errors: this.errors, warnings: this.warnings };
  }

  inferStatements(statements, env) {
    let lastType = Types.NULL;
    for (const stmt of statements) {
      lastType = this.inferStatement(stmt, env);
    }
    return lastType;
  }

  inferStatement(stmt, env) {
    if (stmt instanceof ast.LetStatement) {
      const type = this.inferExpression(stmt.value, env);
      env.set(stmt.name.value, type);
      stmt.inferredType = type;
      return type;
    }
    if (stmt instanceof ast.ReturnStatement) {
      const type = this.inferExpression(stmt.returnValue, env);
      stmt.inferredType = type;
      return type;
    }
    if (stmt instanceof ast.ExpressionStatement) {
      const type = this.inferExpression(stmt.expression, env);
      stmt.inferredType = type;
      return type;
    }
    if (stmt instanceof ast.AssignExpression) {
      const type = this.inferExpression(stmt.value, env);
      if (stmt.name) env.set(stmt.name.value, type);
      stmt.inferredType = type;
      return type;
    }
    if (stmt instanceof ast.BlockStatement) {
      return this.inferStatements(stmt.statements, env);
    }
    return Types.UNKNOWN;
  }

  inferExpression(expr, env) {
    if (!expr) return Types.NULL;

    if (expr instanceof ast.IntegerLiteral) {
      expr.inferredType = Types.INT;
      return Types.INT;
    }
    if (expr instanceof ast.BooleanLiteral) {
      expr.inferredType = Types.BOOL;
      return Types.BOOL;
    }
    if (expr instanceof ast.StringLiteral) {
      expr.inferredType = Types.STRING;
      return Types.STRING;
    }
    if (expr instanceof ast.NullLiteral) {
      expr.inferredType = Types.NULL;
      return Types.NULL;
    }
    if (expr instanceof ast.ArrayLiteral) {
      expr.inferredType = Types.ARRAY;
      if (expr.elements) {
        for (const el of expr.elements) {
          this.inferExpression(el, env);
        }
      }
      return Types.ARRAY;
    }
    if (expr instanceof ast.HashLiteral) {
      expr.inferredType = Types.HASH;
      if (expr.pairs) {
        for (const [k, v] of expr.pairs) {
          this.inferExpression(k, env);
          this.inferExpression(v, env);
        }
      }
      return Types.HASH;
    }
    if (expr instanceof ast.Identifier) {
      const type = env.get(expr.value);
      expr.inferredType = type;
      return type;
    }
    if (expr instanceof ast.PrefixExpression) {
      const rightType = this.inferExpression(expr.right, env);
      if (expr.operator === '!') {
        expr.inferredType = Types.BOOL;
        return Types.BOOL;
      }
      if (expr.operator === '-') {
        expr.inferredType = Types.INT;
        if (rightType !== Types.INT && rightType !== Types.UNKNOWN) {
          this.warnings.push(`Negation of non-integer type '${rightType}'`);
        }
        return Types.INT;
      }
      expr.inferredType = rightType;
      return rightType;
    }
    if (expr instanceof ast.InfixExpression) {
      const leftType = this.inferExpression(expr.left, env);
      const rightType = this.inferExpression(expr.right, env);

      if (['<', '>', '<=', '>=', '==', '!='].includes(expr.operator)) {
        expr.inferredType = Types.BOOL;
        return Types.BOOL;
      }
      if (expr.operator === '+') {
        // String + anything = string
        if (leftType === Types.STRING || rightType === Types.STRING) {
          if (leftType !== Types.STRING && leftType !== Types.UNKNOWN) {
            this.warnings.push(`Implicit string conversion: '${leftType}' + '${rightType}'`);
          }
          if (rightType !== Types.STRING && rightType !== Types.UNKNOWN) {
            this.warnings.push(`Implicit string conversion: '${leftType}' + '${rightType}'`);
          }
          expr.inferredType = Types.STRING;
          return Types.STRING;
        }
        if (leftType !== Types.INT && leftType !== Types.UNKNOWN) {
          this.warnings.push(`Addition of non-integer type '${leftType}'`);
        }
        if (rightType !== Types.INT && rightType !== Types.UNKNOWN) {
          this.warnings.push(`Addition of non-integer type '${rightType}'`);
        }
        expr.inferredType = Types.INT;
        return Types.INT;
      }
      if (['-', '*', '/', '%'].includes(expr.operator)) {
        expr.inferredType = Types.INT;
        if (leftType !== Types.INT && leftType !== Types.UNKNOWN) {
          this.warnings.push(`Arithmetic operator '${expr.operator}' on non-integer type '${leftType}'`);
        }
        if (rightType !== Types.INT && rightType !== Types.UNKNOWN) {
          this.warnings.push(`Arithmetic operator '${expr.operator}' on non-integer type '${rightType}'`);
        }
        return Types.INT;
      }
      if (['&&', '||'].includes(expr.operator)) {
        expr.inferredType = Types.BOOL;
        return Types.BOOL;
      }
      expr.inferredType = Types.UNKNOWN;
      return Types.UNKNOWN;
    }
    if (expr instanceof ast.IfExpression) {
      this.inferExpression(expr.condition, env);
      const consType = expr.consequence ? this.inferStatement(expr.consequence, env) : Types.NULL;
      const altType = expr.alternative ? this.inferStatement(expr.alternative, env) : Types.NULL;
      // If both branches return the same type, the if expression has that type
      const type = consType === altType ? consType : Types.UNKNOWN;
      expr.inferredType = type;
      return type;
    }
    if (expr instanceof ast.FunctionLiteral) {
      expr.inferredType = Types.FUNCTION;
      const fnEnv = env.child();
      if (expr.parameters) {
        for (const param of expr.parameters) {
          fnEnv.set(param.value, Types.UNKNOWN);
        }
      }
      if (expr.body) {
        this.inferStatement(expr.body, fnEnv);
      }
      return Types.FUNCTION;
    }
    if (expr instanceof ast.CallExpression) {
      const fnType = this.inferExpression(expr.function, env);
      if (expr.arguments) {
        for (const arg of expr.arguments) {
          this.inferExpression(arg, env);
        }
      }
      // Special cases for built-in returns
      const fnName = expr.function instanceof ast.Identifier ? expr.function.value : null;
      if (fnName === 'len') { expr.inferredType = Types.INT; return Types.INT; }
      if (fnName === 'str') { expr.inferredType = Types.STRING; return Types.STRING; }
      if (fnName === 'int') { expr.inferredType = Types.INT; return Types.INT; }
      if (fnName === 'type') { expr.inferredType = Types.STRING; return Types.STRING; }
      if (fnName === 'push') { expr.inferredType = Types.ARRAY; return Types.ARRAY; }
      if (fnName === 'first' || fnName === 'last') { expr.inferredType = Types.UNKNOWN; return Types.UNKNOWN; }
      if (fnName === 'rest') { expr.inferredType = Types.ARRAY; return Types.ARRAY; }
      
      expr.inferredType = Types.UNKNOWN;
      return Types.UNKNOWN;
    }
    if (expr instanceof ast.IndexExpression) {
      const leftType = this.inferExpression(expr.left, env);
      this.inferExpression(expr.index, env);
      if (leftType === Types.STRING) {
        expr.inferredType = Types.STRING;
        return Types.STRING;
      }
      expr.inferredType = Types.UNKNOWN;
      return Types.UNKNOWN;
    }
    if (expr instanceof ast.WhileExpression || expr instanceof ast.ForExpression) {
      if (expr.condition) this.inferExpression(expr.condition, env);
      if (expr.body) this.inferStatement(expr.body, env);
      expr.inferredType = Types.NULL;
      return Types.NULL;
    }

    // Default
    if (expr.inferredType === undefined) expr.inferredType = Types.UNKNOWN;
    return Types.UNKNOWN;
  }
}
