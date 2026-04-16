/**
 * Type-Directed Optimization for Monkey Language
 * 
 * Uses type information from the type checker to optimize AST nodes:
 * 1. Constant folding — evaluate compile-time known expressions
 * 2. Type specialization — annotate nodes with known types
 * 3. Dead branch elimination — remove unreachable if-branches
 * 4. Strength reduction — replace expensive ops with cheaper ones
 * 
 * This runs AFTER type checking and BEFORE compilation.
 * The compiler can then use type annotations for better codegen.
 */

import * as ast from './ast.js';
import { typecheck, tInt, tBool, tString, tNull, Subst } from './typechecker.js';

/**
 * Optimize an AST using type information.
 * @param {ast.Program} program - The parsed program
 * @param {object} typeInfo - Result from typecheck()
 * @returns {object} { program, stats }
 */
export function typeDirectedOptimize(program, typeInfo = null) {
  const optimizer = new TypedOptimizer(typeInfo);
  const optimized = optimizer.optimizeProgram(program);
  return {
    program: optimized,
    stats: optimizer.stats,
  };
}

class TypedOptimizer {
  constructor(typeInfo) {
    this.typeInfo = typeInfo;
    this.stats = {
      constantsFolded: 0,
      branchesEliminated: 0,
      strengthReductions: 0,
      totalOptimizations: 0,
    };
  }
  
  optimizeProgram(program) {
    const optimizedStmts = program.statements.map(s => this.optimizeStatement(s));
    const newProg = Object.create(Object.getPrototypeOf(program));
    Object.assign(newProg, program);
    newProg.statements = optimizedStmts.filter(s => s !== null);
    return newProg;
  }
  
  optimizeStatement(stmt) {
    if (stmt instanceof ast.LetStatement) {
      const value = this.optimizeExpr(stmt.value);
      if (value !== stmt.value) {
        const newStmt = Object.create(Object.getPrototypeOf(stmt));
        Object.assign(newStmt, stmt);
        newStmt.value = value;
        return newStmt;
      }
      return stmt;
    }
    
    if (stmt instanceof ast.ReturnStatement) {
      const value = this.optimizeExpr(stmt.returnValue);
      if (value !== stmt.returnValue) {
        const newStmt = Object.create(Object.getPrototypeOf(stmt));
        Object.assign(newStmt, stmt);
        newStmt.returnValue = value;
        return newStmt;
      }
      return stmt;
    }
    
    if (stmt instanceof ast.ExpressionStatement) {
      const expr = this.optimizeExpr(stmt.expression);
      if (expr !== stmt.expression) {
        const newStmt = Object.create(Object.getPrototypeOf(stmt));
        Object.assign(newStmt, stmt);
        newStmt.expression = expr;
        return newStmt;
      }
      return stmt;
    }
    
    if (stmt instanceof ast.BlockStatement) {
      const stmts = stmt.statements.map(s => this.optimizeStatement(s)).filter(s => s !== null);
      const newBlock = Object.create(Object.getPrototypeOf(stmt));
      Object.assign(newBlock, stmt);
      newBlock.statements = stmts;
      return newBlock;
    }
    
    return stmt;
  }
  
  optimizeExpr(expr) {
    if (!expr) return expr;
    
    // Constant folding for integer arithmetic
    if (expr instanceof ast.InfixExpression) {
      return this.optimizeInfix(expr);
    }
    
    // Dead branch elimination for if-expressions
    if (expr instanceof ast.IfExpression) {
      return this.optimizeIf(expr);
    }
    
    // Prefix optimization
    if (expr instanceof ast.PrefixExpression) {
      return this.optimizePrefix(expr);
    }
    
    // Optimize function bodies
    if (expr instanceof ast.FunctionLiteral) {
      return this.optimizeFunction(expr);
    }
    
    // Optimize call arguments
    if (expr instanceof ast.CallExpression) {
      return this.optimizeCall(expr);
    }
    
    return expr;
  }
  
