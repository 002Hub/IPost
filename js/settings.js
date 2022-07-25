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

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function setCookie(cname, cvalue, exdays) {
  const d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function logout() {
  localStorage.setItem("priv_key","")
  localStorage.setItem("decryption_key","")
  location.assign('/logout')
}

async function setuser() {
  if(getCookie("priv_key") != "") {
    localStorage.setItem("priv_key",getCookie("priv_key"))
    setCookie("priv_key","",0)
  }
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
    avatar = "/images/default_avatar.png"
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
    document.getElementById("userstyle").innerHTML = '::placeholder {color: white;} #bio {border: 0px solid black; color:white;}'
  }
  else
  {
    document.getElementById("userstyle").innerHTML = '::placeholder {color: white;} #bio {border: 2px solid gray; color:white;}'
  }
}

async function sendBio(str) {
  if(document.getElementById("bio").placeholder != str && str != "") {
    document.getElementById("bio").placeholder = str
    return await post("/api/setBio",{"Bio":str})
  }
}


async function changePW() {
  if(window.confirm("Are you sure that you want to change your Password?")){
    let re = await (await post("/api/changePW",{"currentPW":document.getElementById("currentPW_pw").value,"newPW":document.getElementById("newPW").value})).json()
    document.getElementById("response_pw").innerText = re["error"] || re["success"]
    document.getElementById("response_pw").style="color:green"
    if(re["error"]) {
      document.getElementById("response_pw").style="color:red"
    }
    document.getElementById("currentPW").value = ""
    document.getElementById("newPW").value = ""

    setuser()
  }
}

async function changeUsername() {
  if(window.confirm("Are you sure that you want to change your Username?")){
    let re = await (await post("/api/changeUsername",{"currentPW":document.getElementById("currentPW_us").value.toString(),"newUsername":document.getElementById("newUsername").value})).json()
    document.getElementById("response_us").innerText = re["error"] || re["success"]
    document.getElementById("response_us").style="color:green"
    if(re["error"]) {
      document.getElementById("response_us").style="color:red"
    }
    document.getElementById("currentPW").value = ""
    document.getElementById("newUsername").value = ""
    setuser()
  }
}


async function setAllowCCR() {
  const ACCR = document.getElementById("ACCR_checkbox").checked
  const settingname = "ACCR" //Allow Cross-Channel reply (see #22 )

  let r = await(await post("/api/settings",{setting: settingname, value: ACCR})).json()

  if(r.status == "error") {
    alert("Couldn't change setting")
    console.log(r.code)
  } else if(r.status == "success") {
    //changed setting
  }
}