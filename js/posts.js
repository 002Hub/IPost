let user
let username

const wss_server = "wss://ipost.tk"
const wss_port = "443"
const wss_URI = wss_server + ":" + wss_port

var reply_id = 0

let socket = new WebSocket(wss_URI);
socket.addEventListener("message", function (event) {
  if(wss_server == event.origin) {
    let data = event.data;
    let ds = data.split(" ")
    let message = ds[0]
    if(message == "new_post") {
      main()
      if(user["username"]!=ds[1])mainNoti(ds[1])
    }
  }
})


async function postMessage() {
  let len = document.getElementById("post-text").value.length
  if(len >= 1001) {
    alert(`Error, your message cant contain more than 1000 characters! (${len})`)
    return
  }
  let r = await post("/api/post",{"message":document.getElementById("post-text").value,"reply_id":reply_id})
  if(window.location.href.split("?mention=")[1])location.replace('/posts');
  document.getElementById("post-text").value=""
}

document.getElementById("post-btn").addEventListener("click",postMessage)

function spacerTextNode() {
  return document.createTextNode(" | ")
}

const user_cache = {}
async function getavatar(username) {
  let user = user_cache[username]
  if(user == undefined) {
    user = (await (await fetch("/api/getotheruser?user="+encodeURIComponent(username))).json())["avatar"]
    if(user) {
      user = "/avatars/"+user
    } else {
      user = "/images/default_avatar.png"
    }
    user_cache[username]=user
  }
  return user
}

async function createPost(username,text,time,specialtext,postid,isbot) {
  if(!specialtext)specialtext=""
  const newDiv = document.createElement("div");
  const newP = document.createElement("p");
  const newA = document.createElement("a");
  const newSpan2 = document.createElement("span");
  const newSpan3 = document.createElement("span");
  const avatar = document.createElement("img");
  const boticon = document.createElement("img")
  boticon.src = "/images/bot.png"
  boticon.height = 25
  boticon.width = 25
  boticon.classList.add("boticon")

  const newUsername = document.createTextNode(username);
  let timedate = new Date(time)
  time = timedate
  time = time.toString()
  time = time.split(" ")
  time = time[0] + " " + time[1] + " " + time[2] + " " + time[3] + " " + time[4]
  if(timedate=="Thu Jan 01 1970 01:00:00 GMT+0100 (Central European Standard Time)")time="unknown time"
  const newTime = document.createTextNode(time)
  const newSpecialText = document.createTextNode(specialtext)
  newDiv.classList.add("post");
  newSpan3.classList.add("specialtext")


  avatar.width=25;
  avatar.height=25;
  avatar.classList.add("avatar")

  avatar.src = await getavatar(username)

  newA.appendChild(avatar)
  newA.appendChild(newUsername)

  newA.href = `/users/${username}`
  newSpan2.appendChild(newTime)
  newSpan3.appendChild(newSpecialText)


  newP.appendChild(newA)
  newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan2)
  if(specialtext != "")newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan3)
  if(isbot==1){
    newP.appendChild(spacerTextNode())
    newP.appendChild(boticon)
  }
  newP.appendChild(spacerTextNode())
  // |\>.</|
  newP.innerHTML += `<button onclick="reply('${username}',${postid},'${htmlesc(htmlesc(text))}')">Reply to this Post</button>`

  newDiv.appendChild(newP)
  newDiv.innerHTML += filterPost(text)
  newDiv.id = postid
  document.getElementById("posts").appendChild(newDiv)
}

async function main(){
  if(!user){
    user = await (await fetch("/api/getuser")).json()
    username = user.username
    if(!username){
      document.getElementById("noaccount").style=""
      document.getElementById("loading").style="display:none;"
      console.log("no account");
      return;
    }
    document.getElementById("username-self").innerText = username
  }

  let all_posts = await (await fetch(`/api/getPosts`)).json()
  if(!all_posts)return;
  document.getElementById("posts").innerHTML = ""
  for(i in all_posts) {
    let item = all_posts[i]
    await createPost(decodeURIComponent(item.post_user_name),decodeURIComponent(item.post_text),item.post_time,item.post_special_text,item.post_id,item.post_from_bot)
  }

  let links = document.getElementsByClassName("insertedlink")
  for (let i = 0; i < links.length; i++) {
    links[i].innerText = links[i].innerText.split("\/\/")[1].split("\/")[0]
  }

  let mentions = document.getElementsByClassName("mention")
  for (let i = 0; i < mentions.length; i++) {
    if(mentions[i]!=undefined && mentions[i].innerText == "@"+username) {
      mentions[i].classList.add("user-mention");
      mentions[i].classList.remove("mention");
      i--;
    }
    if(mentions[i]!=undefined && (mentions[i].innerText == "@everyone" || mentions[i].innerText == "@here")) {
      mentions[i].classList.add("everyone-mention");
      mentions[i].classList.remove("mention");
      i--;
    }
  }
  let replies = document.getElementsByClassName("reply")
  for (let i = 0; i < replies.length; i++) {
    if(replies[i]!=undefined && replies[i].innerText == username) {
      replies[i].style="color: red;"
    }
  }

  document.getElementById("loading").style="display:none;"
  document.getElementById("scriptonly").style = ""
}

function reply(username,postid,posttext) {
  document.getElementById("reply").style = ""
  document.getElementById("reply_username").innerText = username
  document.getElementById("reply_text").innerHTML = filterPost(unescape(posttext))
  // if(document.getElementById("post-text").value.length >= 5)document.getElementById("post-text").value += "\n"
  // document.getElementById("post-text").value += `_@_${username} `
}

function unreply() {
  document.getElementById("reply").style = "display:none;"
  reply_id = 0
}

main()

var cansendNoti = false

async function askNotiPerms() {
  return Notification.requestPermission()
}

async function firstAsk() {
  if(Notification.permission === 'denied' || Notification.permission === 'default') {
    await askNotiPerms()
  }
}

firstAsk()

async function mainNoti(user) {
  if(Notification.permission === 'denied' || Notification.permission === 'default') {
    await askNotiPerms()
  } else {
    if(cansendNoti) {
      let notification = new Notification('ZTH Board', { body: "new message posted from " + user });
      notification = await notification
      console.log(notification);
    }
  }
}

document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === 'visible') {
    cansendNoti = false
  } else {
    cansendNoti = true
  }
});

if(window.location.href.includes("mention=")) {
  document.getElementById("post-text").innerText = `@${decodeURIComponent(window.location.href.split("mention=")[1])} `
}
if(window.location.href.includes("message=")) {
  document.getElementById("post-text").innerText = `${decodeURIComponent(window.location.href.split("message=")[1])} `
}
