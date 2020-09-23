# Wisdom Chain 智能合约编写指引

[TOC]



## AssemblyScript 简介


AssemblyScript 是 TypeScript 的一个变种，和 TypeScript 不同，AssemblyScript 使用严格类型。Wisdom Chain 的智能合约基于的是 WebAssembly 字节码实现的虚拟机，AssemblyScript 可以编译为 WebAssembly 字节码。

## 数据类型

### javascript 的类型与智能合约数据类型的映射：

| javascript 类型 |  智能合约中数据类型 | 描述              |
| ------------------- | ---------------- | ----------------- |
| ```number, string```           | ```i64```        | 64 bit 有符号整数 |
| ```number, string```           | ```u64```        | 64 bit 无符号整数 |
| ```number```           | ```f64```        | 单精度浮点数      |
| ```string```            | ```Address```        | 地址  |
| ```number, string```            | ```U256```        | 256 bit 无符号整数  |
| ```string, Uint8Array, ArrayBuffer```            | ```ArrayBuffer```        | 二进制字节数组 |
| ```boolean```           | ```bool```        | 布尔类型 |

除了以上表中的基本类型以外的其他类型都是引用类型。


### 类型转换

当 AssemblyScript 编译器检查到存在可能不兼容的隐式类型转换时，编译会以异常结果终止。如果需要进行可能不兼容的类型转换，请使用强制类型转换。

在AssemblyScript中，以上提到的每一个类型都有对应的强制转换函数。例如将一个 64 bit 无符号整数 类型的整数强制转换为 32 bit 无符号整数：

```typescript
const i: u64 = 123456789;
const j = u64(i);
```

### 类型声明

AssemblyScript编译器必须在编译时知道每个表达式的类型。这意味着变量和参数在声明时必须同时声明其类型。如果没有声明类型，编译器将首先假定类型为```i32```，在数值过大时再考虑 ```i64```，如果是浮点数就是用 ```f64```。如果变量是其他函数的返回值，则变量的类型是函数返回值的类型。此外，所有函数的返回值类型都必须事先声明，以帮助编译器类型推断。

合法的函数：

```typescript
function sayHello(): void{
    log("hello world");
}
```

语法不正确的函数：


```typescript
function sayHello(): { // 缺少类型声明 sayHello(): void
    log("hello world");
}
```

### 空值

许多编程语言具有一个特殊的 ```null``` 类型表示空值，例如 javascript 和 java 的 ```null```, go 语言和 python 的 ```nil```。事实上 ```null``` 类型的引入给程序带来了许多不可预知性，空值检查的遗漏会给智能合约带来安全隐患，因此 TDS 智能合约的编写没有引入 ```null``` 类型。

### 数值比较

当使用比较运算符 ```!=``` 和 ```==``` 时，如果两个数值在类型转换时是兼容的，则不需要强制类型转换就可以进行比较。

操作符 ```>```，```<```，```>=```，```<=``` 对无符号整数和有符号整数有不同的比较方式，被比较的两个数值要么都是有符号整数，要么都是无符号整数，且具有转换兼容性。


## 模块化

一个 AssemblyScript 智能合约项目可能由多个文件组成，文件与文件之间可以存在互相引用的关系，互相使用对方导出的内容。。AssemblyScript 项目编译成 wasm 字节码时，需要指定一个入口文件，只有这个入口文件中被导出的函数才可以在将来被调用到。

### 函数导出


```typescript
export function add(a: i32, b: i32): i32 {
  return a + b
}
```


### 全局变量导出

```typescript
export const foo = 1
export var bar = 2
```


### 类导出

```typescript
export class Bar {
    a: i32 = 1
    getA(): i32 { return this.a }
}
```

### 导入

若建立以下多文件项目，指定 ```index.ts``` 为编译时的入口文件

```sh
indext.ts
foo.ts
```

在 foo.ts 文件中包含了以下内容：

```typescript
export function add(a: i32, b: i32): i32{
    return a + b;
}
```


