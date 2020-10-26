"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
// @ts-ignore
function log(a) {
    var str = String.UTF8.encode(a);
    _log(changetype(str), str.byteLength);
}
exports.log = log;
__exportStar(require("./context"), exports);
__exportStar(require("./rlp"), exports);
__exportStar(require("./db"), exports);
__exportStar(require("./safemath"), exports);
__exportStar(require("./hash"), exports);
__exportStar(require("./util"), exports);