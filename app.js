//jshint esversion:6
require('dotenv').config();
const express=require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");
const mongoose=require("mongoose");
const session= require('express-session');
const passport= require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const passportcookie=require("passport-cookie");
// const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const findOrCreate=require("mongoose-findorcreate");
const GoogleStrategy=require("passport-google-oauth20").Strategy;

const app=express();

app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({
    extended:true
}));

app.use(session({
    secret:"Our little secret.",
    resave:false,
    saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDb",{useNewUrlParser:true});
// mongoose.set("useCreateIndex",true); 

const userSchema=new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User =new mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username, name: user.name });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID:  process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
    console.log(profile)
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));


app.get("/",(req,res) => {
 res.render("home");
});

app.get(
    "/auth/google", 
    passport.authenticate("google",{scope: ["profile"]})
);

app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get("/login",(req,res)  => {
    res.render("login");
   });

 app.get("/register",(req,res)  => {
   res.render("register");
});

app.get("/secrets", function(req, res){
    User.find({ "secret": { $ne: null } })
    .then((foundUsers) => {
        if (foundUsers) {
            res.render("secrets", { usersWithSecrets: foundUsers });
        }
    })
    .catch((err) => {
        console.log(err);
    });
});

app.get("/submit", async(req,res) =>{
    res.set('Cache-Control', 'no-store');
    if(req.isAuthenticated()) {
      try {
        const foundUsers = await User.find({secret:{$ne:null}});
        if(foundUsers) {
          res.render("submit", {usersWithSecrets: foundUsers});
        }
      }
  
      catch(err) {
        console.log(err);
      }
    }
 
    else {
        res.redirect("/login");
    }
    
});

app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;
    User.findById(req.user.id)
        .then((foundUser) => {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save()
                    .then(() => {
                        res.redirect("/secrets");
                    });
            } else {
                console.log("User not found");
            }
        })
        .catch((err) => {
            console.log(err);
        });
});

app.post("/register",function (req,res){
 
     User.register({username: req.body.username}, req.body.password,function (err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req,res, function(){
                res.redirect("/secrets");
            });
        }
     });
    
});

    

app.post("/login", (req,res)=>{

    const user = new User({
        username:req.body.username,
        password:req.body.password
    });

    req.login(user, function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function (){
                res.redirect("/secrets");
            })
        }

    })
    
}); 

app.get("/logout", function(req,res){
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect("/");
});
});


app.listen(3000, function(){
   console.log("server running on port 3000");
});