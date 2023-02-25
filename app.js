require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended : true}));

app.use(session ({
    secret : "Our little secret.",
    resave : false,
    saveUninitialized : false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("strictQuery", false);
mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser : true
});

const userSchema = new mongoose.Schema({
    email : String,
    password : String,
    googleId : String,
    secret : String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

// create a local login strategy
passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});
  
passport.deserializeUser(function(id, cb) {
    User.findById(id, (err, user) => {
        cb(err, user);
    })
});

const GoogleStrategy = require("passport-google-oauth2").Strategy;

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    passReqToCallback   : true,
    userProfileURL : "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(request, accessToken, refreshToken, profile, done) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/auth/google", passport.authenticate("google", { scope: [ "profile" ]}));

app.get( "/auth/google/secrets",
    passport.authenticate( "google", {
        failureRedirect: "/login"
    }), 
    (req, res) => {
        res.redirect("/secrets");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/secrets", (req, res) => {
    User.find({"secret" : {$ne : null}}, (err, foundUsers) => {
        if(err){
            console.log(err);
        }
        else{
            res.render("secrets", {
                usersWithSecrets : foundUsers
            })
        }
    });
});

app.get("/submit", (req, res) => {
    if(req.isAuthenticated()){
        res.render("submit");
    }
    else{
        res.redirect("/login");
    }
});

app.post("/submit", (req, res) => {
    const submittedSecret = req.body.secret;

    //check for user
    User.findById(req.user.id, (err, foundUser) => {
        if(err){
            console.log(err);
        }
        else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save();
                res.redirect("/secrets");
            }
        }
    });


});

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if(err){
            console.log(err);
        }
        else{
            res.redirect("/");
        }
    });
});

app.post("/register", (req, res) => {
    User.register({username : req.body.username}, req.body.password, (err, user) => {
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/login", (req, res) => {
    const user = new User({
        username : req.body.username,
        password : req.body.password
    });

    //login comes from passport
    req.login(user, (err) => {
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            });
        }
    });
});



app.listen(3000, () => {
    console.log("App running at 3000 port.");
});