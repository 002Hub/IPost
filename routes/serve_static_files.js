import {existsSync} from "fs"

export const setup = function (router, con, server) {
    const increaseUSERCall = server.increaseUSERCall
    const __dirname = server.dirname
    const dir = __dirname + "/"
    
    router.get("/users/*",  function (req, res) {
        if (!increaseUSERCall(req, res))
            return;
        res.sendFile(dir + "views/otheruser.html");
    });
    router.get("/css/*", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(__dirname + request.originalUrl)) {
            response.sendFile(__dirname + request.originalUrl);
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    router.get("/js/*", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(__dirname + request.originalUrl)) {
            response.sendFile(__dirname + request.originalUrl);
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    router.get("/images/*", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(__dirname + request.originalUrl)) {
            response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
            response.sendFile(__dirname + request.originalUrl);
        }
        else if(existsSync(__dirname + request.originalUrl.toLowerCase())){
            response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
            response.sendFile(__dirname + request.originalUrl.toLowerCase());
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    
    router.get("/user_uploads/*", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(__dirname + request.originalUrl)) {
            response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
            response.sendFile(__dirname + request.originalUrl);
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    
    router.get("/avatars/*", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
        let originalUrl = request.originalUrl.split("?").shift();
        if (existsSync(dir + originalUrl)) {
            return response.sendFile(dir + originalUrl);
        }
        response.status(404).send("No avatar with that name found");
    });
}