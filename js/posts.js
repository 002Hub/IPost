let username,reply_id=0,highest_id,currentChannel = sessionStorage.getItem("lastchannel") || "everyone"

const 
wss_server = "wss://ipost.rocks",
wss_port = "443",
wss_URI = wss_server + ":" + wss_port,
decURIComp = decodeURIComponent

function createElement(s){return document.createElement(s)}
function getById(i){return document.getElementById(i)}


let socket = new WebSocket(wss_URI);
socket.addEventListener("message", async function (event) {
  console.log("new websocket message arrived");
  if(wss_server === event.origin) {
    let data = event.data;
    let ds = JSON.parse(data)
    let message = ds.message
    let item = ds.data
    let username = decURIComp(item.post_user_name)
    if(message === "new_post" && decURIComp(item.post_receiver_name) === currentChannel) {
      await createPost(
        username,
        decURIComp(item.post_text),
        item.post_time,
        item.post_special_text,
        item.post_id || (highest_id+1),
        item.post_from_bot,
        item.post_reply_id,
        true,
        item.user_avatar,
        item.files[0],
        item.files[1],
        item.files[2],
        item.files[3],
        item.files[4]
      )
      console.log("created new post");
      if(user["username"] !== username)mainNoti(username)

      let highest_known_posts = await (await fetch(`/api/getPostsLowerThan?id=${highest_id+28}&channel=${currentChannel}`)).json()
      for (let i = 0; i < highest_known_posts.length; i++) {
        if(getById(highest_known_posts[i].post_id) === undefined) {
          main()
          return;
        }
      }
      highest_id++;
    } else {
      console.warn("unknown message")
    }
  } else {
    console.warn("unknown ws origin")
  }
})

socket.addEventListener("open",()=> {
  switchChannel(currentChannel)
})

var cd = true //inversed "cooldown"

let last_called_postMsg = Date.now()

/*
  Tell the api to create a new post with the given information
  previously called "postMessage"
*/
 function postMsg() {
  if((Date.now() - last_called_postMsg) < 100) {
    createModal("slow down there")
    debugger;
    return;
  }
  last_called_postMsg = Date.now()
  let msg = getById("post-text").value
  let len = msg.length
  if(len===0){
    alert("you have to enter a message!")
    return;
  };
  if(len > 1000) {
    alert(`Your message cant contain more than 1000 characters! (${len})`)
    return
  }
  if(encodeURIComponent(msg).length > 3000) {
    alert("Your message is too long! (Too many special characters)")
    return
  }
  if(cd && posting_id !== undefined) {
    cd = false
    setTimeout(function(){
      cd = true
    },400)
    let formdata = new FormData()

    formdata.append("message",msg)
    formdata.append("reply_id",reply_id)
    formdata.append("receiver",currentChannel)
    formdata.append("pid",posting_id)
    for(let i in files) {
      formdata.append("file_"+i,files[i])
    }
    files = []
    getById("filesDiv").innerHTML=""

    fetch("/api/post", {
      method: "POST", body: formdata
    });
    posting_id = undefined
    update_pid()
    getById("post-text").value=""
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
    if(r.error === "you cannot access the api without being logged in") {
      //account error, go to login page
      location.replace("/")
      return
    }
    throw new Error(r.error)
  }
  posting_id = r.pid
  console.log("Updated pid",posting_id)
}

function spacerTextNode() {
  return document.createTextNode(" | ")
}

async function reply_link_clicked(reply_channel,reply_id) {
  console.log("clicked link")
  if(reply_channel !== currentChannel) {
    console.log("reply is in another channel")
    switchChannel(reply_channel)
    console.log("switched channel")
    await main()
    console.log("loaded new messages")
    let replied_msg = getById(reply_id)
    if(replied_msg) {
      console.log("found element")
      replied_msg.scrollIntoView()
    }
  } else {
    let replied_msg = getById(reply_id)
    if(replied_msg) {
      console.log("found element")
      replied_msg.scrollIntoView()
    }
  }
}

const image_types = {
  "png":true,
  "jpg":true,
  "jpeg":true,
  "webp":true,
  "jfif":true
}

function iconLink(name) {
  if(!name){
  //if(typeof name === 'undefined' || typeof name === "null"){
    return undefined;
  }
  console.log(name,name.lastIndexOf("\."),name.substring(name.lastIndexOf("\.")+1));
  let extension = name.substring(name.lastIndexOf("\.")+1)
  if(extension in image_types) {
    return "/user_uploads/previews/"+name;
  }
  return "/api/getFileIcon/"+extension
}

