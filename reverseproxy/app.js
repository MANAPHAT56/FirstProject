const express=require("express");
const os =require("os");
const app=express();
app.use("/",async (req,res)=>{
  res.json({message:"Response from: ",hostname:`${os.hostname}`})
})
app.listen(3000,()=>{
    console.log("HI iamrunning");
})