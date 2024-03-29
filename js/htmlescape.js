/**
   * Copyright (C) 2017-present by Andrea Giammarchi - @WebReflection
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
//https://github.com/WebReflection/html-escaper

const {replace} = '';

const es = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/gi;
const ca = /[&<>'"]/g;

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
