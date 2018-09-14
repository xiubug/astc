'use strict';

// 词法分析器 参数：代码字符串input
function tokenizer(input) {
  // 当前正在处理的字符索引
  let current = 0;
  // 词法单元数组
  let tokens = [];

  // 遍历字符串，获得词法单元数组
  while (current < input.length) {
    let char = input[current];

    // 匹配左括号
    if (char === '(') {

      // type 为 'paren'，value 为左圆括号的对象
      tokens.push({
        type: 'paren',
        value: '('
      });

      // current 自增
      current++;

      // 结束本次循环，进入下一次循环
      continue;
    }

    // 匹配右括号
    if (char === ')') {
      tokens.push({
        type: 'paren',
        value: ')'
      });

      current++;

      continue;
    }

    // \s：匹配任何空白字符，包括空格、制表符、换页符、换行符、垂直制表符等
    let WHITESPACE = /\s/;
    // 跳过空白字符
    if (WHITESPACE.test(char)) {
      current++;
      continue;
    }

    // [0-9]：匹配一个数字字符
    let NUMBERS = /[0-9]/;
    // 匹配数值
    if (NUMBERS.test(char)) {
      let value = '';
      // 匹配连续数字，作为数值
      while (NUMBERS.test(char)) {
        value += char;
        char = input[++current];
      }
      tokens.push({
        type: 'number',
        value
      });

      continue;
    }

    // 匹配形如"abc"的字符串
    if (char === '"') {
      let value = '';

      // 跳过左双引号
      char = input[++current];

      // 获取两个双引号之间的所有字符
      while (char !== '"') {
        value += char;
        char = input[++current];
      }

      // 跳过右双引号
      char = input[++current];

      tokens.push({
        type: 'string',
        value
      });

      continue;
    }

    // [a-z]：匹配1个小写字符 i 模式中的字符将同时匹配大小写字母
    let LETTERS = /[a-z]/i;
    // 匹配函数名，要求只含大小写字母
    if (LETTERS.test(char)) {
      let value = '';

      // 获取连续字符
      while (LETTERS.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({
        type: 'name',
        value
      });

      continue;
    }

    // 无法识别的字符，抛出错误提示
    throw new TypeError('I dont know what this character is: ' + char);
  }

  // 词法分析器的最后返回词法单元数组
  return tokens;
}

// 语法分析器 参数：词法单元数组
function parser(tokens) {
  // 当前正在处理的 token 索引
  let current = 0;
  // 递归遍历（因为函数调用允许嵌套），将 token 转成 AST 节点
  function walk() {
    // 获取当前 token
    let token = tokens[current];

    // 数值
    if (token.type === 'number') {
      // current 自增
      current++;

      // 生成一个 AST节点 'NumberLiteral'，用来表示数值字面量
      return {
        type: 'NumberLiteral',
        value: token.value,
      };
    }

    // 字符串
    if (token.type === 'string') {
      current++;

      // 生成一个 AST节点 'StringLiteral'，用来表示字符串字面量
      return {
        type: 'StringLiteral',
        value: token.value,
      };
    }

    // 函数
    if (token.type === 'paren' && token.value === '(') {
      // 跳过左括号，获取下一个 token 作为函数名
      token = tokens[++current];

      let node = {
        type: 'CallExpression',
        name: token.value,
        params: []
      };

      // 再次自增 `current` 变量，获取参数 token
      token = tokens[++current];

      // 右括号之前的所有token都属于参数
      while ((token.type !== 'paren') || (token.type === 'paren' && token.value !== ')')) {
        node.params.push(walk());
        token = tokens[current];
      }

      // 跳过右括号
      current++;

      return node;
    }
    // 无法识别的字符，抛出错误提示
    throw new TypeError(token.type);
  }

  // AST的根节点
  let ast = {
    type: 'Program',
    body: [],
  };

  // 填充ast.body
  while (current < tokens.length) {
    ast.body.push(walk());
  }

  // 最后返回ast
  return ast;
}

// 遍历器
function traverser(ast, visitor) {
  // 遍历 AST节点数组 对数组中的每一个元素调用 `traverseNode` 函数。
  function traverseArray(array, parent) {
    array.forEach(child => {
      traverseNode(child, parent);
    });
  }

  // 接受一个 `node` 和它的父节点 `parent` 作为参数
  function traverseNode(node, parent) {
    // 从 visitor 获取对应方法的对象
    let methods = visitor[node.type];
    // 通过 visitor 对应方法操作当前 node
    if (methods && methods.enter) {
      methods.enter(node, parent);
    }

    switch (node.type) {
      // 根节点
      case 'Program':
        traverseArray(node.body, node);
        break;
      // 函数调用
      case 'CallExpression':
        traverseArray(node.params, node);
        break;
      // 数值和字符串，不用处理
      case 'NumberLiteral':
      case 'StringLiteral':
        break;

      // 无法识别的字符，抛出错误提示
      default:
        throw new TypeError(node.type);
    }
    if (methods && methods.exit) {
      methods.exit(node, parent);
    }
  }
  // 开始遍历
  traverseNode(ast, null);
}

// 转化器，参数：AST
function transformer(ast) {
  // 创建 `newAST`，它与之前的 AST 类似，Program：新AST的根节点
  let newAst = {
    type: 'Program',
    body: [],
  };

  // 通过 _context 维护新旧 AST，注意 _context 是一个引用，从旧的 AST 到新的 AST。
  ast._context = newAst.body;

  // 通过遍历器遍历 参数：AST 和 visitor
  traverser(ast, {
    // 数值，直接原样插入新AST
    NumberLiteral: {
      enter(node, parent) {
        parent._context.push({
          type: 'NumberLiteral',
          value: node.value,
        });
      },
    },
    // 字符串，直接原样插入新AST
    StringLiteral: {
      enter(node, parent) {
        parent._context.push({
          type: 'StringLiteral',
          value: node.value,
        });
      },
    },
    // 函数调用
    CallExpression: {
      enter(node, parent) {
        // 创建不同的AST节点
        let expression = {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: node.name,
          },
          arguments: [],
        };

        // 函数调用有子类，建立节点对应关系，供子节点使用
        node._context = expression.arguments;

        // 顶层函数调用算是语句，包装成特殊的AST节点
        if (parent.type !== 'CallExpression') {

          expression = {
            type: 'ExpressionStatement',
            expression: expression,
          };
        }
        parent._context.push(expression);
      },
    }
  });
  return newAst;
}

