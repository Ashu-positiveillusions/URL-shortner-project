const express = require('express');
const router = express.Router();
const urlController=require("../controllers/controller")


//URL shortners routes
router.post("/url/shorten", urlController.urlShortener)
router.get("/:urlCode", urlController.getURL)

module.exports=router;