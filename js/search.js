const valuetoText = {
  ["user"]:"Username",
  ["post"]:"Post"
}

function changed() {
  document.getElementById("selector").placeholder = valuetoText[document.getElementById("type").value];
}

async function getJSON(url) {
    return await(await fetch(url)).json()
}

async function submit() {
  const type = document.getElementById("type").value
  const selector = document.getElementById("selector").value
  document.getElementById("output").innerHTML=""
  const res = await getJSON(`/api/search?type=${type}&selector=${selector}`)
  //document.getElementById("output").innerHTML = res
  console.log(res);
  for (let i = 0; i < res.length; i++) {
    let obj = res[i]
    if(type=="user") {
      createPost(obj.User_Name,obj.User_Bio || "wow such empty",0)
    } else {
      createPost(decodeURIComponent(obj.post_user_name),decodeURIComponent(obj.post_text),obj.post_time,obj.post_special_text,obj.post_id)
    }
  }
}

function keydown(event) {
  if (event.key === "Enter") {
    event.preventDefault()
      submit()
  }
}

function spacerTextNode() {
  return document.createTextNode(" | ")
}

function createPost(username,text,time,specialtext,postid) {
  if(!specialtext)specialtext=""
  const newDiv = document.createElement("div");
  const newP = document.createElement("p");
  const newA = document.createElement("a");
  const newSpan2 = document.createElement("span");
  const newSpan3 = document.createElement("span");

  const newUsername = document.createTextNode(username);
  let timedate = new Date(time)
  time = timedate
  time = time.toString()
  time = time.split(" ")
  time = time[0] + " " + time[1] + " " + time[2] + " " + time[3] + " " + time[4]
  if(timedate=="Thu Jan 01 1970 01:00:00 GMT+0100 (Central European Standard Time)")time=""
  const newTime = document.createTextNode(time)
  const newSpecialText = document.createTextNode(specialtext)

  newDiv.classList.add("result");
  newSpan3.classList.add("specialtext")

  newA.appendChild(newUsername)

  newA.href = `/users/${username}`
  newSpan2.appendChild(newTime)
  newSpan3.appendChild(newSpecialText)


  newP.appendChild(newA)
  if(time != "")newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan2)
  if(specialtext != "" && time != "")newP.appendChild(spacerTextNode())
  newP.appendChild(newSpan3)

  newDiv.appendChild(newP)
  newDiv.innerHTML += filterPost(text)
  newDiv.id = postid
  document.getElementById("output").appendChild(newDiv)
}
