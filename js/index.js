window.addEventListener("load",async function(){
  let data = await(await fetch("/api/getuser")).json()
  if(data["username"] != undefined) {
    document.getElementById("HasAccount").style=""
  } else {
    document.getElementById("NoAccount").style=""
    document.getElementById("hide_user").style="display:none;"
    document.getElementById("hide_posts").style="display:none;"

  }
})
