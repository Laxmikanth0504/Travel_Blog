//create author api app
const exp=require('express');
const authorApp=exp.Router();
const path = require('path');
const expressAsyncHandler=require('express-async-handler')
const bcryptjs=require('bcryptjs')
const multer = require('multer');
const jwt=require('jsonwebtoken')
const verifyToken=require('../Middlewares/verifyToken')


let authorscollection;
let articlescollection;
//get usercollection app
authorApp.use((req,res,next)=>{
    authorscollection=req.app.get('authorscollection')
    articlescollection=req.app.get('articlescollection')
    next()
})


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  
  const upload = multer({ storage });


//author registration route
authorApp.post('/author',expressAsyncHandler(async(req,res)=>{
    //get user resource from client
    const newUser=req.body;
    //check for duplicate user based on username
    const dbuser=await authorscollection.findOne({username:newUser.username})
    //if user found in db
    if(dbuser!==null){
        res.send({message:"Author existed"})
    }else{
        //hash the password
        const hashedPassword=await bcryptjs.hash(newUser.password,6)
        //replace plain pw with hashed pw
        newUser.password=hashedPassword;
        //create user
        await authorscollection.insertOne(newUser)
        //send res 
        res.send({message:"Author created"})
    }

}))


//author login
authorApp.post('/login',expressAsyncHandler(async(req,res)=>{
    //get cred obj from client
    const userCred=req.body;
    //check for username
    const dbuser=await authorscollection.findOne({username:userCred.username})
    if(dbuser===null){
        res.send({message:"Invalid username"})
    }else{
        //check for password
       const status=await bcryptjs.compare(userCred.password,dbuser.password)
       if(status===false){
        res.send({message:"Invalid password"})
       }else{
    //create jwt token and encode it
        const signedToken=jwt.sign({username:dbuser.username},process.env.SECRET_KEY,{expiresIn:'1d'})
    //send res
        res.send({message:"login success",token:signedToken,user:dbuser})
       }
    }
}))


authorApp.post('/article', upload.single('image'), async (req, res) => {
    const article = {
      title: req.body.title,
      category: req.body.category,
      content: req.body.content,
      dateOfCreation: req.body.dateOfCreation,
      dateOfModification: req.body.dateOfModification,
      articleId: req.body.articleId,
      username: req.body.username,
      comments: JSON.parse(req.body.comments),
      status: req.body.status,
      image: req.file ? req.file.filename : null // Save the filename or path
    };
  
    try {
      let result = await articlescollection.insertOne(article);
      res.json({ message: 'New article created', article });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'An error occurred while creating the article' });
    }
  });

// Assuming 'authorApp' is your Express app instance

// Route to delete the present article and save the modified article
authorApp.put('/article', upload.single('image'), async (req, res) => {
    try {
      // Parse the editedArticle from the request body
      const editedArticle = req.body.editedArticle ? JSON.parse(req.body.editedArticle) : null;
  
      if (!editedArticle) {
        return res.status(400).json({ message: "Invalid article data" });
      }
  
      // If there is an uploaded image, add the filename to editedArticle
      if (req.file) {
        editedArticle.image = req.file.filename;
      }
  
      console.log(editedArticle);
  
      // Remove the present article
      await articlescollection.deleteOne({ articleId: editedArticle.articleId });
  
      // Insert the modified article
      const updatedArticle = await articlescollection.insertOne(editedArticle);
  
      res.status(200).json({ message: "Article modified", article: updatedArticle });
    } catch (error) {
      console.error('Error modifying article:', error);
      res.status(500).json({ message: "Error modifying article" });
    }
  });  

// Route to delete an article
authorApp.delete('/article/:articleId', async (req, res) => {
  const articleFromUrl = req.params.articleId;
  console.log(articleFromUrl)
  let re = await articlescollection.deleteOne({ articleId: articleFromUrl });
  if (re.deletedCount > 0) {
    res.send({ message: "article deleted" });
  } else {
    res.status(404).send({ message: "article not found" });
  }
});



//delete an article by article ID
authorApp.put('/article/:articleId',verifyToken,expressAsyncHandler(async(req,res)=>{
    //get articleId from url
    const artileIdFromUrl=(+req.params.articleId);
    //get article 
    const articleToDelete=req.body;

    if(articleToDelete.status===true){
       let modifiedArt= await articlescollection.findOneAndUpdate({articleId:artileIdFromUrl},{$set:{...articleToDelete,status:false}},{returnDocument:"after"})
       res.send({message:"article deleted",payload:modifiedArt.status})
    }
    if(articleToDelete.status===false){
        let modifiedArt= await articlescollection.findOneAndUpdate({articleId:artileIdFromUrl},{$set:{...articleToDelete,status:true}},{returnDocument:"after"})
        res.send({message:"article restored",payload:modifiedArt.status})
    }
   
   
}))








//read articles of author 
authorApp.get('/articles/:username',verifyToken,expressAsyncHandler(async(req,res)=>{
    //get author's username from url
    const authorName=req.params.username;
    //get atricles whose status is true
    const artclesList=await articlescollection.find({username:authorName}).toArray()
    res.send({message:"List of atricles",payload:artclesList})

}))

//export userApp
module.exports=authorApp;



  