在 index.ts 中导入 ```add``` 函数：


```typescript
import {add} from './foo.ts'

function addOne(a: i32): i32{
    return add(a, 1);
}
```

## 标准库


### 全局变量

| 变量名         | 类型                     | 描述                                    |
| -------------- | ------------------------ | --------------------------------------- |
| ```NaN```      | ```f32``` 或者 ```f64``` | not a number，表示不是一个有效的浮点数  |
| ```Infinity``` | ```f32``` 或者 ```f64``` | 表示无穷大   ```-Infinity``` 表示无穷小 |


### 全局函数

| 函数名     | 参数个数 | 参数列表               | 返回值类型 | 描述                                                         |
| ---------- | -------- | ---------------------- | ---------- | ------------------------------------------------------------ |
| ```isNaN``` | 1        | ```f32``` 或 ```f64``` | ```bool``` | 判断一个浮点数是否无效                                       |
| ```isFinite``` | 1        | ```f32``` 或```f64``` | ```bool``` | 判断一个浮点数满足：1. 不是无穷大 2. 不是无穷小 3. 有效      |
| ```parseInt``` | 1 或 2 | ```(string, radisx?: i32)``` | ```i64```  | 从字符串解析成一个整数，```radix```等于10则使用 10 进制，默认 ```radix``` 是 10 |
| ```parseFloat``` | 1        | ```(string)```         | ```f64```  | 从字符串解析成一个浮点数，使用10进制                         |

### 数组（Array）

AssemblyScript 中的 ```Array<T>``` 与 JavaScript 中的 Array 非常相似。区别在于除了基本类型以外的数组初始化后，数组中的元素必须显示初始化后才可以访问。例如：


1. 使用基本类型初始化：

```typescript
const arr = new Array<u64>(10); // 使用基本类型 u64 创建数组
const zero = arr[0]; // zero 的值是 0，类型是 u64
```

2. 使用引用类型初始化：

```typescript
const arr = new Array<string>(10); // 使用基本类型 u64 创建数组
const zero = arr[0]; // 因为 TDS 合约不允许 null 值，所以这里会报错，因为 arr[0] 没有被初始化

// 正确的做法是进行初始化
for(let i = 0; i < arr.length; i++){
    arr[i] = "";
}
```

## 智能合约开发

###  下载 sdk 

```sh
mkdir contract-dev
cd contract-dev
npm init
npm install keystore_wdc --save-dev
npm install ws --save-dev
```

### 编译和部署合约

1. 编写合约源代码

然后新建一个 sample.ts 文件

```sh
touch sample.ts
```

复制以下内容到 sample.ts 中

```typescript

import {Globals, ___idof, ABI_DATA_TYPE} from './node_modules/keystore_wdc/lib'

// 构造器函数，合约部署时会被调用一次
export function init(name: string): void{
    // 初始化全局变量 name
    setName(name);
}

export function getName(): string{
    return Globals.get<string>('name');
}

export function setName(name: string): void{
    Globals.set<string>('name', name);
}

 
// 所有合约的主文件必须声明此函数
export function __idof(type: ABI_DATA_TYPE): u32 {
    return ___idof(type);
}
```

2. 编译合约

```js
const tool = require('keystore_wdc/contract')

// asc 所在的路径
const ascPath = 'node_modules/.bin/asc'

// 编译合约得到字节码，写入 abi 文件，并且返回
async function compile(){
    // 构造合约对象
    const contract = new tool.Contract()
    // 编译合约生成字节码
    const binary = (await tool.compileContract(ascPath, 'sample.ts'))
    // 编译生成 abi
    const abi = tool.compileABI(fs.readFileSync('sample.ts'));  
    // 写入 abi 文件
    fs.writeFileSync('sample.abi.json', JSON.stringify(abi))
    // 返回结果
    contract.binary = binary
    contract.abi = abi
    return contract
}
```

3. 构造并发送事务

