export const setup = function (router, con, server) {

    const increaseUSERCall = server.increaseUSERCall

    router.get("/logout",  function (req, res) {
        if (!increaseUSERCall(req, res))return;
        res.cookie("AUTH_COOKIE", "", { maxAge: 0, httpOnly: true, secure: true });
        res.redirect("/");
    });
}