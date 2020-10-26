"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPC = void 0;
var types_1 = require("./types");
var utils_1 = require("./utils");
var rlp_1 = require("./rlp");
var contract_1 = require("../contract");
var contract_2 = require("./contract");
var rlp = require("./rlp");
var BN = require("../bn");
var RPC = /** @class */ (function () {
    /**
     *
     * @param host  主机名
     * @param port  端口号
     */
    function RPC(host, port) {
        this.host = host || 'localhost';
        this.port = (port || 80).toString();
        this.callbacks = new Map(); // id -> function
        this.id2key = new Map(); // id -> address:event
        this.id2hash = new Map(); // id -> txhash
        this.eventHandlers = new Map(); // address:event -> [id]
        this.txObservers = new Map(); // hash -> [id]
        this.cid = 0;
        this.rpcCallbacks = new Map(); // nonce -> cb
        this.nonce = 0;
    }
    RPC.prototype.tryConnect = function () {
        var _this = this;
        var WS;
        if (typeof WebSocket === 'string')
            WS = WebSocket;
        else
            WS = require('ws');
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            return Promise.resolve(null);
        }
        if (this.ws) {
            var fn_1 = this.ws.onopen || (function (e) { });
            var p_1 = new Promise(function (rs, rj) {
                _this.ws.onopen = function (e) {
                    fn_1.call(_this.ws, e);
                    rs();
                };
            });
            return p_1;
        }
        this.uuid = utils_1.uuidv4();
        this.ws = new WS("ws://" + this.host + ":" + (this.port || 80) + "/websocket/" + this.uuid);
        this.ws.onerror = console.error;
        this.ws.onmessage = function (e) {
            if (typeof WebSocket !== 'function') {
                _this.handleData(e.data);
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var arrayBuffer = reader.result;
                _this.handleData(new Uint8Array(arrayBuffer));
            };
            reader.readAsArrayBuffer(e.data);
        };
        var p = new Promise(function (rs, rj) {
            _this.ws.onopen = rs;
        });
        return p;
    };
    RPC.prototype.parse = function (data) {
        var decoded = rlp.decode(data);
        var nonce = rlp_1.byteArrayToInt(decoded[0]);
        var code = rlp_1.byteArrayToInt(decoded[1]);
        var body = decoded[2];
        var r = {
            code: code,
            nonce: nonce,
            body: body
        };
        switch (code) {
            case types_1.WS_CODES.TRANSACTION_EMIT: {
                var h = contract_1.bin2hex(body[0]);
                var s = rlp_1.byteArrayToInt(body[1]);
                var ret = r;
                ret.hash = h;
                ret.status = s;
                if (s === types_1.TX_STATUS.DROPPED) {
                    ret.reason = utils_1.bin2str(body[2]);
                }
                if (s === types_1.TX_STATUS.INCLUDED) {
                    var arr = body[2];
                    ret.blockHeight = utils_1.toSafeInt(arr[0]);
                    ret.blockHash = contract_1.bin2hex(arr[1]);
                    ret.gasUsed = utils_1.toSafeInt(arr[2]);
                    ret.result = arr[3];
                    ret.events = arr[4];
                }
                return ret;
            }
            case types_1.WS_CODES.EVENT_EMIT: {
                var ret = r;
                ret.addr = contract_1.bin2hex(body[0]);
                ret.name = utils_1.bin2str(body[1]);
                return ret;
            }
        }
        return r;
    };
    RPC.prototype.handleData = function (data) {
        var _this = this;
        var r = this.parse(data);
        switch (r.code) {
            case types_1.WS_CODES.TRANSACTION_EMIT: {
                var t_1 = r;
                var funcIds = this.txObservers.get(t_1.hash) || [];
                funcIds.forEach(function (id) {
                    var func = _this.callbacks.get(id);
                    func(t_1);
                });
                return;
            }
            case types_1.WS_CODES.EVENT_EMIT: {
                var e_1 = r;
                var funcIds = this.eventHandlers.get(e_1.addr + ":" + e_1.name) || [];
                funcIds.forEach(function (id) {
                    var func = _this.callbacks.get(id);
                    func(e_1);
                });
                return;
            }
        }
        if (r.nonce) {
            var fn = this.rpcCallbacks.get(r.nonce);
            if (fn)
                fn(r);
            this.rpcCallbacks.delete(r.nonce);
        }
    };
    /**
     * 监听合约事件
     * @param {Contract} contract 合约
     * @param {string} event 事件
     * @param {Function} func 合约事件回调 {name: event, data: data}
     * @returns {number} 监听器的 id
     */
    RPC.prototype.__listen = function (contract, event, func) {
        var addr = utils_1.normalizeAddress(contract.address);
        var addrHex = contract_1.bin2hex(addr);
        this.wsRpc(types_1.WS_CODES.EVENT_SUBSCRIBE, addr);
        var id = ++this.cid;
        var key = addrHex + ":" + event;
        this.id2key.set(id, key);
        var fn = function (e) {
            var abiDecoded = contract.abiDecode(event, e.body, 'event');
            func(abiDecoded);
        };
        if (!this.eventHandlers.has(key))
            this.eventHandlers.set(key, new Set());
        this.eventHandlers.get(key).add(id);
        this.callbacks.set(id, fn);
        return id;
    };
    RPC.prototype.listen = function (contract, event, func) {
        var _this = this;
        if (func === undefined) {
            return new Promise(function (rs, rj) {
                _this.__listen(contract, event, rs);
            });
        }
        utils_1.assert(typeof func === 'function', 'callback should be function');
        this.__listen(contract, event, func);
    };
    /**
     * 移除监听器
     * @param {number} id 监听器的 id
     */
    RPC.prototype.removeListener = function (id) {
        var key = this.id2key.get(id);
        var h = this.id2hash.get(id);
        this.callbacks.delete(id);
        this.id2key.delete(id);
        this.id2hash.delete(id);
        if (key) {
            var set = this.eventHandlers.get(key);
            set && set.delete(id);
            if (set && set.size === 0)
                this.eventHandlers.delete(key);
        }
        if (h) {
            var set = this.txObservers.get(h);
            set && set.delete(id);
            if (set && set.size === 0)
                this.txObservers.delete(h);
        }
    };
    RPC.prototype.listenOnce = function (contract, event, func) {
        var _this = this;
        var id = this.cid + 1;
        if (func === undefined)
            return this.listen(contract, event).then(function (r) {
                _this.removeListener(id);
                return r;
            });
        return this.listen(contract, event, function (p) {
            func(p);
            _this.removeListener(id);
        });
    };
    /**
     * 添加事务观察者，如果事务最终被确认或者异常终止，观察者会被移除
     */
    RPC.prototype.__observe = function (_hash, cb) {
        var _this = this;
        var hash = contract_1.bin2hex(_hash);
        var id = ++this.cid;
        hash = hash.toLowerCase();
        if (!this.txObservers.has(hash))
            this.txObservers.set(hash, new Set());
        this.id2hash.set(id, hash);
        this.txObservers.get(hash).add(id);
        var fn = function (r) {
            cb(r);
            switch (r.status) {
                case types_1.TX_STATUS.DROPPED:
                case types_1.TX_STATUS.CONFIRMED:
                    _this.removeListener(id);
                    break;
            }
        };
        this.callbacks.set(id, fn);
        return id;
    };
    /**
     * 查看合约方法
     * @param  { Contract } contract 合约
     * @param {string} method  查看的方法
     * @param { Object | Array } parameters  额外的参数，字节数组，参数列表
     * @returns {Promise<Object>}
     */
    RPC.prototype.viewContract = function (contract, method, parameters) {
        if (!(contract instanceof contract_2.Contract))
            throw new Error('create a instanceof Contract by new tool.Contract(addr, abi)');
        var normalized = contract_2.normalizeParams(parameters);
        var addr = contract.address;
        var params = contract.abiEncode(method, normalized);
        return this.wsRpc(types_1.WS_CODES.CONTRACT_QUERY, [
            utils_1.normalizeAddress(addr),
            method,
            params
        ]).then(function (r) { return contract.abiDecode(method, r.body); });
    };
    /**
     * 通过 websocket 发送事务
     * @param tx {Transaction | Array<Transaction> }事务
     * @returns {Promise<Object>}
     */
    RPC.prototype.sendTransaction = function (tx) {
        return this.wsRpc(types_1.WS_CODES.TRANSACTION_SEND, [Array.isArray(tx), tx])
            .then(function () { return Promise.resolve(); });
    };
    RPC.prototype.observe = function (tx, status, timeout) {
        var _this = this;
        status = status === undefined ? types_1.TX_STATUS.CONFIRMED : status;
        return new Promise(function (resolve, reject) {
            var success = false;
            if (timeout)
                setTimeout(function () {
                    if (success)
                        return;
                    reject({ reason: 'timeout' });
                }, timeout);
            var ret = {};
            var confirmed = false;
            var included = false;
            _this.__observe(tx.getHash(), function (resp) {
                if (resp.status === types_1.TX_STATUS.DROPPED) {
                    var e = { hash: resp.hash, reason: resp.reason };
                    reject(e);
                    return;
                }
                if (resp.status === types_1.TX_STATUS.CONFIRMED) {
                    if (status === types_1.TX_STATUS.INCLUDED)
                        return;
                    confirmed = true;
                    if (included) {
                        success = true;
                        resolve(ret);
                        return;
                    }
                }
                if (resp.status === types_1.TX_STATUS.INCLUDED) {
                    included = true;
                    ret.blockHeight = resp.blockHeight;
                    ret.blockHash = resp.blockHash;
                    ret.gasUsed = resp.gasUsed;
                    if (resp.result && resp.result.length
                        && tx.__abi
                        && tx.isDeployOrCall()) {
                        var decoded = (new contract_2.Contract('', tx.__abi)).abiDecode(tx.getMethod(), resp.result);
                        ret.result = decoded;
                    }
                    if (resp.events.length
                        && tx.__abi) {
                        var events = [];
                        for (var _i = 0, _a = resp.events; _i < _a.length; _i++) {
                            var e = _a[_i];
                            var name_1 = utils_1.bin2str(e[0]);
                            var decoded = (new contract_2.Contract('', tx.__abi)).abiDecode(name_1, e[1], 'event');
                            events.push({ name: name_1, data: decoded });
                        }
                        ret.events = events;
                    }
                    ret.transactionHash = contract_1.bin2hex(tx.getHash());
                    ret.fee = utils_1.toSafeInt((new BN(tx.gasPrice).mul(new BN(ret.gasUsed))));
                    if (tx.isDeployOrCall()) {
                        ret.method = tx.getMethod();
                        ret.inputs = tx.__inputs;
                    }
                    if (status === types_1.TX_STATUS.INCLUDED) {
                        success = true;
                        resolve(ret);
                        return;
                    }
                    if (confirmed) {
                        success = true;
                        resolve(ret);
                    }
                }
            });
        });
    };
    RPC.prototype.wsRpc = function (code, data) {
        var _this = this;
        this.nonce++;
        var n = this.nonce;
        var ret = new Promise(function (rs, rj) {
            _this.rpcCallbacks.set(n, rs);
        });
        this.tryConnect()
            .then(function () {
            var encoded = rlp.encode([n, code, data]);
            _this.ws.send(encoded);
        });
        return ret;
    };
    /**
     * 发送事务的同时监听事务的状态
     */
    RPC.prototype.sendAndObserve = function (tx, status, timeout) {
        var _this = this;
        var ret;
        var p;
        var sub;
        if (Array.isArray(tx)) {
            p = [];
            var arr = [];
            sub = this.wsRpc(types_1.WS_CODES.TRANSACTION_SUBSCRIBE, tx.map(function (t) { return utils_1.hex2bin(t.getHash()); }));
            for (var _i = 0, tx_1 = tx; _i < tx_1.length; _i++) {
                var t = tx_1[_i];
                arr.push(this.observe(t, status, timeout));
            }
            p = Promise.all(p);
            ret = Promise.all(arr);
        }
        else {
            sub = this.wsRpc(types_1.WS_CODES.TRANSACTION_SUBSCRIBE, utils_1.hex2bin(tx.getHash()));
            ret = this.observe(tx, status, timeout);
        }
        return sub
            .then(function () { return _this.sendTransaction(tx); })
            .then(function () { return ret; });
    };
    /**
     * 获取 nonce
     */
    RPC.prototype.getNonce = function (_pkOrAddress) {
        var pkOrAddress = utils_1.normalizeAddress(_pkOrAddress);
        return this.wsRpc(types_1.WS_CODES.ACCOUNT_QUERY, pkOrAddress)
            .then(function (resp) {
            return utils_1.toSafeInt(new BN(resp.body[0][2]));
        });
    };
    /**
     * 获取 账户余额
     */
    RPC.prototype.getBalance = function (_pkOrAddress) {
        var pkOrAddress = utils_1.normalizeAddress(_pkOrAddress);
        return this.wsRpc(types_1.WS_CODES.ACCOUNT_QUERY, pkOrAddress)
            .then(function (resp) {
            return utils_1.toSafeInt(new BN(resp.body[0][3]));
        });
    };
    RPC.prototype.close = function () {
        if (this.ws) {
            var ws = this.ws;
            this.ws = null;
            ws.close();
        }
    };
    return RPC;
}());
exports.RPC = RPC;