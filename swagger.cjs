const fs = require('fs');
const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'IPost API',
    description: 'the official IPost.rocks API documentation',
  },
  host: 'ipost.rocks',
  schemes: ['https'],
  securityDefinitions: {
    appTokenAuthHeader: {
      type: 'apiKey',
      in: 'header', // can be 'header', 'query' or 'cookie'
      name: 'ipost-auth-token', // name of the header, query parameter or cookie
      description: 'authenticate using the authentication object in the header'
    }
  }
};

const outputFile = './swagger-api.json';
const tempFile = './swagger-output.json';
const endpointsFiles = ['./server.js'];

function pushdirectory(currentpath) {
  fs.readdirSync(currentpath, {
    withFileTypes: true
  }).forEach(dirent => {
    if (dirent.isFile()) {
      endpointsFiles.push(currentpath + dirent.name);
    } else {
      pushdirectory(currentpath + dirent.name + "/");
    }
  });
}

pushdirectory("./routes/");

swaggerAutogen(tempFile, endpointsFiles, doc);

/*
  Replace some error codes with own error codes, as described in error_codes.txt
*/
const to_replace = {
  "401": "login error (invalid cookie)",
  "402": "login error (bad cookie)",
  "403": "login error (no cookie)",
  
  "410": "argument/data error",
  "411": "argument/data error",
  "412": "argument/data error",
  "413": "argument/data error",
  "414": "argument/data error",
  "415": "argument/data error",
  "416": "argument/data error",
  "417": "argument/data error",
  "418": "argument/data error",
  "419": "argument/data error",
  "420": "invalid authetication object",
  
}

let file = JSON.parse(fs.readFileSync(tempFile, 'utf8'));

for (let path in file.paths) {
  for (let method in file.paths[path]) {
    for (let response in file.paths[path][method].responses) {
      if (to_replace[response]) {
        file.paths[path][method].responses[response].description = to_replace[response];
      }
    }
  }
}

file = JSON.stringify(file);
console.log(file)
fs.writeFileSync(outputFile, file);
fs.rmSync(tempFile);