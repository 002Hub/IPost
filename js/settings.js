function completeHandler(event) {
  console.log("completed upload");
  console.log(event.target.responseText);
  setuser() // skipqc
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

/** 
* upload avatar to the server
* @return {undefined} no return value
*/
function uploadFile() {
  const file = document.getElementById("avatarUpl").files[0];
  console.log(file);
  const formdata = new FormData();
  formdata.append("avatar", file);
  const ajax = new XMLHttpRequest();
  ajax.upload.addEventListener("progress", progressHandler, false);
  ajax.addEventListener("load", completeHandler, false);
  ajax.addEventListener("error", errorHandler, false);
  ajax.addEventListener("abort", errorHandler, false);
  ajax.open("POST", "/api/setavatar");
  ajax.send(formdata);

  document.getElementById("avatarUplButton").style = "display:none;";
}

function logout() {
  location.assign('/logout')
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

/** 
* sets user bio
* @param {string} str - bio to set
* @return {promise} api response
*/
function sendBio(str) {
  if(document.getElementById("bio").placeholder !== str && str !== "") {
    document.getElementById("bio").placeholder = str
    return post("/api/setBio",{"Bio":str}) // skipqc
  }
  return ""
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


async function changePW() {
  if(window.confirm("Are you sure that you want to change your Password?")){
    let re = await (await post("/api/changePW",{"currentPW":document.getElementById("currentPW_pw").value,"newPW":document.getElementById("newPW").value})).json() // skipqc
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
    // skipqc
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

  let r = await(await post("/api/settings",{setting: settingname, value: ACCR})).json() // skipqc

  if(r.status == "error") {
    alert("Couldn't change setting")
    console.log(r.code)
  } else if(r.status == "success") {
    //changed setting
  }
}