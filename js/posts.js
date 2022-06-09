let user
let username

let socket = new WebSocket("wss://ws.zerotwohub.tk:25566");
socket.addEventListener("message", function (event) {
  if("wss://ws.zerotwohub.tk:25566" == event.origin) {

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
  let r = await post("/api/post",{"message":document.getElementById("post-text").value})
  if(window.location.href.split("?mention=")[1])location.replace('/posts');
  document.getElementById("post-text").value=""
}

document.getElementById("post-btn").addEventListener("click",postMessage)

function spacerTextNode() {
  return document.createTextNode(" | ")
}

function createPost(username,text,time,specialtext,postid) {
  if(!specialtext)specialtext=""
  const newDiv = document.createElement("div");
  const newP = document.createElement("p");
  const newA = document.createElement("a");
  const newSpan2 = document.createElement("span");
  const newSpan3 = document.createElement("span");

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

  newA.appendChild(newUsername)

  newA.href = `/users/${username}`
  newSpan2.appendChild(newTime)
  newSpan3.appendChild(newSpecialText)


  newP.appendChild(newA)
  newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan2)
  if(specialtext != "")newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan3)
  newP.appendChild(spacerTextNode())
  // |\>.</|
  newP.innerHTML += `<button onclick="reply('${username}')">Reply to this Post</button>`

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

  let index = 0
  let last_10_posts = await (await fetch(`/api/getPosts/${index}`)).json()
  if(!last_10_posts)return;
  document.getElementById("posts").innerHTML = ""
  last_10_posts.forEach((item, i) => {
    createPost(decodeURIComponent(item.post_user_name),decodeURIComponent(item.post_text),item.post_time,item.post_special_text,item.post_id)
  });

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

function reply(username) {
  if(document.getElementById("post-text").value.length >= 5)document.getElementById("post-text").value += "\n"
  document.getElementById("post-text").value += `_@_${username} `
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
