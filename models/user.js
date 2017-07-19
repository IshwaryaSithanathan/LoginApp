var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
// Create authenticated Authy and Twilio API clients
var authy = require('authy')('g19eXcOvMt0HFn2M0hPiwHl1JIvDegMC');  
var twilioClient = require('twilio')('ACb7dfc073fd2a3e2a40296079700daea4','54e1a6bcc517a3fcd46da8739b16d9e8');

// User Schema
var UserSchema = mongoose.Schema({
	username: {
		type: String,
		unique: true,
		required: true,
		index:true
	},
	password: {
		type: String,
		required: true
	},
	email: {
		type: String,
	},
	name: {
		type: String
	},
	usertype: {
		type: String
	},
	authyId: String,
	countryCode: Number
});

var User = module.exports = mongoose.model('User', UserSchema);

module.exports.createUser = function(newUser, callback){
	bcrypt.genSalt(10, function(err, salt) {
	    bcrypt.hash(newUser.password, salt, function(err, hash) {
	        newUser.password = hash;
	        newUser.save(callback);
	    });
	});
}

module.exports.getUserByUsername = function(username, callback){
	var query = {username: username};
	User.findOne(query, callback);
}
module.exports.getUserByUsernameAndAdmin = function(username, callback){
	var query = {username: username,usertype:'admin'};
	User.findOne(query, callback);
}
module.exports.getUserById = function(id, callback){
	User.findById(id, callback);
}
module.exports.getUserList = function(callback){
	User.aggregate([
    {$match : {usertype : 'user'}},
	{$lookup: {from: 'infos',localField: 'username',foreignField: 'name',as: 'info'}}
	], callback);
}
module.exports.comparePassword = function(candidatePassword, hash, callback){
	bcrypt.compare(candidatePassword, hash, function(err, isMatch) {
    	if(err) throw err;
    	callback(null, isMatch);
	});
}

// Send a verification token to the user (two step auth for login)
module.exports.sendAuthyToken = function(user,cb) {  
    var self = user;
	// Register this user if it's a new user
	sendToken();
	// authy.register_user(user.email, user.username, user.countryCode,
	// 	function(err, response) {

	// 		if (err || !response.user) return cb.call(self, err);
	// 		self.authyId = response.user.id;
	// 		self.update(function(err, doc) {
	// 			if (err || !doc) return cb.call(self, err);
	// 			self = doc;
	// 			sendToken();
	// 		});
	// 	});

    // With a valid Authy ID, send the 2FA token for this user
    function sendToken() {
		console.log(self.authyId);
        authy.request_sms(self.authyId, true, function(err, response) {
            cb.call(self, err);
        });
    }
};

// Test a 2FA token
module.exports.verifyAuthyToken = function(otp, cb) {  
	var self = this;
	console.log(self.authyId);
    authy.verify(self.authyId, otp, function(err, response) {
        cb.call(self, err, response);
    });
};

// Send a text message via twilio to this user
module.exports.sendMessage = function(message, cb) {  
    var self = this;
    twilioClient.sendMessage({
        to: self.username,
        from: '+14439410947',
        body: message
    }, function(err, response) {
		console.log(message);
        cb.call(self, err);
    });
};