socket = new WebSocket("wss://ws.zerotwohub.tk:25566");
socket.addEventListener("message", function (event) {
  let data = event.data;
  let ds = data.split(" ")
  let message = ds[0]
  console.log(data,ds);
  if(message == "new_post") {
    main()
    mainNoti(ds[1])
  }
})
function urlify(text) {
  let urlRegex = /(([a-z]+:\/\/)?(([a-z0-9\-]+\.)+([a-z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal|tk|ga))(:[0-9]{1,5})?(\/[a-z0-9_\-\.~]+)*(\/([a-z0-9_\-\.]*)(\?[a-z0-9+_\-\.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/gi
  return text.replace(urlRegex,'<a href="$1">$1</a> ')
}
function filterMentions(text) {
  let mentionRegex = /(@[^\s]*)/gi
  return text.replace(mentionRegex,'<span class="mention">$1</span> ')
}
document.getElementById("post-btn").addEventListener("click",async function() {
  if(document.getElementById("post-text").value.length >= 1001) {
    alert("Error, your message cant contain more than 1000 characters!")
    return
  }
  let r = await post("/api/post",{"message":document.getElementById("post-text").value})
  document.getElementById("post-text").value = ""
})
function filterPost(text) {
  text = escape(text)
  text = urlify(text)
  text = filterMentions(text)
  return text
}
function createPost(username,text,time,specialtext) {
  if(specialtext){
    specialtext = ` | ${specialtext}`
  } else {
    specialtext = ""
  }
  const newDiv = document.createElement("div");
  const newP = document.createElement("p");
  const newSpan = document.createElement("span");
  const newSpan2 = document.createElement("span");
  const newSpan3 = document.createElement("span");


  //const newText = document.createTextNode(text);
  const newUsername = document.createTextNode(username);
  let timedate = new Date(time)
  time = timedate
  time = time.toString()
  time = time.split(" ")
  time = time[0] + " " + time[1] + " " + time[2] + " " + time[3] + " " + time[4]
  if(timedate=="Thu Jan 01 1970 01:00:00 GMT+0100 (Central European Standard Time)")time="unknown time"
  const newTime = document.createTextNode(` | ${time}`)
  const newSpecialText = document.createTextNode(specialtext)

  newDiv.classList.add("post");
  newSpan3.classList.add("specialtext")

  newSpan.appendChild(newUsername)
  newSpan2.appendChild(newTime)
  newSpan3.appendChild(newSpecialText)

  newP.appendChild(newSpan)
  newP.appendChild(newSpan2)
  newP.appendChild(newSpan3)


  newDiv.appendChild(newP)
  newDiv.innerHTML += filterPost(text)
  //newDiv.appendChild(newText)

  document.getElementById("posts").appendChild(newDiv)

}

async function main() {
  let user = await (await fetch("/api/getuser")).json()
  let username = user.username
  if(!username)username = user.error
  document.getElementById("username-self").innerText = username

  let index = 0
  let last_10_posts = await (await fetch(`/api/getPosts/${index}`)).json()
  if(!last_10_posts)return;
  document.getElementById("posts").innerHTML = ""
  last_10_posts.forEach((item, i) => {
    console.log(item,i);
    createPost(item.post_user_name,item.post_text,item.post_time,item.post_special_text)
  });
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
}

main()

var cansendNoti = false

async function askNotiPerms() {
  return Notification.requestPermission()
}

async function mainNoti(user) {
  if(Notification.permission === 'denied' || Notification.permission === 'default') {
    await askNotiPerms()
    console.log("asked for perms");
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
