function urlify(text) {
  let textregex = /(([a-z]+:\/\/)(([a-z0-9\-]+\.)+([a-z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal|tk|ga|xxx|to))(:[0-9]{1,5})?(\/[a-z0-9_\-\.~]+)*(\/([a-z0-9_\-\.]*)(\?[a-z0-9+_\-\.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/gi
  return text.replace(textregex,'<a href="$1" target="_blank" class="insertedlink">$1</a> ')
}

function newlineify(text) {
  let textregex = /(\n)/gi
  return text.replace(textregex,' <br>')
}

function crossout(text) {
  let textregex = /~([^~]*)~/gi
  return text.replace(textregex,'<span class="crossout">$1</span>')
}

function italicify(text) {
  let textregex = /\*([^\*]*)\*/gi
  return text.replace(textregex,'<i>$1</i> ')
}

function boldify(text) {
  let textregex = /\*\*([^\*]*)\*\*/gi
  return text.replace(textregex,'<b>$1</b> ')
}

function filterMentions(text) {
  let textregex = /(@[^\s]*)/gi //if you find an "@" select everything until you find a whitespace (and save as $1)
  return text.replace(textregex,`<span><a href="/users/$1" class="mention">$1</a></span> `)
}
function filterReplies(text) {
  let textregex = /_@_([^\s]*)/gi
  return text.replace(textregex,`<span><a href="/users/$1" class="reply" style="color: pink;">$1</a></span> `)
}

function filterPost(text) {
  text = htmlesc(text)
  text = newlineify(text)
  text = urlify(text)
  text = filterReplies(text)
  text = filterMentions(text)
  text = crossout(text)
  text = boldify(text)
  text = italicify(text)

  return text
}
