async function uploadFile() {
  let file = document.getElementById("avatarUpl").files[0];
  console.log(file);
  let formdata = new FormData();
  formdata.append("avatar", file);
  let ajax = new XMLHttpRequest();
  ajax.upload.addEventListener("progress", progressHandler, false);
  ajax.addEventListener("load", completeHandler, false);
  ajax.addEventListener("error", errorHandler, false);
  ajax.addEventListener("abort", errorHandler, false);
  ajax.open("POST", "/api/setavatar");
  ajax.send(formdata);

  document.getElementById("avatarUplButton").style = "display:none;";
}

function completeHandler(event) {
  console.log("completed upload");
  console.log(event.target.responseText);
  setuser()
}

function errorHandler(event) {
  console.log("error during upload");
  console.log(event.target.responseText);
}

function progressHandler(event) {
  console.log("progressing upload");
  console.log("Uploaded " + event.loaded + " bytes of " + event.total);
  console.log(event.target.responseText);
}

async function setuser() {
  let user = await (await fetch("/api/getuser")).json();
  let username
  let bio
  let avatar
  username = user["username"];
  bio = user["bio"]
  avatar = user["avatar"]
  if(user["error"])username=user["error"];
  if(user["error"])bio=user["error"];
  if(!bio)bio="wow such empty"
  if(avatar) {
    avatar = "/avatars/"+avatar
  } else {
    avatar = "default_avatar.png"
  }
  document.getElementById("user").innerText = `User: ${username}`;
  document.getElementById("bio").placeholder = decodeURIComponent(bio);
  document.getElementById("avatarimg").src = avatar;
  document.getElementById("avatarUpl").addEventListener("change", function(){
    document.getElementById("avatarUplButton").style = "";
  })
  document.getElementById("avatarUplButton").addEventListener("click",uploadFile);
}

async function bioChanger() {
  document.getElementById("bio").disabled = !document.getElementById("bio").disabled
  document.getElementById("changeBio").innerText = (document.getElementById("bio").disabled && "Change Bio") || "Submit"
  if(document.getElementById("bio").disabled) {
    let response = await sendBio(document.getElementById("bio").value)
    console.log(response);
    document.querySelector('style').innerHTML = '::placeholder {color: white;} #bio {border: 0px solid black; color:white;}'
  }
  else
  {
    document.querySelector('style').innerHTML = '::placeholder {color: white;} #bio {border: 2px solid gray; color:white;}'
  }
}

async function sendBio(str) {
  return await post("/api/setBio",{"Bio":str})
}
