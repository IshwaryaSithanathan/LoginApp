var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var passwordValidator = require('password-validator');
var twilio = require('twilio');
var User = require('../models/user');
var UserInfo = require('../models/info');
var jwt = require('jwt-simple'); 
var twilio = require('twilio');
var client = twilio('ACb7dfc073fd2a3e2a40296079700daea4','54e1a6bcc517a3fcd46da8739b16d9e8');
var VoiceResponse = twilio.twiml.VoiceResponse;
var multer = require('multer')
var formidable = require('formidable');

// Register
router.get('/register', function(req, res){
	res.render('register');
});

// Login
router.get('/login', function(req, res){
	res.render('login');
});

router.post('/upload', function(req, res) {
	var uploading = multer({
		dest: __dirname + '../public/uploads/',
		limits: {fileSize: 1000000, files:1},
	})
	console.log(req.file)
	res.render('register');
	res.flash('success_msg','File uploaded');
})
// Register User
router.post('/register', function(req, res){
	var name = req.body.name;
	var email = req.body.email;
	var username = req.body.username;
	var countryCode=req.body.countryCode;
	var password = req.body.password;
	var password2 = req.body.password2;
	var	photo = req.body.photo;
	var dob = new Date(req.body.dob).toISOString().slice(0,10);
	var	gender = req.body.gender;
	var	address = req.body.address;
	// Validation
	req.checkBody('name', 'Name is required').notEmpty();
	req.checkBody('email', 'Email is required').notEmpty();
	req.checkBody('email', 'Email is not valid').isEmail();
	req.checkBody('username', 'Username is required').notEmpty();
	req.checkBody('countryCode', 'Country Code is required').notEmpty();
	req.checkBody('password', 'Password is required').notEmpty();
	req.checkBody('password', 'Password should have min 8 chars, 1 digit, 1 Uppercase, 1 Lowercase, 1 Special character').matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])(?!.*\s).{8,15}$/);
	req.checkBody('dob', 'Date of Birth is required').notEmpty();
	req.checkBody('gender', 'Gender is required').notEmpty();
	req.checkBody('address', 'Address is required').notEmpty();
	req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

	var errors = req.validationErrors();
	var newUser = new User({
			name: name,
			email:email,
			username: username,
			countryCode : countryCode,
			password: password,
			usertype:'user'
		});
		var newUserInfo = new UserInfo({
			name: username,
			photo:photo,
			dob: dob,
			gender: gender,
			address:address
		});
	if(errors){
		res.render('register',{
			errors:errors ,user:newUser, userInfo : newUserInfo
		});
	}else if(req.body.isEdit){
		newUser.update();
		newUserInfo.update();
		req.flash('success_msg', 'User is updated');
		res.redirect('/users/login');
	}else{
		User.getUserByUsername(username, function(err, user){
		if(err) throw err;
		if(user){
			req.flash('error_msg', 'User name already exists');
			res.render('register',{user:newUser});
		}else{
			User.createUser(newUser, function(err, user){
			if(err) throw err;
			console.log(user);
		});

		UserInfo.createInfo(newUserInfo, function(err, user){
			if(err) throw err;
			console.log(user);
		});

		req.flash('success_msg', 'User is registered');

		res.redirect('/users/register');
		}
		});
		
	}
});

passport.use(new LocalStrategy(
  function(username, password, done) {
   User.getUserByUsernameAndAdmin(username, function(err, user){
   	if(err) throw err;
   	if(!user){
   		return done(null, false, {message: 'Unknown User'});
   	}
   	User.comparePassword(password, user.password, function(err, isMatch){
   		if(err) throw err;
   		if(isMatch){
   			return done(null, user);
   		} else {
   			return done(null, false, {message: 'Invalid password'});
   		}
   	});
   });
  }));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.getUserById(id, function(err, user) {
    done(err, user);
  });
});
router.post('/login', passport.authenticate('local', {failureRedirect:'/users/login',failureFlash: true}), function(req, res) {
	User.verifyAuthyToken(req.body.code, postVerify);
    // // Handle verification response
    function postVerify(err) {
        if (err) {
			req.flash('error_msg', 'The token you entered was invalid - please retry');
        }
		// If the token was valid, flip the bit to validate the user account
		else{
			req.flash('success_msg', 'Token is verified');
			User.getUserList(function(err, users){
				if(err) throw err;
				if(!users){
					req.flash('success_msg', 'No results found');
				}
			res.render('userList',{users:users});
		});
		}
	}
})
		
 	//})
	
 //});

