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
    this.condition = condition;   // Expression
    this.body = body;             // BlockStatement
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `while(${this.condition}) ${this.body}`; }
}

export class AssignExpression {
  constructor(token, name, value) {
    this.token = token;
    this.name = name;     // Identifier
    this.value = value;   // Expression
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.name} = ${this.value}`; }
}