async function createPost(username,text,time,specialtext,postid,isbot,reply_id,add_on_top,avatar_src,file0,file1,file2,file3,file4) {
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

  const newTime = document.createTextNode(new Date(time).toLocaleTimeString())
  const newSpecialText = document.createTextNode(specialtext)
  newDiv.classList.add("post");
  newSpan3.classList.add("specialtext")


  avatar.width=25;
  avatar.height=25;
  avatar.alt = "user avatar"
  avatar.classList.add("avatar")
  if(avatar_src)avatar.src = "/avatars/"+avatar_src
  else {
    avatar.src = "/images/default_avatar.png"
  }

  newA.appendChild(avatar)
  newA.appendChild(newUsername)

  newA.href = `/users/${username}`
  newSpan2.appendChild(newTime)
  newSpan3.appendChild(newSpecialText)


  newP.appendChild(newA)
  newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan2)
  if(specialtext !== "")newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan3)
  if(isbot === 1){
    newP.appendChild(spacerTextNode())
    newP.appendChild(boticon)
  }
  newP.appendChild(spacerTextNode())
  // |\>.</|
  newP.innerHTML += `<button onclick="reply(${postid})">Reply to this Post</button>`

  if(reply_id !== 0) {
    try {
      const reply_obj = await (await fetch(`/api/getPost?id=${reply_id}`)).json()
      const reply_username = decURIComp(reply_obj.post_user_name)
      const reply_username_text = document.createTextNode(reply_username)
      const reply_text = decURIComp(reply_obj.post_text)
      const reply_channel = reply_obj.post_receiver_name
      replyAvatar.width=10;
      replyAvatar.height=10;
      replyAvatar.classList.add("avatar")

      if(reply_obj.User_Avatar)replyAvatar.src = "/avatars/"+reply_obj.User_Avatar
      else {
        replyAvatar.src = "/images/default_avatar.png"
      }

      replyA.appendChild(replyAvatar)
      replyA.appendChild(reply_username_text)
      replyA.appendChild(spacerTextNode())
      replyA.innerHTML += filterReply(reply_text.replace("\n"," ").substring(0,20))
      replyA.appendChild(replyBr)

      replyA.classList.add("no-link-style")

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

  /*
    FILES
  */

  const filesP = createElement("p")
  const file0_img = createElement("img")
  const file1_img = createElement("img")
  const file2_img = createElement("img")
  const file3_img = createElement("img")
  const file4_img = createElement("img")
  
  file0_img.src = iconLink(file0)
  file1_img.src = iconLink(file1)
  file2_img.src = iconLink(file2)
  file3_img.src = iconLink(file3)
  file4_img.src = iconLink(file4)

  file0_img.width = 50
  file1_img.width = 50
  file2_img.width = 50
  file3_img.width = 50
  file4_img.width = 50

  file0_img.alt = "user uploaded file"
  file1_img.alt = "user uploaded file"
  file2_img.alt = "user uploaded file"
  file3_img.alt = "user uploaded file"
  file4_img.alt = "user uploaded file"

  if(file0){
    filesP.appendChild(file0_img)

    file0_img.onclick = function(event) {
      console.warn("TODO: Create Modal");
    }
  }
  if(file1){
    filesP.appendChild(file1_img)

    file1_img.onclick = function(event) {
      console.warn("TODO: Create Modal");
    }
  }
  if(file2){
    filesP.appendChild(file2_img)

    file2_img.onclick = function(event) {
      console.warn("TODO: Create Modal");
    }
  }
  if(file3){
    filesP.appendChild(file3_img)

    file3_img.onclick = function(event) {
      console.warn("TODO: Create Modal");
    }
  }
  if(file4){
    filesP.appendChild(file4_img)

    file4_img.onclick = function(event) {
      console.warn("TODO: Create Modal");
    }
  }
  newDiv.appendChild(filesP)

  /*
    Adding the post to the posts list
  */

  let posts_div = getById("posts")
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
      user = undefined
      getById("noaccount").style=""
      getById("loading").style="display:none;"
      console.log("no account");
      return;
    }
  }
  username = user.username
  getById("username-self").innerText = username

  let all_posts = await (await fetch(`/api/getPosts?channel=${currentChannel}`)).json()
  if(!all_posts)return;
  getById("posts").innerHTML = ""

  getById("loading").style="display:none;"
  getById("scriptonly").style = ""

  highest_id = all_posts[0].post_id
  let post_promises = []
  for(i in all_posts) {
    let item = all_posts[i]
    let created = createPost(
      decURIComp(item.post_user_name),
      decURIComp(item.post_text),
      item.post_time,
      item.post_special_text,
      item.post_id,
      item.post_from_bot,
      item.post_reply_id,
      false,
      item.User_Avatar,
      item.file_0,
      item.file_1,
      item.file_2,
      item.file_3,
      item.file_4
      )
    post_promises.push(created)
  }

  await Promise.all(post_promises)

  Array.from(getById("posts").childNodes).sort((a,b) => {
    if(Number(a.id) > Number(b.id))return -1;
    if(Number(a.id) < Number(b.id))return 1;
    return 0
  }).forEach(e => {
    getById("posts").appendChild(e)
  })

  let links = document.getElementsByClassName("insertedlink")
  for (let i = 0; i < links.length; i++) {
    links[i].innerText = links[i].innerText.split("\/\/")[1].split("\/")[0]
  }

  let mentions = document.getElementsByClassName("mention")
  for (let i = 0; i < mentions.length; i++) {
    if(mentions[i] !== undefined && mentions[i].innerText === "@"+username) {
      mentions[i].classList.add("user-mention");
      mentions[i].classList.remove("mention");
      i--;
    }
  }

  
}

