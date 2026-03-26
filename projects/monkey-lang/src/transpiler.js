// Monkey → JavaScript transpiler
// Takes a Monkey AST and produces equivalent JavaScript code

import * as ast from './ast.js';

export class Transpiler {
  constructor() {
    this.indent = 0;
  }

  transpile(program) {
    return program.statements.map(s => this.transpileNode(s)).join('\n');
  }

  i() { return '  '.repeat(this.indent); }

  transpileNode(node) {
    if (node instanceof ast.Program) {
      return node.statements.map(s => this.transpileNode(s)).join('\n');
    }
    if (node instanceof ast.LetStatement) {
      return `${this.i()}let ${node.name.value} = ${this.transpileNode(node.value)};`;
    }
    if (node instanceof ast.ReturnStatement) {
      return `${this.i()}return ${this.transpileNode(node.returnValue)};`;
    }
    if (node instanceof ast.ImportStatement) {
      if (node.bindings) {
        return `${this.i()}const { ${node.bindings.join(', ')} } = __monkey_modules.${node.moduleName};`;
      }
      const name = node.alias || node.moduleName;
      return `${this.i()}const ${name} = __monkey_modules.${node.moduleName};`;
    }
    if (node instanceof ast.EnumStatement) {
      const entries = node.variants.map((v, i) => `${v}: "${node.name}.${v}"`).join(', ');
      return `${this.i()}const ${node.name} = Object.freeze({ ${entries} });`;
    }
    if (node instanceof ast.ArrayComprehension) {
      const cond = node.condition ? `.filter(${node.variable} => ${this.transpileNode(node.condition)})` : '';
      return `[...${this.transpileNode(node.iterable)}${cond}].map(${node.variable} => ${this.transpileNode(node.body)})`;
    }
    if (node instanceof ast.ExpressionStatement) {
      return `${this.i()}${this.transpileNode(node.expression)};`;
    }
    if (node instanceof ast.BlockStatement) {
      this.indent++;
      const body = node.statements.map(s => this.transpileNode(s)).join('\n');
      this.indent--;
      return body;
    }
    if (node instanceof ast.IntegerLiteral) {
      return String(node.value);
    }
    if (node instanceof ast.BooleanLiteral) {
      return String(node.value);
    }
    if (node instanceof ast.StringLiteral) {
      return JSON.stringify(node.value);
    }
    if (node instanceof ast.NullLiteral) {
      return 'null';
    }
    if (node instanceof ast.Identifier) {
      return node.value;
    }
    if (node instanceof ast.PrefixExpression) {
      return `(${node.operator}${this.transpileNode(node.right)})`;
    }
    if (node instanceof ast.InfixExpression) {
      return `(${this.transpileNode(node.left)} ${node.operator} ${this.transpileNode(node.right)})`;
    }
    if (node instanceof ast.IfExpression) {
      let result = `(${this.transpileNode(node.condition)}) {\n`;
      result += this.transpileNode(node.consequence);
      result += `\n${this.i()}}`;
      if (node.alternative) {
        result += ` else {\n${this.transpileNode(node.alternative)}\n${this.i()}}`;
      }
      return `${this.i()}if ${result}`;
    }
    if (node instanceof ast.FunctionLiteral) {
      const params = node.parameters.map((p, i) => {
        if (node.defaults && node.defaults[i]) {
          return `${p.value} = ${this.transpileNode(node.defaults[i])}`;
        }
        return p.value;
      }).join(', ');
      this.indent++;
      const body = node.body.statements.map(s => this.transpileNode(s)).join('\n');
      this.indent--;
      return `function(${params}) {\n${body}\n${this.i()}}`;
    }
    if (node instanceof ast.CallExpression) {
      const fn = this.transpileNode(node.function);
      const args = node.arguments.map(a => this.transpileNode(a)).join(', ');
      // Map builtins
      const builtinMap = {
        'puts': 'console.log',
        'len': '((x) => x.length)',
        'push': '((a, v) => [...a, v])',
        'str': 'String',
        'int': 'parseInt',
      };
      if (node.function instanceof ast.Identifier && builtinMap[node.function.value]) {
        return `${builtinMap[node.function.value]}(${args})`;
      }
      return `${fn}(${args})`;
    }
    if (node instanceof ast.ArrayLiteral) {
      return `[${node.elements.map(e => this.transpileNode(e)).join(', ')}]`;
    }
    if (node instanceof ast.IndexExpression) {
      return `${this.transpileNode(node.left)}[${this.transpileNode(node.index)}]`;
    }
    if (node instanceof ast.HashLiteral) {
      const pairs = [];
      for (const [key, value] of node.pairs) {
        pairs.push(`${this.transpileNode(key)}: ${this.transpileNode(value)}`);
      }
      return `{${pairs.join(', ')}}`;
    }
    if (node instanceof ast.AssignExpression) {
      return `${this.transpileNode(node.name)} = ${this.transpileNode(node.value)}`;
    }
    if (node instanceof ast.IndexAssignExpression) {
      return `${this.transpileNode(node.left)}[${this.transpileNode(node.index)}] = ${this.transpileNode(node.value)}`;
    }
    if (node instanceof ast.WhileExpression) {
      return `${this.i()}while (${this.transpileNode(node.condition)}) {\n${this.transpileNode(node.body)}\n${this.i()}}`;
    }
    if (node instanceof ast.ForExpression) {
      const init = this.transpileNode(node.init).replace(/;$/, '');
      return `${this.i()}for (${init}; ${this.transpileNode(node.condition)}; ${this.transpileNode(node.update)}) {\n${this.transpileNode(node.body)}\n${this.i()}}`;
    }
    if (node instanceof ast.ForInExpression) {
      return `${this.i()}for (const ${node.variable} of ${this.transpileNode(node.iterable)}) {\n${this.transpileNode(node.body)}\n${this.i()}}`;
    }
    if (node instanceof ast.BreakStatement) {
      return `${this.i()}break`;
    }
    if (node instanceof ast.ContinueStatement) {
      return `${this.i()}continue`;
    }
    if (node instanceof ast.TernaryExpression) {
      return `(${this.transpileNode(node.condition)} ? ${this.transpileNode(node.consequence)} : ${this.transpileNode(node.alternative)})`;
    }
    if (node instanceof ast.TemplateLiteral) {
      const parts = node.parts.map(p => {
        if (p instanceof ast.StringLiteral) return p.value;
        return `\${${this.transpileNode(p)}}`;
      });
      return '`' + parts.join('') + '`';
    }
    if (node instanceof ast.SliceExpression) {
      const start = node.start ? this.transpileNode(node.start) : '0';
      const end = node.end ? this.transpileNode(node.end) : '';
      return `${this.transpileNode(node.left)}.slice(${start}${end ? ', ' + end : ''})`;
    }
    // Array destructuring: let [a, b] = expr
    if (node instanceof ast.DestructuringLet) {
      const names = node.names.map(n => n ? n.value : '_').join(', ');
      return `${this.i()}let [${names}] = ${this.transpileNode(node.value)};`;
    }
    // Hash destructuring: let {x, y} = expr
    if (node instanceof ast.HashDestructuringLet) {
      const names = node.names.map(n => n.value).join(', ');
      return `${this.i()}let {${names}} = ${this.transpileNode(node.value)};`;
    }
    // Range expression: 0..10
    if (node instanceof ast.RangeExpression) {
      const start = this.transpileNode(node.start);
      const end = this.transpileNode(node.end);
      return `Array.from({length: ${end} - ${start}}, (_, i) => i + ${start})`;
    }
    // Match expression
    if (node instanceof ast.MatchExpression) {
      const subject = this.transpileNode(node.subject);
      const arms = node.arms.map(arm => {
        if (arm.pattern === null) {
          // Check if other arms used type patterns (if-based) vs value patterns (switch case)
          const hasTypePatterns = node.arms.some(a => a.pattern instanceof ast.TypePattern);
          if (hasTypePatterns) {
            return `${this.i()}  { return ${this.transpileNode(arm.value)}; }`;
          }
          return `${this.i()}  default: return ${this.transpileNode(arm.value)};`;
        }
        if (arm.pattern instanceof ast.TypePattern) {
          const tn = arm.pattern.typeName;
          const binding = arm.pattern.binding.value;
          let check;
          switch (tn) {
            case 'int': check = `typeof __subj === 'number'`; break;
            case 'string': check = `typeof __subj === 'string'`; break;
            case 'bool': check = `typeof __subj === 'boolean'`; break;
            case 'array': check = `Array.isArray(__subj)`; break;
            case 'fn': check = `typeof __subj === 'function'`; break;
            case 'Ok': check = `__subj && __subj.__isOk === true`; break;
            case 'Err': check = `__subj && __subj.__isOk === false`; break;
            default: check = `true`; break;
          }
          const bindExpr = (tn === 'Ok' || tn === 'Err') ? '__subj.value' : '__subj';
          return `${this.i()}  if (${check}) { let ${binding} = ${bindExpr}; return ${this.transpileNode(arm.value)}; }`;
        }
        return `${this.i()}  case ${this.transpileNode(arm.pattern)}: return ${this.transpileNode(arm.value)};`;
      }).join('\n');
      return `((__subj) => {\n${arms}\n${this.i()}})(${subject})`;
    }
    // TypePattern (standalone, shouldn't occur outside match)
    if (node instanceof ast.TypePattern) {
      return `/* type pattern: ${node.typeName}(${node.binding.value}) */`;
    }

    return `/* unsupported: ${node.constructor.name} */`;
  }
}