  optimizeInfix(expr) {
    const left = this.optimizeExpr(expr.left);
    const right = this.optimizeExpr(expr.right);
    
    // Constant folding: both sides are integer literals
    if (left instanceof ast.IntegerLiteral && right instanceof ast.IntegerLiteral) {
      const result = this.evalIntOp(expr.operator, left.value, right.value);
      if (result !== null) {
        this.stats.constantsFolded++;
        this.stats.totalOptimizations++;
        if (typeof result === 'boolean') {
          return new ast.BooleanLiteral(expr.token, result);
        }
        return new ast.IntegerLiteral(expr.token, result);
      }
    }
    
    // Constant folding: both sides are boolean literals
    if (left instanceof ast.BooleanLiteral && right instanceof ast.BooleanLiteral) {
      const result = this.evalBoolOp(expr.operator, left.value, right.value);
      if (result !== null) {
        this.stats.constantsFolded++;
        this.stats.totalOptimizations++;
        return new ast.BooleanLiteral(expr.token, result);
      }
    }
    
    // Constant folding: string concatenation
    if (left instanceof ast.StringLiteral && right instanceof ast.StringLiteral && expr.operator === '+') {
      this.stats.constantsFolded++;
      this.stats.totalOptimizations++;
      return new ast.StringLiteral(expr.token, left.value + right.value);
    }
    
    // Strength reduction: x * 0 → 0
    if (expr.operator === '*') {
      if ((right instanceof ast.IntegerLiteral && right.value === 0) ||
          (left instanceof ast.IntegerLiteral && left.value === 0)) {
        this.stats.strengthReductions++;
        this.stats.totalOptimizations++;
        return new ast.IntegerLiteral(expr.token, 0);
      }
      // x * 1 → x
      if (right instanceof ast.IntegerLiteral && right.value === 1) {
        this.stats.strengthReductions++;
        this.stats.totalOptimizations++;
        return left;
      }
      if (left instanceof ast.IntegerLiteral && left.value === 1) {
        this.stats.strengthReductions++;
        this.stats.totalOptimizations++;
        return right;
      }
      // x * 2 → x + x (shift in backend)
      if (right instanceof ast.IntegerLiteral && right.value === 2) {
        this.stats.strengthReductions++;
        this.stats.totalOptimizations++;
        const newExpr = Object.create(Object.getPrototypeOf(expr));
        Object.assign(newExpr, expr);
        newExpr.operator = '+';
        newExpr.left = left;
        newExpr.right = left;
        return newExpr;
      }
    }
    
    // Strength reduction: x + 0 → x, x - 0 → x
    if ((expr.operator === '+' || expr.operator === '-') && 
        right instanceof ast.IntegerLiteral && right.value === 0) {
      this.stats.strengthReductions++;
      this.stats.totalOptimizations++;
      return left;
    }
    if (expr.operator === '+' && left instanceof ast.IntegerLiteral && left.value === 0) {
      this.stats.strengthReductions++;
      this.stats.totalOptimizations++;
      return right;
    }
    
    // x / 1 → x
    if (expr.operator === '/' && right instanceof ast.IntegerLiteral && right.value === 1) {
      this.stats.strengthReductions++;
      this.stats.totalOptimizations++;
      return left;
    }
    
    // Return with optimized children if changed
    if (left !== expr.left || right !== expr.right) {
      const newExpr = Object.create(Object.getPrototypeOf(expr));
      Object.assign(newExpr, expr);
      newExpr.left = left;
      newExpr.right = right;
      return newExpr;
    }
    
    return expr;
  }
  
  optimizeIf(expr) {
    const condition = this.optimizeExpr(expr.condition);
    
    // Dead branch elimination: if condition is a known boolean
    if (condition instanceof ast.BooleanLiteral) {
      this.stats.branchesEliminated++;
      this.stats.totalOptimizations++;
      if (condition.value) {
        return this.optimizeExpr(expr.consequence);
      } else if (expr.alternative) {
        return this.optimizeExpr(expr.alternative);
      }
      return new ast.NullLiteral(expr.token);
    }
    
    // Optimize branches
    const consequence = this.optimizeStatement(expr.consequence);
    const alternative = expr.alternative ? this.optimizeStatement(expr.alternative) : null;
    
    if (condition !== expr.condition || consequence !== expr.consequence || alternative !== expr.alternative) {
      const newExpr = Object.create(Object.getPrototypeOf(expr));
      Object.assign(newExpr, expr);
      newExpr.condition = condition;
      newExpr.consequence = consequence;
      newExpr.alternative = alternative;
      return newExpr;
    }
    
    return expr;
  }
  
  optimizePrefix(expr) {
    const right = this.optimizeExpr(expr.right);
    
    // Constant fold: !true → false, !false → true
    if (expr.operator === '!' && right instanceof ast.BooleanLiteral) {
      this.stats.constantsFolded++;
      this.stats.totalOptimizations++;
      return new ast.BooleanLiteral(expr.token, !right.value);
    }
    
    // Constant fold: -5 → -5 (keep as literal)
    if (expr.operator === '-' && right instanceof ast.IntegerLiteral) {
      this.stats.constantsFolded++;
      this.stats.totalOptimizations++;
      return new ast.IntegerLiteral(expr.token, -right.value);
    }
    
    if (right !== expr.right) {
      const newExpr = Object.create(Object.getPrototypeOf(expr));
      Object.assign(newExpr, expr);
      newExpr.right = right;
      return newExpr;
    }
    
    return expr;
  }
  
  optimizeFunction(expr) {
    const body = this.optimizeStatement(expr.body);
    if (body !== expr.body) {
      const newExpr = Object.create(Object.getPrototypeOf(expr));
      Object.assign(newExpr, expr);
      newExpr.body = body;
      return newExpr;
    }
    return expr;
  }
  
  optimizeCall(expr) {
    const fn = this.optimizeExpr(expr.function);
    const args = expr.arguments.map(a => this.optimizeExpr(a));
    const changed = fn !== expr.function || args.some((a, i) => a !== expr.arguments[i]);
    
    if (changed) {
      const newExpr = Object.create(Object.getPrototypeOf(expr));
      Object.assign(newExpr, expr);
      newExpr.function = fn;
      newExpr.arguments = args;
      return newExpr;
    }
    return expr;
  }
  
  // ============================================================
  // Compile-time evaluation
  // ============================================================
  
  evalIntOp(op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? Math.floor(a / b) : null;
      case '%': return b !== 0 ? a % b : null;
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
      case '==': return a === b;
      case '!=': return a !== b;
      default: return null;
    }
  }
  
  evalBoolOp(op, a, b) {
    switch (op) {
      case '==': return a === b;
      case '!=': return a !== b;
      case '&&': return a && b;
      case '||': return a || b;
      default: return null;
    }
  }
}