// 代码生成器 参数：新 AST
function codeGenerator(node) {

  switch (node.type) {
    // 遍历 body 属性中的节点，且递归调用 codeGenerator，结果按行输出
    case 'Program':
      return node.body.map(codeGenerator)
        .join('\n');

    // 表达式，处理表达式内容，并用分号结尾
    case 'ExpressionStatement':
      return (
        codeGenerator(node.expression) +
        ';'
      );

    // 函数调用，添加左右括号，参数用逗号隔开
    case 'CallExpression':
      return (
        codeGenerator(node.callee) +
        '(' +
        node.arguments.map(codeGenerator)
          .join(', ') +
        ')'
      );

    // 标识符，数值，原样输出
    case 'Identifier':
      return node.name;
    case 'NumberLiteral':
      return node.value;

    // 字符串，用双引号包起来再输出
    case 'StringLiteral':
      return '"' + node.value + '"';

    // 无法识别的字符，抛出错误提示
    default:
      throw new TypeError(node.type);
  }
}

function compiler(input) {
  let tokens = tokenizer(input);
  let ast    = parser(tokens);
  let newAst = transformer(ast);
  let output = codeGenerator(newAst);

  return output;
}

module.exports = {
  tokenizer,
  parser,
  traverser,
  transformer,
  codeGenerator,
  compiler,
};
