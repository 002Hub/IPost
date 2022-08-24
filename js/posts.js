let username

const wss_server = "wss://ipost.tk"
const wss_port = "443"
const wss_URI = wss_server + ":" + wss_port

var reply_id = 0

var highest_id

var currentChannel = sessionStorage.getItem("lastchannel") || "everyone"

function createElement(s){return document.createElement(s)}

let socket = new WebSocket(wss_URI);
socket.addEventListener("message", async function (event) {
  if(wss_server == event.origin) {
    let data = event.data;
    let ds = JSON.parse(data)
    let message = ds.message
    let item = ds.data
    let username = decodeURIComponent(item.post_user_name)
    if(message == "new_post") {
      await createPost(decodeURIComponent(item.post_user_name),decodeURIComponent(item.post_text),item.post_time,item.post_special_text,highest_id+1,item.post_from_bot,item.post_reply_id,true)
      if(user["username"]!=username)mainNoti(username)

      let highest_known_posts = await (await fetch(`/api/getPostsLowerThan?id=${highest_id+28}&channel=${currentChannel}`)).json()
      for (let i = 0; i < highest_known_posts.length; i++) {
        if(document.getElementById(highest_known_posts[i].post_id) == undefined) {
          main()
          return;
        }
      }
      highest_id++;
    }
  }
})
var posting_id = undefined;
var cd = true //inversed "cooldown"

async function postMessage() {
  let len = document.getElementById("post-text").value.length
  if(len >= 1001) {
    alert(`Your message cant contain more than 1000 characters! (${len})`)
    return
  }
  if(cd && posting_id!=undefined) {
    cd = false
    setTimeout(function(){
      cd = true
    },400)
    let r = await post("/api/post",{"message":document.getElementById("post-text").value,"reply_id":reply_id,"receiver":currentChannel,"pid": posting_id})
    posting_id = undefined
    update_pid()
    if(window.location.href.split("?mention=")[1])location.replace('/posts');
    document.getElementById("post-text").value=""
    unreply()
  } else {
    alert("Please wait a tiny bit before posting again")
  }
}

