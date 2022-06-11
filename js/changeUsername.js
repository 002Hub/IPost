async function setUser() {
  let user = await (await fetch("/api/getuser")).json()
  //user["username"],user["error"]
  if(user["username"])document.getElementById("username").innerText = `Current User: ${user["username"]}`
  if(user["error"])document.getElementById("username").innerText = `Error: ${user["error"]}`

}

setUser()

async function change(){
  if(window.confirm("Are you sure that you want to change your Username?")){
    let re = await (await post("/api/changeUsername",{"currentPW":document.getElementById("currentPW").value.toString(),"newUsername":document.getElementById("newUsername").value})).json()
    document.getElementById("response").innerText = re["error"] || re["success"]
    document.getElementById("response").style="color:green"
    if(re["error"]) {
      document.getElementById("response").style="color:red"
    }
    document.getElementById("currentPW").value = ""
    document.getElementById("newUsername").value = ""
    setUser()
  }
}

document.getElementById("submit").addEventListener("click",change)
