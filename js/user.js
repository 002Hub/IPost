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
  document.getElementById("bio").placeholder = decodeURIComponent(bio);

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