async function update_pid() {
  let r = await (await fetch("/api/pid")).json()
  console.log("new pid info: ",r)
  if(r.error) {
    //an error occurred
    if(r.error == "you cannot access the api without being logged in") {
      //account error, go to login page
      location.replace("/")
      return
    }

    //possibly more errors coming soon :tm: ?


    return
  }
  posting_id = r.pid
  console.log("Updated pid",posting_id)
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

async function reply_link_clicked(reply_channel,reply_id) {
  console.log("clicked link")
  if(reply_channel != currentChannel) {
    console.log("reply is in another channel")
    switchChannel(reply_channel)
    console.log("switched channel")
    await main()
    console.log("loaded new messages")
    let replied_msg = document.getElementById(reply_id)
    if(replied_msg) {
      console.log("found element")
      replied_msg.scrollIntoView()
    }
  } else {
    let replied_msg = document.getElementById(reply_id)
    if(replied_msg) {
      console.log("found element")
      replied_msg.scrollIntoView()
    }
  }
}

async function createPost(username,text,time,specialtext,postid,isbot,reply_id,add_on_top) {
  if(!specialtext)specialtext=""
  const newDiv = createElement("div");
  const newP = createElement("p");
  const newA = createElement("a");
  const newSpan2 = createElement("span");
  const newSpan3 = createElement("span");
  const avatar = createElement("img");
  const boticon = createElement("img");

  const replyDiv = createElement("div");
  const replyA = createElement("a");
  const replyAvatar = createElement("img");
  const replySpan = createElement("span");
  const replyBr = createElement("br");

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
  newP.innerHTML += `<button onclick="reply(${postid})">Reply to this Post</button>`

  if(reply_id != 0) {
    try {
      const reply_obj = await (await fetch(`/api/getPost?id=${reply_id}`)).json()
      const reply_username = decodeURIComponent(reply_obj.post_user_name)
      const reply_username_text = document.createTextNode(reply_username)
      const reply_text = decodeURIComponent(reply_obj.post_text)
      const reply_channel = reply_obj.post_receiver_name
      replyAvatar.width=10;
      replyAvatar.height=10;
      replyAvatar.classList.add("avatar")
      replyAvatar.src = await getavatar(reply_username)

      replyA.appendChild(replyAvatar)
      replyA.appendChild(reply_username_text)
      replyA.appendChild(spacerTextNode())
      replyA.innerHTML += filterReply(reply_text.replace("\n"," ").substring(0,20))
      replyA.appendChild(replyBr)

      replyA.classList.add("no-link-style")
      // async function onclick(event) {
      //   event.preventDefault()
        
      // }
      // replyDiv.onclick = function() {
      //   reply_link_clicked(reply_channel, reply_id)
      // }

      replyDiv.appendChild(replyA)

      newDiv.appendChild(replyDiv)

      replyDiv.outerHTML = replyDiv.outerHTML.replace(/\>/im,` onclick="reply_link_clicked('${reply_channel}',${reply_id})" \>`)
    } catch (ignored) {
      console.log(ignored)
    }
  }

  newDiv.appendChild(newP)
  newDiv.innerHTML += filterPost(text)
  newDiv.id = postid
  let posts_div = document.getElementById("posts")
  if(add_on_top) {
    posts_div.insertBefore(newDiv, posts_div.children[0]);
  } else {
    posts_div.appendChild(newDiv)
  }
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

  let all_posts = await (await fetch(`/api/getPosts?channel=${currentChannel}`)).json()
  if(!all_posts)return;
  document.getElementById("posts").innerHTML = ""
  highest_id = all_posts[0].post_id
  for(i in all_posts) {
    let item = all_posts[i]
    await createPost(decodeURIComponent(item.post_user_name),decodeURIComponent(item.post_text),item.post_time,item.post_special_text,item.post_id,item.post_from_bot,item.post_reply_id,false)
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
  }

  document.getElementById("loading").style="display:none;"
  document.getElementById("scriptonly").style = ""
}

async function reply(postid) {
  let post = await(await fetch("/api/getPost?id="+postid)).json()
  let username = post.post_user_name
  let posttext = post.post_text
  document.getElementById("reply").style = ""
  document.getElementById("reply_username").innerText = decodeURIComponent(username)
  document.getElementById("reply_text").innerHTML = filterPost(decodeURIComponent(posttext))
  reply_id = postid
}

function unreply() {
  document.getElementById("reply").style = "display:none;"
  reply_id = 0
}

var cansendNoti = false

async function askNotiPerms() {
  return Notification.requestPermission()
}

async function firstAsk() {
  if(Notification.permission === 'denied' || Notification.permission === 'default') {
    await askNotiPerms()
  }
}

async function mainNoti(user) {
  if(Notification.permission === 'denied' || Notification.permission === 'default') {
    await askNotiPerms()
  } else {
    if(cansendNoti) {
      let notification = new Notification('IPost', { body: "new message posted from " + user , tag: "new_post"});
      notification = await notification
      notification.addEventListener("click",function(){
        notification.close()
      })
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

if(window.location.href.includes("mention=")) { //deprecated, use message instead
  document.getElementById("post-text").innerText = `@${decodeURIComponent(window.location.href.split("mention=")[1])} `
}
//TODO: remove mention

if(window.location.href.includes("message=")) {
  document.getElementById("post-text").innerText = `${decodeURIComponent(window.location.href.split("message=")[1])} `
}

function switchChannel(channelname) {
  sessionStorage.setItem("lastchannel", channelname);
  currentChannel = channelname
  socket.send(JSON.stringify({"id":"switchChannel","data":channelname}))
}

async function loadChannels() {
  //        <!-- <p class="channel">- Channel Name -</p> -->

  let tab = document.getElementById("channelTab")
  tab.innerHTML = ""
  for (let i = 0; i < channels.length; i++) {
    let channelname = decodeURIComponent(channels[i].post_receiver_name)
    if(channelname == "")continue;
    let channelp = createElement("p")
    channelp.classList.add("channel")
    let textnode = document.createTextNode(channelname)
    channelp.appendChild(textnode)
    channelp.addEventListener("click",async function(){
      switchChannel(channelname)
      main()

      let settings = await (await fetch("/api/settings")).json()
      console.log(settings)
      if(settings != "null") {
        if(settings.ACCR == false) {
          unreply()
        }
      }
    })
    tab.appendChild(channelp)
  }
}

function init() {
  setInterval(update_pid,30000)
  if(posting_id=="")update_pid()
  main()
  firstAsk()
  loadChannels()
}

init()
