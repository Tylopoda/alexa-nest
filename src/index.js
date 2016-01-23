/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This simple sample has no external dependencies or session management, and shows the most basic
 * example of how to create a Lambda function for handling Alexa Skill requests.
 *
 * Examples:
 * One-shot model:
 *  User: "Alexa, ask Nest status"
 *  Alexa: "The temperature downstairs is 55. The temperature is set to 60. The temperature upstairs is 58. The temperature is set to 55!"
 */

/**
 * App ID for the skill
 */
var APP_ID = "amzn1.echo-sdk-ams.app.4044d8a9-6598-4cdf-9be3-38ed4de66b8d"; //replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

var https = require('https');
var url = require('url');

/**
 * NestSkill is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var NestSkill = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
NestSkill.prototype = Object.create(AlexaSkill.prototype);
NestSkill.prototype.constructor = NestSkill;

NestSkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("NestSkill onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

NestSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("NestSkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId + ", accessToken: " + session.user.accessToken);
    var speechOutput = "Say Status, or Set Temperature Upstairs to 65";
    var repromptText = "Say Status, or Set Temperature Upstairs to 65";
    response.ask(speechOutput, repromptText);
};

NestSkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("NestSkill onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

NestSkill.prototype.intentHandlers = {
    // register custom intent handlers
    "StatusIntent": function (intent, session, response) {
    	if(!session.user.accessToken) { 
    		response.tellWithLinkAccount("You must have a Nest account to use this skill. Please use the Alexa app to link your Amazon account with your Nest Account.");
    	} else { 
			getNestFromServer(session.user.accessToken, function(body) {
				console.log("Status onResponse from nest: " + body);
				var bod = JSON.parse(body);
				var responseString = "";
				for (i in bod) { 
					console.log(i); 
					var val = bod[i]; 
					console.log(val.name);
					
					console.log("name", val.name);
					console.log("target temp", val.target_temperature_f);
					console.log("current temp", val.ambient_temperature_f);
					
					responseString += "The temperature " + val.name + " is " + val.ambient_temperature_f + ". The temperature is set to " + val.target_temperature_f + ". ";
				}
				
				response.tellWithCard(responseString, "Greeter", responseString);
			}, function() {
				response.tellWithLinkAccount("You must have a Nest account to use this skill. Please use the Alexa app to link your Amazon account with your Nest Account.");
			});
    	}
        
    },
    "SetTempIntent": function (intent, session, response) {
    	if(!session.user.accessToken) { 
    		response.tellWithLinkAccount("You must have a Nest account to use this skill. Please use the Alexa app to link your Amazon account with your Nest Account.");
    	} else { 

			var temperatureSlot = intent.slots.temperature;
			var temperature = 0;
			if (temperatureSlot && temperatureSlot.value) {
		        	temperature = temperatureSlot.value;
			}
			
			var thermostatSlot = intent.slots.thermostat;
			var thermostat = "";
			if (thermostatSlot && thermostatSlot.value) {
				thermostat = thermostatSlot.value;
			}
			
			setNestTemperatureFromServer(thermostat, session.user.accessToken, function(body) {
				console.log("SetTemp onResponse from nest: " + body);
				
				setNestTemperatureOnDeviceFromServer(body.device_id, temperature, session.user.accessToken, function(body) {
					console.log("SetTempDevice onResponse from nest: " + body);
					
					response.tellWithCard("Set Temperature " + thermostat + " to " + temperature + ".", "Greeter", "Set temperature " + thermostat + " to " + temperature + ".");
				}, function() {
					response.tellWithLinkAccount("You must have a Nest account to use this skill. Please use the Alexa app to link your Amazon account with your Nest Account.");
				});
			}, function() {
				response.tellWithLinkAccount("You must have a Nest account to use this skill. Please use the Alexa app to link your Amazon account with your Nest Account.");
			});
		}
		
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can ask me status, or set the temperature on a thermostat", "You can ask me status, or set the temperature on a thermostat");
    }
};

function doRequest(options, eventCallback, requestNo, data, onUnAuthCallback) {
	console.log("calling ", options.path);
	if(requestNo > 5) {
		console.log("too many redirects");
		return;
	}
	  
	  var req = https.request(options, function(res) {
			var body = '';
			var redirect = false;
		  console.log("statusCode: ", res.statusCode);
		  console.log("headers: ", res.headers);

	  
	  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers && res.headers.location) {
	    var location = res.headers.location;
	    console.log('redirect', location);
	    redirect = true;
	  
		  var redirectURI = url.parse(location);
		  console.log('redirect URI', redirectURI);
		  
		  options.hostname = redirectURI.hostname;
		  options.port = redirectURI.port;
		  options.path = redirectURI.pathname;
		  
	    
	    doRequest(options, eventCallback, requestNo + 1, data, onUnAuthCallback);
	  } else if (res.statusCode === 401) {
		  redirect = true;
		  if(req._auth) {
		    var authHeader = req._auth.onResponse(res);
		    if (authHeader) {
		      req.setHeader('authorization', authHeader);
		      var location = res.headers.location;
			    console.log('redirect', location);
			  
				  var redirectURI = new URI(location);
				  console.log('redirect URI', redirectURI);
			      options.hostname = redirectURI.hostname;
				  options.port = redirectURI.port;
				  options.path = redirectURI.pathname;
		    
		      doRequest(options, eventCallback, requestNo + 1, data, onUnAuthCallback);
		  }
	    } else {
	    	onUnAuthCallback();
	    }
	  }
	  
	  res.on('data', function(d) {
		  body += d;
	  });
	  
	  res.on('end', function () {
		  	if(body && !redirect) {
		  		eventCallback(body);
		  	} else {
		  		console.log('redirectng so not done');
		  	}
      });
	});
	if(data) {
		req.write(data);
	}
	req.end();

	req.on('error', function(e) {
	  console.error(e);
	});
}

function getNestFromServer(nestToken, eventCallback, onUnAuthCallback) {
	var options = {
	  hostname: 'developer-api.nest.com',
	  port: 443,
	  path: '/devices/thermostats/',
	  method: 'GET',
	  headers: {'Authorization' : 'Bearer ' + nestToken}
	};

	doRequest(options, eventCallback, 0, null, onUnAuthCallback);	
				  
			  
}

function setNestTemperatureFromServer(thermostat, nestToken, eventCallback, onUnAuthCallback) {
	var options = {
	  hostname: 'developer-api.nest.com',
	  port: 443,
	  path: '/devices/thermostats/',
	  method: 'GET',
	  headers: {'Authorization' : 'Bearer ' + nestToken}
	};

	doRequest(options, function(body) {
		console.log("SetTemp device list onResponse from nest: " + body);
		var bod = JSON.parse(body);
		for (i in bod) { 
			console.log(i); 
			var val = bod[i]; 
			console.log(val.name);
			
			console.log("name", val.name);
			console.log("thermostat", thermostat);
			
			if(val.name.toUpperCase() === thermostat.toUpperCase()) {
				console.log("matched", thermostat);
				eventCallback(val);
			}
			
		}
	
		}, 0, null, onUnAuthCallback);
				  	  
}

function setNestTemperatureOnDeviceFromServer(thermostat, temperature, nestToken, eventCallback, onUnAuthCallback) {
	var options = {
	  hostname: 'developer-api.nest.com',
	  port: 443,
	  path: '/devices/thermostats/' + thermostat,
	  method: 'PUT',
	  headers: {'Authorization' : 'Bearer ' + nestToken}
	};

	doRequest(options, function(body) {
		console.log("SetTemp on device onResponse from nest: " + body);
		eventCallback(body);
	
		}, 0, '{"target_temperature_f":' + temperature + '}', onUnAuthCallback);
				  	  
}




// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the NestSkill skill.
    var nestSkill = new NestSkill();
    nestSkill.execute(event, context);
};

