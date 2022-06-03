async function setuser() {
  let user = await (await fetch("/api/getuser")).json();
  let username
  let bio
  username = user["username"];
  bio = user["bio"]
  if(user["error"])username=user["error"];
  if(user["error"])bio=user["error"];
  if(!bio)bio="wow such empty"
  document.getElementById("user").innerText = `User: ${username}`;
  document.getElementById("bio").placeholder = decodeURIComponent(atob(bio));

}

async function bioChanger() {
  document.getElementById("bio").disabled = !document.getElementById("bio").disabled
  document.getElementById("changeBio").innerText = (document.getElementById("bio").disabled && "Change Bio") || "Submit"
  if(document.getElementById("bio").disabled) {
    document.querySelector('style').innerHTML = '::placeholder {color: white;} #bio {border: 0px solid black}'
  }
  else
  {
    document.querySelector('style').innerHTML = '::placeholder {color: black;} #bio {border: 2px solid gray}'
  }
  if(document.getElementById("bio").disabled) {
    let response = await sendBio(document.getElementById("bio").value)
    console.log(response);
  }
}

async function sendBio(str) {
  return await post("/api/setBio",{"Bio":str})
}
