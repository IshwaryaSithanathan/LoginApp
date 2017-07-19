var mongoose = require('mongoose');

// User Schema
var UserInfoSchema = mongoose.Schema({
	name: {
        type: String, 
        ref: 'User' 
	},
	photo: {
		data: Buffer, 
		contentType: String
	},
	dob: {
		type: String
	},
	gender: {
		type: String
	},
	address: {
		type: String
	}
});

var UserInfo = module.exports = mongoose.model('Info', UserInfoSchema);

module.exports.createInfo = function(newUser, callback){
    console.log(newUser);
	newUser.save(callback);
}

module.exports.getUserByUsername = function(username, callback){
	var query = {username: username};
	UserInfo.findOne(query, callback);
}
