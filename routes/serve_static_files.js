import {existsSync} from "fs"

export const setup = function (router, con, server) {
    const increaseUSERCall = server.increaseUSERCall
    const __dirname = server.dirname
    const dir = __dirname + "/"
    
    router.get("/users/:user",  function (req, res) {
        if (!increaseUSERCall(req, res))
            return;
        res.sendFile(dir + "views/otheruser.html");
    });
    router.get("/css/:file", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(`${__dirname}/css/${request.params.file}`)) {
            response.sendFile(`${__dirname}/css/${request.params.file}`);
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    router.get("/js/:file", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(`${__dirname}/js/${request.params.file}`)) {
            response.sendFile(`${__dirname}/js/${request.params.file}`);
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    router.get("/images/:file", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(`${__dirname}/images/${request.params.file}`)) {
            response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
            response.sendFile(`${__dirname}/images/${request.params.file}`);
        }
        else if(existsSync(`${__dirname}/images/${request.params.file.toLowerCase()}`)){
            response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
            response.sendFile(`${__dirname}/images/${request.params.file.toLowerCase()}`);
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    
    router.get("/user_uploads/:file", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        if (existsSync(`${__dirname}/user_uploads/${request.params.file}`)) {
            response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
            response.sendFile(`${__dirname}/user_uploads/${request.params.file}`);
        }
        else {
            response.status(404).send("no file with that name found");
        }
        return;
    });
    
    router.get("/avatars/:avatar", (request, response) => {
        if (!increaseUSERCall(request, response))
            return;
        response.set('Cache-Control', 'public, max-age=2592000'); //cache it for one month-ish
        if (existsSync(`${__dirname}/avatars/${request.params.avatar}`)) {
            return response.sendFile(`${__dirname}/avatars/${request.params.avatar}`);
        }
        response.status(404).send("No avatar with that name found");
    });
}