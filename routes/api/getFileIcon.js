import sharp from "sharp"
async function addTextOnImage(text,buf) {
    try {
        let img = await sharp(buf)

        const metadata = await img.metadata()

        const width = metadata.width;
        const height = metadata.height;

        const svgImage = `
        <svg width="${width}" height="${height}">
        <style>
        .title { fill: #001; font-size: 30px; font-weight: bold;}
        </style>
        <text x="50%" y="50%" text-anchor="middle" class="title">${text}</text>
        </svg>
        `;

        return await img
            .composite([
            {
                input: Buffer.from(svgImage),
                top: 0,
                left: 0,
            },
            ]).webp({effort:6}).toBuffer()
    } catch (error) {
        console.log(error);
    }
}

export const setup = function (router, con, server) {
    router.get("/api/getFileIcon/:icon",async function(req,res){
        let path = req.params.icon
        if(path.length > 4) {
            res.status(410).json({"error":"file ending is too long"})
            return;
        }
        addTextOnImage(path,await sharp("./images/empty_file.png").toBuffer()).then(buf => {
            res.set("content-type","image/png")
            res.send(buf)
        })
        /* #swagger.security = [{
            "appTokenAuthHeader": []
        }] */
    })
}