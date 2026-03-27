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
    this.token = token; // LET or CONST token
    this.name = name;   // Identifier
    this.value = value;  // Expression
    this.isConst = token.type === 'CONST';
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.isConst ? 'const' : 'let'} ${this.name} = ${this.value};`; }
}

export class ReturnStatement {
  constructor(token, returnValue) {
    this.token = token;
    this.returnValue = returnValue;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `return ${this.returnValue};`; }
}

export class ImportStatement {
  constructor(token, moduleName, bindings = null, alias = null) {
    this.token = token;
    this.moduleName = moduleName;
    this.bindings = bindings; // null = import whole module, array of strings = selective
    this.alias = alias; // null = use module name, string = use alias
  }
  tokenLiteral() { return this.token.literal; }
  toString() {
    if (this.bindings) {
      return `import "${this.moduleName}" for ${this.bindings.join(', ')};`;
    }
    if (this.alias) {
      return `import "${this.moduleName}" as ${this.alias};`;
    }
    return `import "${this.moduleName}";`;
  }
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
    this.value = value;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return this.token.literal; }
}

export class FloatLiteral {
  constructor(token, value) {
    this.token = token;
    this.value = value;
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
    this.restParam = null;        // Identifier (for ...rest)
    this.paramTypes = null;       // string[] | null (type annotations: 'int', 'bool', 'string', etc.)
    this.returnType = null;       // string | null (return type annotation)
  }
  tokenLiteral() { return this.token.literal; }
  toString() {
    const params = this.parameters.map((p, i) => {
      const type = this.paramTypes && this.paramTypes[i] ? `: ${this.paramTypes[i]}` : '';
      return `${p}${type}`;
    });
    const ret = this.returnType ? ` -> ${this.returnType}` : '';
    return `fn(${params.join(', ')})${ret} ${this.body}`;
  }
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

export class ArrayComprehension {
  constructor(token, body, variable, iterable, condition) {
    this.token = token;
    this.body = body;         // expression to evaluate per element
    this.variable = variable; // identifier string
    this.iterable = iterable; // expression producing array
    this.condition = condition; // optional filter expression (or null)
  }
  tokenLiteral() { return this.token.literal; }
  toString() {
    const cond = this.condition ? ` if ${this.condition}` : '';
    return `[${this.body} for ${this.variable} in ${this.iterable}${cond}]`;
  }
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

export class OptionalChainExpression {
  constructor(token, left, index) {
    this.token = token; // ?.
    this.left = left;   // the object
    this.index = index;  // the key expression
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `(${this.left}?.[${this.index}])`; }
}

export class SpreadElement {
  constructor(token, expression) {
    this.token = token;       // ...
    this.expression = expression;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `...${this.expression}`; }
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

export class ForExpression {
  constructor(token, init, condition, update, body) {
    this.token = token;
    this.init = init;           // LetStatement or ExpressionStatement
    this.condition = condition; // Expression
    this.update = update;       // Expression (e.g., i += 1)
    this.body = body;           // BlockStatement
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `for (...) { ... }`; }
}

export class ForInExpression {
  constructor(token, variable, iterable, body) {
    this.token = token;
    this.variable = variable;   // string (identifier name)
    this.iterable = iterable;   // Expression
    this.body = body;            // BlockStatement
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `for (${this.variable} in ...) { ... }`; }
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

export class EnumStatement {
  constructor(token, name, variants) {
    this.token = token;
    this.name = name;       // string
    this.variants = variants; // array of strings
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `enum ${this.name} { ${this.variants.join(', ')} }`; }
}

export class TemplateLiteral {
  constructor(token, parts) {
    this.token = token;
    this.parts = parts; // Array of StringLiteral or Expression nodes
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return '`...`'; }
}

export class IndexAssignExpression {
  constructor(token, left, index, value) {
    this.token = token;
    this.left = left;     // Expression (the array/hash)
    this.index = index;   // Expression (the index/key)
    this.value = value;   // Expression (the value to assign)
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.left}[${this.index}] = ${this.value}`; }
}

export class NullLiteral {
  constructor(token) { this.token = token; }
  tokenLiteral() { return this.token.literal; }
  toString() { return 'null'; }
}

export class SliceExpression {
  constructor(token, left, start, end) {
    this.token = token;
    this.left = left;    // the array/string
    this.start = start;  // Expression or null (start of slice)
    this.end = end;      // Expression or null (end of slice)
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.left}[${this.start}:${this.end}]`; }
}

export class TernaryExpression {
  constructor(token, condition, consequence, alternative) {
    this.token = token;
    this.condition = condition;
    this.consequence = consequence;
    this.alternative = alternative;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.condition} ? ${this.consequence} : ${this.alternative}`; }
}

export class MatchExpression {
  constructor(token, subject, arms) {
    this.token = token;
    this.subject = subject;   // Expression to match against
    this.arms = arms;         // Array of { pattern, value } where pattern is Expression, TypePattern, or null (wildcard)
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return 'match { ... }'; }
}

export class TypePattern {
  constructor(typeName, binding) {
    this.typeName = typeName;
    this.binding = binding;
  }
  toString() { return `${this.typeName}(${this.binding.value})`; }
}

export class OrPattern {
  constructor(patterns) {
    this.patterns = patterns; // array of pattern expressions
  }
  toString() { return this.patterns.map(p => p.toString()).join(' | '); }
}

export class DestructuringLet {
  constructor(token, names, value) {
    this.token = token;
    this.names = names;   // Array of Identifier or null (for _)
    this.value = value;   // Expression
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `let [${this.names.map(n => n ? n.value : '_').join(', ')}] = ...`; }
}

export class HashDestructuringLet {
  constructor(token, names, value) {
    this.token = token;
    this.names = names;   // Array of Identifier (keys to extract from hash)
    this.value = value;   // Expression
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `let {${this.names.map(n => n.value).join(', ')}} = ...`; }
}

export class DoWhileExpression {
  constructor(token, body, condition) {
    this.token = token;
    this.body = body;
    this.condition = condition;
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return 'do { ... } while (...)'; }
}

export class RangeExpression {
  constructor(token, start, end) {
    this.token = token;
    this.start = start;  // Expression
    this.end = end;      // Expression
  }
  tokenLiteral() { return this.token.literal; }
  toString() { return `${this.start}..${this.end}`; }
}
