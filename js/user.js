function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) ===' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
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
  if(getCookie("priv_key") !== "") {
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
  document.getElementById("userBio").innerText = "Bio: " + decodeURIComponent(bio);
  document.getElementById("avatarimg").src = avatar;
}
