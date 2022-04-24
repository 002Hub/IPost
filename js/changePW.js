async function setUser() {
  let user = await (await fetch("/api/getuser")).json()
  //user["username"],user["error"]
  if(user["username"])document.getElementById("username").innerText = `Current User: ${user["username"]}`
  if(user["error"])document.getElementById("username").innerText = `Error: ${user["error"]}`

}

setUser()

document.getElementById("submit").addEventListener("click",async function(){
  if(window.confirm("Are you sure that you want to change your Password?")){
    let re = await (await post("/api/changePW",{"currentPW":document.getElementById("currentPW").value,"newPW":document.getElementById("newPW").value})).json()
    document.getElementById("response").innerText = re["error"] || re["success"]
    document.getElementById("response").style="color:green"
    if(re["error"]) {
      document.getElementById("response").style="color:red"
    }
    document.getElementById("currentPW").value = ""
    document.getElementById("newPW").value = ""
  }
})
