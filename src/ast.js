// Monkey Language AST Nodes

// --- Statements ---

export class Program {
  constructor() {
    this.statements = [];
  }
  tokenLiteral() {
    return this.statements.length > 0 ? this.statements[0].tokenLiteral() : '';
  }
  toString() {
    return this.statements.map(s => s.toString()).join('');
  }
}

export class LetStatement {
  constructor(token, name, value) {
    this.token = token; // LET token
    this.name = name;   // Identifier
    this.value = value;  // Expression
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `let ${this.name} = ${this.value};`; }
}

export class ReturnStatement {
  constructor(token, returnValue) {
    this.token = token;
    this.returnValue = returnValue;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `return ${this.returnValue};`; }
}

export class ExpressionStatement {
  constructor(token, expression) {
    this.token = token;
    this.expression = expression;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return this.expression ? this.expression.toString() : ''; }
}

export class BlockStatement {
  constructor(token, statements) {
    this.token = token; // LBRACE
    this.statements = statements;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return this.statements.map(s => s.toString()).join(''); }
}

// --- Expressions ---

export class Identifier {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return this.value; }
}

export class IntegerLiteral {
  constructor(token, value) {
    this.token = token;
    this.value = value; // number
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return this.token.literal; }
}

export class StringLiteral {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `"${this.value}"`; }
}

export class BooleanLiteral {
  constructor(token, value) {
    this.token = token;
    this.value = value; // boolean
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return this.token.literal; }
}

export class PrefixExpression {
  constructor(token, operator, right) {
    this.token = token;
    this.operator = operator;
    this.right = right;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.operator}${this.right})`; }
}

export class InfixExpression {
  constructor(token, left, operator, right) {
    this.token = token;
    this.left = left;
    this.operator = operator;
    this.right = right;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.left} ${this.operator} ${this.right})`; }
}

export class IfExpression {
  constructor(token, condition, consequence, alternative) {
    this.token = token;
    this.condition = condition;
    this.consequence = consequence;   // BlockStatement
    this.alternative = alternative;   // BlockStatement | null
  }
  tokenLiteral() { return this.token.literal; }
  toString() {
    let s = `if${this.condition} ${this.consequence}`;
    if (this.alternative) s += `else ${this.alternative}`;
    return s;
  }
}

export class FunctionLiteral {
  constructor(token, parameters, body) {
    this.token = token;
    this.parameters = parameters; // Identifier[]
    this.body = body;             // BlockStatement
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `fn(${this.parameters.join(', ')}) ${this.body}`; }
}

export class CallExpression {
  constructor(token, fn, args) {
    this.token = token; // LPAREN
    this.function = fn;  // Identifier or FunctionLiteral
    this.arguments = args;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.function}(${this.arguments.join(', ')})`; }
}

export class ArrayLiteral {
  constructor(token, elements) {
    this.token = token;
    this.elements = elements;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `[${this.elements.join(', ')}]`; }
}

export class IndexExpression {
  constructor(token, left, index) {
    this.token = token; // LBRACKET
    this.left = left;
    this.index = index;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.left}[${this.index}])`; }
}

export class HashLiteral {
  constructor(token, pairs) {
    this.token = token;
    this.pairs = pairs; // Map<Expression, Expression>
  }
  tokenLiteral() { return this.token.literal; }
  toString() {
    const entries = [];
    for (const [k, v] of this.pairs) entries.push(`${k}:${v}`);
    return `{${entries.join(', ')}}`;
  }
}

export class WhileExpression {
  constructor(token, condition, body) {
    this.token = token;
    this.condition = condition;
    this.body = body; // BlockStatement
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `while (${this.condition}) ${this.body}`; }
}

export class DoWhileExpression {
  constructor(token, body, condition) {
    this.token = token;
    this.body = body;
    this.condition = condition;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `do ${this.body} while (${this.condition})`; }
}

export class BreakStatement {
  constructor(token) { this.token = token; }
  tokenLiteral() { return this.token.literal; }
  toString() { return 'break'; }
}

export class ContinueStatement {
  constructor(token) { this.token = token; }
  tokenLiteral() { return this.token.literal; }
  toString() { return 'continue'; }
}

export class SliceExpression {
  constructor(token, left, start, end) {
    this.token = token;
    this.left = left;
    this.start = start; // null means beginning
    this.end = end;     // null means end
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.left}[${this.start || ''}:${this.end || ''}])`; }
}

export class SetStatement {
  constructor(token, name, value) {
    this.token = token;
    this.name = name; // Identifier
    this.value = value;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `set ${this.name} = ${this.value}`; }
}

export class ForExpression {
  constructor(token, init, condition, update, body) {
    this.token = token;
    this.init = init;       // LetStatement or SetStatement
    this.condition = condition; // Expression
    this.update = update;   // SetStatement
    this.body = body;       // BlockStatement
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `for (${this.init}; ${this.condition}; ${this.update}) ${this.body}`; }
}

export class SwitchExpression {
  constructor(token, value, cases, defaultCase) {
    this.token = token;
    this.value = value;
    this.cases = cases;
    this.defaultCase = defaultCase;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `switch (${this.value}) { ... }`; }
}

export class TernaryExpression {
  constructor(token, condition, consequence, alternative) {
    this.token = token;
    this.condition = condition;
    this.consequence = consequence;
    this.alternative = alternative;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.condition} ? ${this.consequence} : ${this.alternative})`; }
}

export class TryCatchExpression {
  constructor(token, tryBody, errorIdent, catchBody) {
    this.token = token;
    this.tryBody = tryBody;
    this.errorIdent = errorIdent; // name for caught error
    this.catchBody = catchBody;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `try ${this.tryBody} catch (${this.errorIdent}) ${this.catchBody}`; }
}

export class ThrowExpression {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `throw ${this.value}`; }
}

export class ForInExpression {
  constructor(token, ident, iterable, body) {
    this.token = token;
    this.ident = ident; // loop variable name
    this.iterable = iterable; // expression that produces array/hash
    this.body = body; // block statement
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `for (${this.ident} in ${this.iterable}) ${this.body}`; }
}