async function reply(postid) {
  let post = await(await fetch("/api/getPost?id="+postid)).json()
  let username = post.post_user_name
  let posttext = post.post_text
  getById("reply").style = ""
  getById("reply_username").innerText = decURIComp(username)
  getById("reply_text").innerHTML = filterPost(decURIComp(posttext))
  reply_id = postid
}

function unreply() {
  getById("reply").style = "display:none;"
  reply_id = 0
}

var cansendNoti = false

 function askNotiPerms() {
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

if(window.location.href.includes("message=")) {
  getById("post-text").innerText = `${decURIComp(window.location.href.split("message=")[1])} `
}

function switchChannel(channelname) {
  sessionStorage.setItem("lastchannel", channelname);
  currentChannel = channelname
  socket.send(JSON.stringify({"id":"switchChannel","data":channelname}))
}

 function loadChannels() {
  //        <!-- <p class="channel">- Channel Name -</p> -->

  let tab = getById("channelTab")
  tab.innerHTML = ""
  for (let i = 0; i < channels.length; i++) {
    let channelname = decURIComp(channels[i])
    if(channelname === "")continue;
    let channelp = createElement("p")
    channelp.classList.add("channel")
    let textnode = document.createTextNode(channelname)
    channelp.appendChild(textnode)
    channelp.addEventListener("click",async function(){
      switchChannel(channelname)
      main()

      let settings = await (await fetch("/api/settings")).json() // skipqc
      console.log(settings) // skipqc
      if(settings !== "null") {
        if(settings.ACCR === false) {
          unreply()
        }
      }
    })
    tab.appendChild(channelp)
  }
}

var files = []

function addFile(file) {
  if(file.size > 1_000_000) {
    alert("that file is too large, max size: 1MiB")
    console.log("file is too big: ", file.name, file.type, file.size);
    return;
  }
  if(files.length >= 5) {
    console.log("too many files already: ", files);
    return;
  }
  files[files.length]=file
  const fileimg = createElement("img")
  console.log(file.name,file.name.lastIndexOf("\."),file.name.substring(file.name.lastIndexOf("\.")+1));
  fileimg.src = "/api/getFileIcon/"+file.name.substring(file.name.lastIndexOf("\.")+1)

  getById("filesDiv").appendChild(fileimg)
  //filesDiv
  console.log("File added: ", file.name, file.type, file.size);
}

function dropHandler(ev) {
  console.log("file dropped");

  ev.preventDefault();

  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    [...ev.dataTransfer.items].forEach((item, i) => {
      // If dropped items aren't files, reject them
      if (item.kind === 'file') {
        const file = item.getAsFile();
        addFile(file)
      }
    });
  } else {
    // Use DataTransfer interface to access the file(s)
    [...ev.dataTransfer.files].forEach((file, i) => {
      addFile(file)
    });
  }
}

function init() {
  setInterval(update_pid,30000)
  if(posting_id==="")update_pid()
  main()
  firstAsk()
  loadChannels()
}

init()
