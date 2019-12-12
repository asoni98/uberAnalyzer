// server.js
var express = require('express')
var path = require('path')
var serveStatic = require('serve-static')
var passport = require('passport')
var FirebaseStrategy = require('passport-firebase-auth').Strategy
var firebase = require('firebase')
var app = express()

function isUserAuthenticated(req, res, next) {
  if (req.user) {
    next()
  } else {
    res.redirect('/login')
  }
}
const config = {
  apiKey: 'xxxx',
  authDomain: 'uber-analyzer.firebaseapp.com',
  databaseURL: 'https://uber-analyzer.firebaseio.com',
  projectId: 'uber-analyzer',
  storageBucket: 'xxxx',
  messagingSenderId: 'xxxx',
  appId: 'xxxxx',
  measurementId: 'xxx'
}

firebase.initializeApp({
  serviceAccount: 'xxxx',
  databaseURL: config.databaseURL
})

passport.use(new FirebaseStrategy({
  firebaseProjectId: 'uber-analyzer',
  authorizationURL: 'https://localhost:9528/auth',
  callbackURL: 'https://localhost:9528/auth/firebase/callback'
},
(accessToken, refreshToken, decodedToken, cb) => {
  cb(null, decodedToken)
}
))

app.get('/auth/firebase',
  passport.authenticate('firebaseauth', { }))

app.get('/auth/firebase/callback',
  passport.authenticate('firebaseauth', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    console.log("IT WORKS SERVER!");
    res.redirect('/')
  })

app.use(serveStatic(__dirname + '/dist'))

var port = process.env.PORT || 5000

app.listen(port, () => console.log('Server started; listening on port', port))