```js
const ks = new (require('keystore_wdc'))
// 你的私钥
const sk = '****'
// 把私钥转成地址
const addr = ks.pubkeyHashToaddress(ks.pubkeyToPubkeyHash(ks.prikeyToPubkey(sk)))
// 合约事务构造器
const builder = new tool.TransactionBuilder(/* 事务默认版本号 */1, sk, /*gas限制，填写0不限制gas*/0, /*gas单价*/ 200000)
// rpc 对象
const rpc = new tool.RPC('localhost', 19585)

async function sendTx(){
    const c = await compile()
    const tx = builder.buildDeploy(c, ['contract-name'], 0)
    // 填入事务 nonce，建议 nonce 本地管理
    tx.nonce = (await rpc.getNonce(addr)) + 1
    // 对事务进行签名
    tx.sign(sk)
    // 预先打印合约的地址
    console.log(tool.getContractAddress(tx.getHash()))
    // 发送事务并等待事务打包进入区块
    console.log(await (rpc.sendAndObserve(tx, tool.TX_STATUS.INCLUDED)))
}
```


### 查询合约状态

```js
const tool = require('keystore_wdc/contract')
// 部署合约时打印的合约地址
const contractAddress = '**'
// 部署合约时编译好的 abi 文件
const abi = require('./sample.abi.json')
const rpc = new tool.RPC('localhost', 19585)

async function getName(){
    // 1. 创建合约对象
    const contract = new tool.Contract()
    contract.address = contractAddress
    contract.abi = abi

    // 2. 查看合约 显示的是 contract-name
    console.log(await rpc.viewContract(contract, 'getName'))
}
```

### 通过事务修改合约状态

```js
// 你的私钥
const sk = '****'
const addr = ks.pubkeyHashToaddress(ks.pubkeyToPubkeyHash(ks.prikeyToPubkey(sk)))
const tool = require('keystore_wdc/contract')

// 用于 node 文件读取

const builder = new tool.TransactionBuilder(/* 事务默认版本号 */1, sk, /*gas限制，填写0不限制gas*/0, /*gas单价*/ 200000)
const rpc = new tool.RPC('localhost', 19585)

async function update(){

    // 1. 构造合约对象
    const contract = new tool.Contract()
    // 读取编译好的 abi 
    const abi = require('./sample.abi.json');
    contract.abi = abi
    // 部署合约时打印的合约地址 
    contract.address = '****'

    // 生成合约调用事务
    let tx = builder.buildContractCall(contract, 'setName', {name: 'name2'})
    tx.nonce = (await rpc.getNonce(addr)) + 1
 
    // 3. 发送事务
    console.dir(await rpc.sendAndObserve(tx, tool.TX_STATUS.INCLUDED), {depth: null})
}
```


### 合约代码结构

1. 函数声明

一份智能合约代码可以由一个或者多个源代码文件组成，但只有最终编译的文件是合约的主文件，只有主文件中被声明为 export 的函数才可以被外部触发

```typescript
import {log} from './node_modules/keystore_wdc/lib';
export function init(): void{ 
  log('hello world');
}

export function invoke(): void{ 
  log('invoke');
}

function execute(): void{
  log('execute');
}
```

在这份合约中，invoke 函数可以通过构造事务或者通过rpc触发，而 execute 则不能被触发。

2. init 函数

建议合约主文件都要包含一个名为 init 的函数，而且这个函数一旦要被导出，这个 init 函数中的代码会在合约被部署时调用。

``` typescript
import {log} from './node_modules/keystore_wdc/lib';
export function init(): void{
  log('hello world');
}
```

3. __idof 函数

合约主文件必须包含一个 __idof 函数，而且内容必须和如下代码一样，此函数是合约与应用数据交换的接口

```typescript
// 所有合约的主文件必须声明此函数
export function __idof(type: ABI_DATA_TYPE): u32 {
    return ___idof(type);
}
```

### 状态存储

1. 临时存储

和 solidity 不同，Wisdom Chain 合约代码不通过声明全局变量的方式实现持久化存储，例如在以下代码中：

