const express=require("express");
const helmet=require("helmet");
const path=require("path");

const app=express();
const port=process.env.PORT||3000;
const publicDirectory=path.join(__dirname,"public");

app.use(helmet({contentSecurityPolicy:false}));
app.use(express.static(publicDirectory,{extensions:["html"]}));

app.get("/admin",(req,res)=>{
  res.redirect("/");
});

app.use("/api",(req,res)=>{
  res.status(404).json({error:"This portfolio has no API."});
});

app.get("*",(req,res)=>{
  res.sendFile(path.join(publicDirectory,"index.html"));
});

app.listen(port,()=>{
  console.log(`Tahir's portfolio is running at http://localhost:${port}`);
});
