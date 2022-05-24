const urlModel=require("../models/urlModel")
const nanoId=require('nanoid');
const { findOne } = require("../models/urlModel");
const redis = require("redis");
const { promisify } = require("util");
const validUrl = require('valid-url');



//Connect to redis
const redisClient = redis.createClient(
18800,
"redis-18800.c264.ap-south-1-1.ec2.cloud.redislabs.com",
{ no_ready_check: true }
);
redisClient.auth("FGpuu4MNu9eKD5N1RwraHBXr0DG5fWU2", function (err) {
if (err) throw err;
});

redisClient.on("connect", async function () {
console.log("Connected to Redis..");
});

//1. connect to the server
//2. use the commands :

//Connection setup for redis
const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);




const urlShortener = async function(req,res){
try{
    let longUrl=req.body.longUrl; 

    // If body is empty 
    if(Object.keys(req.body).length==0) return res.status(400).send({status: false, message: "Please Provide a Long URL"}) 
    
    //removing spaces from url input
    longUrl=longUrl.trim();
    if(!longUrl) return res.status(400).send({status: false, message: "Please Provide a Long URL"})  

    //function to check valid url  
    if (!(validUrl.isUri(longUrl))) return res.status(400).send({status: false, message: "Please Enter a Valid URL"}) 

    //checking if longUrl exists in redis should return the same response
    let cahcedLongUrl = await GET_ASYNC(`${longUrl}`)   
    if(cahcedLongUrl) {
        let parsedData=JSON.parse(cahcedLongUrl)
        let returnData = {longUrl: parsedData.longUrl, shortUrl: parsedData.shortUrl,urlCode: parsedData.urlCode,}
        if(longUrl==parsedData.longUrl)  return res.status(200).send({status: true, data:returnData})         
    }
    //checking if longUrl exists db and should return the same response/mongo doc
    let checkUrl=await urlModel.findOne({longUrl}).select({_id:0, longUrl:1, shortUrl:1, urlCode:1})
    if(checkUrl){
        await SET_ASYNC(`${longUrl}`, JSON.stringify(checkUrl),"EX", 30)//setting value in cache memory
        return res.status(200).send({status: true, data:checkUrl}) 
    }

    let baseUrl="http://localhost:3000/" 

    //random integer Id/code generation
    let code=nanoId.nanoid()//A tiny, secure, URL-friendly, unique string ID generator for js
    let code1=""  
    for (let i = 0; i < code.length; i++) {
        //charCodeAt() method returns an integer between 0 and 65535 representing the UTF-16 code unit at the given index
        code1 += code[i].charCodeAt(0);
    }
    
    //function to shorten url
    let urlCodeToShortURL=function (n){//n=random integer id generated from above 
    // Map to store 62 possible characters
    let map = "abcdefghijklmnopqrstuvwxyzABCDEF"
    "GHIJKLMNOPQRSTUVWXYZ0123456789";
    let shorturl = [];    
        while (n){
            // use above map to store actual character
            // in short url
            shorturl.push(map[n % 62]);// Convert given integer id to a base 62 number
            n = Math.floor(n / 62);
        }
    // Reverse shortURL to complete base conversion
    shorturl.reverse();
    return shorturl.join("");
    }
    let urlCode = urlCodeToShortURL(code1)
    urlCode=urlCode.toLowerCase();

    let urldata = {longUrl:longUrl, shortUrl:baseUrl+urlCode, urlCode:urlCode};
    let data = await urlModel.create(urldata)
    let data1={longUrl:data.longUrl,shortUrl:data.shortUrl,urlCode:data.urlCode}

    await SET_ASYNC(`${urlCode}`, JSON.stringify(data),"EX", 30)//expiry time 30 seconds
    await SET_ASYNC(`${longUrl}`, JSON.stringify(data),"EX", 30)
    return res.status(201).send({status:true, data:data1})
}catch(error){
    return res.status(500).send({status:false, Error:error.message})  
}
}



const getURL= async function(req,res){
try{
    let urlCode=req.params.urlCode
    let cahcedUrlCode = await GET_ASYNC(`${urlCode}`)   
    if(cahcedUrlCode) {
        let parsedUrlCode=JSON.parse(cahcedUrlCode)
        res.redirect(302, parsedUrlCode.longUrl)
    } else {
        let urlData = await urlModel.findOne({urlCode}).select({longUrl:1,shortUrl:1,urlCode:1,_id:0});
        if(!urlData) return res.status(400).send({status: true, message: "Invalid Urlcode."})
        await SET_ASYNC(`${urlCode}`, JSON.stringify(urlData), "EX", 30)//expiry time 30 seconds 
        return res.redirect(302, urlData.longUrl)
    }
    

}catch(error){
    return res.status(500).send({status:false, Error:error.message})  
}
}

module.exports.urlShortener=urlShortener;
module.exports.getURL=getURL;