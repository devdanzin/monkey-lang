/**
 * Type Info Provider for monkey-lang
 * 
 * Provides LSP-like hover info: given source code and a position,
 * returns the inferred type of the expression at that position.
 * 
 * Uses the type checker to annotate all AST nodes with their types,
 * then queries by line/column.
 */

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { TypeChecker, Subst, freshVar, resetFresh } from './typechecker.js';
import * as ast from './ast.js';

class TypeAnnotator {
  constructor() {
    this.annotations = new Map(); // node → type string
    this.nodesByPosition = [];    // [{line, col, endCol, name, type}]
  }

  /**
   * Analyze source code and build type annotations
   */
  analyze(source) {
    const lexer = new Lexer(source);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    
    if (parser.errors.length > 0) {
      return { errors: parser.errors.map(e => ({ message: e })), annotations: [] };
    }

    const tc = new TypeChecker();
    const { errors, env } = tc.check(program);
    
    // Collect all identifiers and their types from the environment
    this._collectAnnotations(program, env, tc.subst);
    
    return {
      errors,
      annotations: this.nodesByPosition,
      program
    };
  }

  /**
   * Get type info at a specific position (line, col)
   */
  getTypeAt(line, col) {
    // Find the most specific (smallest) annotation containing this position
    let best = null;
    for (const ann of this.nodesByPosition) {
      if (ann.line === line && col >= ann.col && col <= (ann.endCol || ann.col + ann.name.length)) {
        if (!best || ann.name.length < best.name.length) {
          best = ann;
        }
      }
    }
    return best;
  }

  /**
   * Get all annotations (for displaying hover info everywhere)
   */
  getAllAnnotations() {
    return this.nodesByPosition;
  }

  _collectAnnotations(program, env, subst) {
    for (const stmt of program.statements) {
      this._annotateStatement(stmt, env, subst);
    }
  }

  _annotateStatement(stmt, env, subst) {
    if (stmt instanceof ast.LetStatement) {
      const name = stmt.name.value;
      const type = env.get(name);
      if (type) {
        const resolved = subst.apply(type);
        this._addAnnotation(stmt.name, name, resolved.toString());
      }
      if (stmt.value) this._annotateExpression(stmt.value, env, subst);
    } else if (stmt instanceof ast.ReturnStatement) {
      if (stmt.returnValue) this._annotateExpression(stmt.returnValue, env, subst);
    } else if (stmt instanceof ast.ExpressionStatement) {
      if (stmt.expression) this._annotateExpression(stmt.expression, env, subst);
    } else if (stmt instanceof ast.BlockStatement) {
      for (const s of (stmt.statements || [])) {
        this._annotateStatement(s, env, subst);
      }
    }
  }

  _annotateExpression(expr, env, subst) {
    if (!expr) return;
    
    if (expr instanceof ast.Identifier) {
      const type = env.get(expr.value);
      if (type) {
        this._addAnnotation(expr, expr.value, subst.apply(type).toString());
      }
    } else if (expr instanceof ast.FunctionLiteral) {
      // Annotate parameters
      if (expr.parameters) {
        for (const param of expr.parameters) {
          const type = env.get(param.value);
          if (type) this._addAnnotation(param, param.value, subst.apply(type).toString());
        }
      }
      if (expr.body) this._annotateStatement(expr.body, env, subst);
    } else if (expr instanceof ast.CallExpression) {
      this._annotateExpression(expr.function, env, subst);
      for (const arg of (expr.arguments || [])) {
        this._annotateExpression(arg, env, subst);
      }
    } else if (expr instanceof ast.InfixExpression) {
      this._annotateExpression(expr.left, env, subst);
      this._annotateExpression(expr.right, env, subst);
    } else if (expr instanceof ast.PrefixExpression) {
      this._annotateExpression(expr.right, env, subst);
    } else if (expr instanceof ast.IfExpression) {
      this._annotateExpression(expr.condition, env, subst);
      if (expr.consequence) this._annotateStatement(expr.consequence, env, subst);
      if (expr.alternative) this._annotateStatement(expr.alternative, env, subst);
    } else if (expr instanceof ast.ArrayLiteral) {
      for (const elem of (expr.elements || [])) {
        this._annotateExpression(elem, env, subst);
      }
    }
  }

  _addAnnotation(node, name, typeStr) {
    const line = node.token?.line || 1;
    const col = node.token?.col || 0;
    this.nodesByPosition.push({
      line,
      col,
      endCol: col + name.length,
      name,
      type: typeStr
    });
  }
}

/**
 * Quick helper: analyze source and return type info string
 */
function getTypeInfo(source) {
  const annotator = new TypeAnnotator();
  const result = annotator.analyze(source);
  return {
    errors: result.errors,
    types: result.annotations.map(a => `${a.name}: ${a.type}`),
    annotator
  };
}

/**
 * Format type info as hover string
 */
function formatHover(source, line, col) {
  const annotator = new TypeAnnotator();
  annotator.analyze(source);
  const info = annotator.getTypeAt(line, col);
  if (!info) return null;
  return `${info.name}: ${info.type}`;
}

export { TypeAnnotator, getTypeInfo, formatHover };
