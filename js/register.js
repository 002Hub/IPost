async function register() {
    if(document.getElementById("pass").value.length < 10) {
        alert("Password has to be at least 10 characters long")
        return;
    }
    if(document.getElementById("user").value.length > 25) {
        alert("Username is too long!")
        return;
    }
    if(document.getElementById("user").value.search("@") != -1) {
        alert("User cannot contain '@' character!")
        return;
    }
    let r = (await post("/register",{
        user: document.getElementById("user").value,
        pass: document.getElementById("pass").value,
        r: REDIRECT_URL
    }))
    if(!r.url.endsWith("/user?success=true") && !r.url.endsWith(REDIRECT_URL)) {
        if(r.url.endsWith("already_exists")) {
            alert("An account with that name already exists! Did you mean to login?")
            return
        }
        //fallback
        document.getElementById("pass").value = ""
        console.error("registration failed")
        alert("Registration failed")
        return;
    }
    window.location = REDIRECT_URL || "/user"
}

function passkeydown(e) {
    if(e.code == "Enter") {
        register()
    }
}