router.get('/logout', function(req, res){
	req.logout();

	req.flash('success_msg', 'You are logged out');

	res.redirect('/users/login');
});

// create a new user account (POST http://localhost:8080/app_api/user/)
router.post('/admin', function(request, response) {

    //Collect the body information
    var reqBody = request.body;

    if (!reqBody.username) {
        response.json({
            success: false,
            msg: 'Please pass username'
        });
    } 
    else if (!reqBody.password) {
        response.json({
            success: false,
            msg: 'Please pass password.'
        });
    } else {

        // Create a new user based on form parameters
		User.getUserByUsername(reqBody.username, function(err, user){
			if(err) throw err;
			if(!user){
				return done(null, false, {message: 'Unknown User'});
			}
			User.sendAuthyToken(user,function(err) {
				if (err) {
					response.send({
						success: false,
						msg: err
					});
				} else {
					// Send for verification page
					response.render('login',{msgSent: true,user:user});
				}
			});
		});
	}
});

// Require sms verification (POST http://localhost:8080/app_api/user/:id/verify)
// Handle submission of verification token
router.post( '/verify',function(request, response) {  

    // Load user model
    User.getUserByUsername(request.body.username, function(err, user){
		if(err) throw err;
		if(!user){
			request.flash('error_msg', 'Unknown User');
			//return done(null, false, {message: 'Unknown User'});
		}
        User.verifyAuthyToken(request.body.code, postVerify);
    // Handle verification response
    function postVerify(err) {
        if (err) {
			request.flash('error_msg', 'The token you entered was invalid - please retry');
        }
        // If the token was valid, flip the bit to validate the user account
		request.flash('success_msg', 'Token is verified');
		response.render('login',{user:user,code:request.body.code});
        //user.save(postSave);
    }

    // after we save the user, handle sending a confirmation
    function postSave(err) {
        if (err) {
            return response.send({
                success: true,
                msg: "There was a problem validating your account."
            });
        }else{
			request.flash('verified_msg', 'Token is verified');
		 	response.render('login',{user:user});
		}
    }
 });
});
//Obtain the user token ready for authorisation.
//This splits the header to ensure we are able to obtain the unique parts
getToken = function(headers) {  
    if (headers && headers.authorization) {
        var parted = headers.authorization.split(' ');
        if (parted.length === 2) {
            return parted[1];
        } else {
            return null;
        }
    } else {
        return null;
    }
};
router.post('/call', function(request, response) {
        // This should be the publicly accessible URL for your application
        // Here, we just use the host for the application making the request,
        // but you can hard code it or use something different if need be
        var salesNumber = '+6582614384';
        var url = 'http://' + request.headers.host + '/outbound/' + encodeURIComponent(salesNumber)

        var options = {
		   	to: request.body.phoneNumber,
		   	//to:'+6582614384',
            from: '+14439410947',
            url: url,
        };

        // Place an outbound call to the user, using the TwiML instructions
        // from the /outbound route
        client.calls.create(options)
          .then((message) => {
            console.log(message.responseText);
            response.send({
                message: 'Thank you! We will be calling you shortly.',
            });
          })
          .catch((error) => {
            console.log(error);
            response.status(500).send(error);
          });
	});
		
	// Return TwiML instuctions for the outbound call
    router.post('/outbound/:salesNumber', function(request, response) {
        var salesNumber = request.params.salesNumber;
        var twimlResponse = new VoiceResponse();

        twimlResponse.say('Please press either 1 or 9 followed by #.', { voice: 'alice' });

        twimlResponse.dial(salesNumber);

        response.send(twimlResponse.toString());
	});
	
	router.post('/edit', function(request, response) {
		User.getUserByUsername(request.body.username, function(err, user){
		if(err) throw err;
		if(!user){
			request.flash('error_msg', 'Unknown User');
		}else{
			response.render('/register',{edit:true,user:user});
		}
	})
	})
	router.post('/delete', function(request, response) {
		
	})
module.exports = router;