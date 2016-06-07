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
var APP_ID = "amzn1.echo-sdk-ams.app.c176feea-934a-4fbd-81ce-99ba0bc32cb6"; //replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

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
    var speechOutput = "Welcome to Mother Goose for Nest. I can help you control one or more Nest thermostats. Try asking Status, or Set Upstairs to 65. How can I help you?";
    var repromptText = "Welcome to Mother Goose for Nest. I can help you control one or more Nest thermostats. Try asking Status, or Set Upstairs to 65. How can I help you?";
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
				
				response.tellWithCard(responseString, "Mother Goose for Nest", responseString);
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
					var bod = JSON.parse(body);
					if(bod.error && bod.error.indexOf("too low") > -1) {
						response.tellWithCard("Sorry, I could not set " + thermostat + " to " + temperature + ". Temperature was too low", "Mother Goose for Nest", "Sorry, I could not set " + thermostat + " to " + temperature + ". Temperature was too low");
					} else if (bod.error) {
						response.tellWithCard("Sorry, I could not set " + thermostat + " to " + temperature + ". Temperature was too high", "Mother Goose for Nest", "Sorry, I could not set " + thermostat + " to " + temperature + ". Temperature was too high");
					} else {
						response.tellWithCard("Set Temperature " + thermostat + " to " + temperature + ".", "Mother Goose for Nest", "Set temperature " + thermostat + " to " + temperature + ".");
					}
				}, function() {
					response.tellWithLinkAccount("You must have a Nest account to use this skill. Please use the Alexa app to link your Amazon account with your Nest Account.");
				});
			}, function() {
				response.tellWithLinkAccount("You must have a Nest account to use this skill. Please use the Alexa app to link your Amazon account with your Nest Account.");
			}, function() {
				//didn't find device
			    var cardTitle = "Mother Goose for Nest";
			    var repromptText = "Sorry, I couldn't find that device. Could you please repeat that?";
			    var speechText = "Sorry, I couldn't find that device. Could you please repeat that?;"
			    var cardOutput = "Sorry, I couldn't find that device. Could you please repeat that?";
			    // If the user either does not reply to the welcome message or says something that is not
			    // understood, they will be prompted again with this text.

			    var speechOutput = {
			        speech: "<speak>" + speechText + "</speak>",
			        type: AlexaSkill.speechOutputType.SSML
			    };
			    var repromptOutput = {
			        speech: repromptText,
			        type: AlexaSkill.speechOutputType.PLAIN_TEXT
			    };
			    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);

			});
		}
		
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("I am Mother Goose for Nest. I can help you control one or more Nest thermostats. Try asking Status to get the current temperature and set temperature for each thermostat, or Set thermostat name to temperature. For example, set Downstairs to 55. How can I help you?", "I am Mother Goose for Nest. I can help you control one or more Nest thermostats. Try asking Status to get the current temperature and set temperature for each thermostat, or Set thermostat name to temperature. For example, set Downstairs to 55. How can I help you?");
    },
     "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
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

function setNestTemperatureFromServer(thermostat, nestToken, eventCallback, onUnAuthCallback, onNotFoundCallback) {
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
				return;
			}
			
		}
		onNotFoundCallback(thermostat);
	
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

