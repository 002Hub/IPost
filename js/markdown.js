const urlregex = /(([a-z]+:\/\/)(([a-z0-9\-]+\.)+([a-z]{2}|aero|arpa|app|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal|tk|rocks|ga|to))(:[0-9]{1,5})?(\/[a-z0-9_\-\.~]+)*(\/([a-z0-9_\-\.]*)(\?[a-z0-9+_\-\.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/gi
function urlify(text) {
  return text.replace(urlregex,'<a href="$1" target="_blank" class="insertedlink">$1</a> ')
}

const newlregex = /(\n)/gi
function newlineify(text) {
  return text.replace(newlregex,' <br>')
}

const crossregex = /~([^~]*)~/gi
function crossout(text) {
  return text.replace(crossregex,'<span class="crossout">$1</span>')
}

const italicregex = /\*([^\*]*)\*/gi
function italicify(text) {
  return text.replace(italicregex,'<i>$1</i> ')
}

const boldregex = /\*\*([^\*]*)\*\*/gi
function boldify(text) {
  return text.replace(boldregex,'<b>$1</b> ')
}

const mentionregex = /@([^\s]*)/gi
function filterMentions(text) {
  return text.replace(mentionregex,`<span><a href="/users/$1" class="mention">$1</a></span> `)
}

const emojiregex = /:([^:\s]*):/gi
function emojify(text) {
  return text.replace(emojiregex,"<img class='emoji' src='/images/emoji/$1.png' alt=':$1:' title=':$1:' height=20/>")
}

function unemojify(text){
  text = text.replace(/\u{1F5FF}/gu,":moyai:")
  text = text.replace(/\u{1F440}/gu,":eyes:")
  return text
}

const allregex = /(```([^```]*)```)|(\n)|(~([^~]*)~)|(\*\*([^\*]*)\*\*)|(\*([^\*]*)\*)|(@[^\s]*)|(:([^:\s]*):)/gi

const cdblregex = /```([^```]*)```/gi

/**
 * filter out html, as well as render some markdown into html
 * @param  {string} text               text to filter/format
 * @return {string}      html that represents the filtered text
 */
function filterPost(text){
  text = unemojify(text)
  let result = htmlesc(text).replace(allregex, function (match) {
    let out = match
    if(cdblregex.test(match)) {
      let paddlen = 3
      out = out.substring(paddlen,out.length-paddlen).trim()+"\n"
      out = newlineify(out)
      return `<div class="ovfl-bw"><code>${out}</code></div>`
    }
    out = newlineify(out)
    out = urlify(out)
    out = emojify(out)
    out = filterMentions(out)
    out = crossout(out)
    out = boldify(out)
    out = italicify(out)

    return out
    
  });

  return result
}

/**
 * filter out html, as well as render some markdown into html, but without mentions
 * @param  {string} text               text to filter/format
 * @return {string}      html that represents the filtered text
 */
function filterReply(text) {
  text = htmlesc(text)
  text = newlineify(text)
  text = urlify(text)
  text = crossout(text)
  text = boldify(text)
  text = italicify(text)

  return text
}
