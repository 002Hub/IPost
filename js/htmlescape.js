const {replace} = '';

const es = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|\\\\|`);/g;
const ca = /[&<>'"\\\\`]/g;

const esca = {
'&': '&amp;',
'<': '&lt;',
'>': '&gt;',
"'": '&#39;',
'"': '&quot;'
};
const pe = m => esca[m];

const escape = es => replace.call(es, ca, pe);
const htmlesc = es => replace.call(es, ca, pe);


const unes = {
'&amp;': '&',
'&#38;': '&',
'&lt;': '<',
'&#60;': '<',
'&gt;': '>',
'&#62;': '>',
'&apos;': "'",
'&#39;': "'",
'&quot;': '"',
'&#34;': '"'
};
const cape = m => unes[m];

const unescape = un => replace.call(un, es, cape);

function escape_special(str) {
  return str.replace(/\\/g,"\\\\").replace(/`/g,"\\`")
}

function unescape_special(str) {
  return str.replace(/\\\\/g,"\\").replace(/\\`/,"`")
}
