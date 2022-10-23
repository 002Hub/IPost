async function login() {
    let r = (await post("/login",{
        user: document.getElementById("user").value,
        pass: document.getElementById("pass").value
    }))
    if(!r.url.endsWith("/user")) {
        document.getElementById("pass").value = ""
        console.error("login failed")
        alert("Login failed, please make sure you have the right password")
        return;
    }
    window.location = "/user"
}

let passfield = document.getElementById("pass")
function passkeydown(e) {
    if(e.code == "Enter") {
        login()
    }
}