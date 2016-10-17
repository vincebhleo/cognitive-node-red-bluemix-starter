'use strict';
var express = require('express');
var app = express();
var router = express.Router();
var watson = require( 'watson-developer-cloud' );
var weather = require('../app/weather/weather');
var location = require('../app/location/location');
var vcapServices = require('vcap_services');
var request = require('request');

var context_var = {};

// Create the service wrapper
var conversation = watson.conversation( {
  url: 'https://gateway.watsonplatform.net/conversation/api',
  username: process.env.conversation_username || '<USERNAME>',
  password: process.env.convesation_password || '<PASSWORD>',
  version_date: '2016-07-11',
  version: 'v1'
}, vcapServices.getCredentials('conversation'));

router.get( '/', function(req, res, next) {
	var text = req.query.text;
	console.log('input text is:: '+text);
  var workspace = process.env.conversation_workspaceid || '<WORKPSPACE_ID>';
  if ( !workspace ) {
    return res.json( {
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' +
        'Once a workspace has been defined the intents may be imported from ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    } );
  }
  var payload = {
    workspace_id: workspace,
    context: {},
    input: {}
  };
  if ( req.body ) {
    console.log('inside req.body');
    payload.input = {};
    console.log('Inside the req.body.input paylod is::  '+(JSON.stringify(payload.input)));
    payload.context = context_var;
    console.log('Context conver id = '+ context_var.conversation_id);

	}
  // Send the input to the conversation service
  conversation.message( payload, function(err, data) {
    if ( err ) {
      return res.status( err.code || 500 ).json( err );
    }

    updateMessage(payload, data, function(err, data) {
      console.log('replyxxx '+ data);
      return res.status( 200 ).json( data );
    });
  });
});

function updateMessage(input, response, callbackFunc) {
	console.log('inside updateMessage: '+(JSON.stringify(response, null, 4)));
  context_var = response.context;
  console.log(JSON.stringify(context_var, null, 4));
  var city = context_var.place;

  var responseText = response.output.text;
  if(city === undefined) {return callbackFunc(null, responseText)} ;

  if(city != undefined){
    console.log('Context var: City is  '+city);
    console.log('calling location api to get lat long of '+city);
    var weather;
    var lat;
    var long;

    var options = {
      method: 'GET',
      url: 'https://maps.googleapis.com/maps/api/geocode/json',
      qs:{
        address:city,
        key: '<GOOGLE_API_KEY>'
      },
      header:{}
    };

  var wConditions;
  //calling google geocode api to get latitude, longitude of the city
  request(options, function (error, response, body) {
        if (error) throw new Error(error);
        var b = JSON.parse(response.body);
        console.log(b.results[0].geometry.location.lat);
        console.log(b.results[0].geometry.location.lng);
        lat = (b.results[0].geometry.location.lat);
        long = (b.results[0].geometry.location.lng);
        lat = Number((lat).toFixed(2));
        long = Number((long).toFixed(2));
        var no_day;
        console.log(lat);
        console.log(long);

        //calling weather company data service from bluemix.
        //replace username and password with your credentials from weather service
        var url = 'https://<username>:<password>@twcservice.mybluemix.net:443/api/weather/v1/geocode/'+lat+'/'+long+'/forecast/daily/10day.json?units=m&language=en-US'
        console.log(url);
        request(url, function(error, response, body){
          if(error) console.log(error);
          //console.log(response.body);
          wConditions = JSON.parse(response.body);
          console.log("Got the weather CONDITIONS" + wConditions.forecasts[0].narrative);
          //responseText = wConditions.forecasts[0].narrative;
          context_var.place = undefined;
          return callbackFunc(null, wConditions.forecasts[0].narrative);
        });
});
}
}
module.exports = router;