``` typescript
let c: u64;

export function init(): void{
  c = 0;
}

export function inc(): void{
  c++;
}
```

在这份合约中，c 被声明为全局变量，而且在外部可以通过构造事务触发 inc 函数实现 c 的自增，看似只要每次调用 inc 函数 c 都会加一。实际上在这里 c 存储的位置是 wasm 引擎的内存，而 wasm 引擎的内存不会被持久化到区块链中去，c本质上是一个临时存储。因此 inc 函数无论触发了多少次，c 的数值依然都是 0。

2. 永久存储

WisdomChain 智能合约提供了实现永久存储的全局变量对象 ```Globals```，和 Key-Value 类型的存储对象 ```Store```

3. Globals 类基本操作

```typescript
import { Globals } from './lib'

export function init(): void{
  // 保存一个字符串键值对 （增、改）
  Globals.set<string>('key', 'value');

  // 删除一个字符串全局变量
  Globals.remove('key');

  // 判断全局变量 key 是否存在 （查）
  const exists = Globals.has('key');

  if(!exists){
    Globals.set<string>('key', 'value');
  } 

  // 打印 value 的值 （查）
  // 因为 Assemblyscript 没有 null 类型，如果 exists 为 false 的情况下调用 Globals.get 会异常
  log(Globals.get<string>('key')); 
}
```

### 触发

触发合约中的方法有两种方式，一种是通过 rpc 触发，另一种是通过事务触发。

1. rpc 触发

通过 rpc 触发的限制在于，触发的方法对合约状态存储必须是只读的，而且无法获得区块链的内置对象，例如当前的事务、父区块的哈希值，在以下合约中：

```typescript
import { Globals } from './lib'

const valI = 'i';

// 把 i 设置为 0
export function init(): void{
  set(0);
}

// 把 i 自增，并且保存
export function inc(): void{
    set(get() + 1);
}

// 读取 i 的值
export function get(): u64{
    return Globals.has(valI) ? Globals.get<u64>(valI) : 0;
}

function set(i: u64): u64{
    return Globals.set<u64>(valI, i);
}
```

在这份合约中，```inc``` 函数对合约状态作了修改，因为无法通过 rpc 触发 ```inc``` 函数，而 ```get``` 函数没有对合约状态作修改，属于只读函数，所以可以用 rpc 触发 ```get``` 函数。


rpc 触发代码：

```js
const tool = require('keystore_wdc/contract')
const rpc = new tool.RPC('localhost', 19585)

async function main(){
    const contract = new tool.Contract()
    // 读取编译好的 abi 
    const abi = require('./***.abi.json');
    contract.abi = abi
    // 合约地址
    contract.address = '****'
    console.log(await (rpc.viewContract(contract, 'get')))
}

main()
```

3. 事务触发

通过事务触发可以对合约状态作写入、删改等操作，也可以在触发的函数中获取到区块链的上下文对象。


例如要通过事务触发以上合约中的 ```inc``` 函数可以执行 nodejs 代码：

```js
// 你的私钥
const sk = '****'
const addr = ks.pubkeyHashToaddress(ks.pubkeyToPubkeyHash(ks.prikeyToPubkey(sk)))
const tool = require('keystore_wdc/contract')

// 用于 node 文件读取

const builder = new tool.TransactionBuilder(/* 事务默认版本号 */1, sk, /*gas限制，填写0不限制gas*/0, /*gas单价*/ 200000)
const rpc = new tool.RPC('localhost', 19585)

async function update(){

    // 1. 构造合约对象
    const contract = new tool.Contract()
    // 读取编译好的 abi 
    const abi = require('./***.abi.json');
    contract.abi = abi
    // 部署合约时打印的合约地址 
    contract.address = '****'

    // 生成合约调用事务
    let tx = builder.buildContractCall(contract, 'inc')
    tx.nonce = (await rpc.getNonce(addr)) + 1
 
    // 3. 发送事务
    console.dir(await rpc.sendAndObserve(tx, tool.TX_STATUS.INCLUDED), {depth: null})
}
```




























