async function login() {
    let r = (await post("/login",{
        user: document.getElementById("user").value,
        pass: document.getElementById("pass").value,
        r: REDIRECT_URL
    }))
    if(!r.url.endsWith("/user") && !r.url.endsWith(REDIRECT_URL)) {
        document.getElementById("pass").value = ""
        console.error("login failed")
        alert("Login failed, please make sure you have the right password")
        return;
    }
    window.location = REDIRECT_URL || "/user"
}

let passfield = document.getElementById("pass")
function passkeydown(e) {
    if(e.code === "Enter") {
        login()
    }
}