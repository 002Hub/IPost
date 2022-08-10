function XOR_hex(a, b) {
    var res = "",
        i = a.length,
        j = b.length;
    while (i-->0 && j-->0)
        res = (parseInt(a.charAt(i), 16) ^ parseInt(b.charAt(j), 16)).toString(16) + res;
    return res;
}

function hexEncode(a){
    let hex;

    let result = "";
    for (let i=0; i<a.length; i++) {
        hex = a.charCodeAt(i).toString(16);
        result += ("000"+hex).slice(-4);
    }

    return result
}

function xor(a,b) {
    return XOR_hex(hexEncode(a),hexEncode(b)).toString("hex")
}

module.exports = xor
  