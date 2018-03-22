var util = require('util');
var bleno = require('../..');
var gpio = require('gpio');
var fs = require('fs');
var reboot = require('nodejs-system-reboot');


var BlenoCharacteristic = bleno.Characteristic;


// Wifi variables
var interfaceContent;
var contentBeforeSSID = "source-directory /etc/network/interfaces.d\n\nauto wlan0\niface wlan0 inet dhcp\n\twpa-ssid ";
var contentBeforePASS = "\n\twpa-psk ";
var ssid;
var password;

// GPIO variables
var led8; // Board Pin 8 (GPIO 14)




var stateEnums = {
  SERIAL_CHECK : -1,
  IDLE_WIFI_CHECK : 0,
  WIFI_SSID  : 1,
  WIFI_PASSWORD : 2,
  LOGIC : 3
}

curState = stateEnums.SERIAL_CHECK;


var EchoCharacteristic = function() {
  EchoCharacteristic.super_.call(this, {
    uuid: 'ec0e',
    properties: ['read', 'write', 'notify'],
    value: null
  });

  this._value = new Buffer(0);
  this._updateValueCallback = null;
};



util.inherits(EchoCharacteristic, BlenoCharacteristic);



EchoCharacteristic.prototype.onReadRequest = function(offset, callback) {

  // get the input string
  buf = this._value.toString();

  //console.log('Current State = ' + curState + '    buf = ' + buf);

  

  callback(this.RESULT_SUCCESS, this._value);
};



EchoCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {

  this._value = data;

  // get the input string
  buf = this._value.toString();


  if (curState != stateEnums.SERIAL_CHECK)
  {
    console.log('Msg from the phone :: Current State = ' + curState + '    buf = ' + buf); 
  }
  

  // if (this._updateValueCallback) {
  //   console.log('EchoCharacteristic - onWriteRequest: notifying');

  //   this._updateValueCallback(this._value);
  // }

  // logic
  switch (curState) {

    case stateEnums.SERIAL_CHECK:
      // check RPi pin
      // No RPi pin, no access to the following control logic
      console.log('\n--------------- Enter RPi Pin: \n');
      if (buf == '1234567890')
      {
        console.log('\n RPi Pin Correct ---------------\n');
        curState = stateEnums.IDLE_WIFI_CHECK;
      }

    case stateEnums.IDLE_WIFI_CHECK:

	// check wifi connection
	var wifi_connected = false;
	require('dns').resolve('www.google.com', function(err){
		if(err) {
			console.log("No internet connection!");
			// TODOO
			// function to send not connected signal to the phone

		}else{
			console.log("Internet connected!");
			wifi_connected = true;
		}
	});

      if (buf == 'wifi')
      {
        curState = stateEnums.WIFI_SSID;
      }
      if (buf == 'logic')
      {
        curState = stateEnums.LOGIC;
      }
      break;

    case stateEnums.WIFI_SSID:
      // function to set account
      console.log('\n---------------\nWifi account set to: ' + buf + '\n---------------\n');
      ssid = buf;

      curState = stateEnums.WIFI_PASSWORD;
      break;

    case stateEnums.WIFI_PASSWORD:
      // function to set password
      console.log('\n---------------\nWifi password set to: ' + buf + '\n---------------\n');
      password = buf;

      interfaceContent = contentBeforeSSID + ssid + contentBeforePASS + password;
      fs.writeFile('/etc/network/interfaces', interfaceContent, function(err){

	if (err) throw err;

	console.log('Setting up the new SSID and PASSWORD...')
      });

      reboot(function(err, stderr, stdout){

	if (!err && !stderr) {
		console.log(stdout);
	}
      });


      curState = stateEnums.IDLE_WIFI_CHECK;
      break;

    case stateEnums.LOGIC:
      // functions to control the light
      if (buf == '0')
      {
        console.log('\n---------------\nTurning off the light ^_^\n---------------\n');
	led8 = gpio.export(14, {
          ready: function(){
	    led8.reset();
	  }
	});
        curState = stateEnums.IDLE_WIFI_CHECK;
      }
      else if (buf == '1')
      {
        console.log('\n---------------\nTurning on the light ^_^\n---------------\n');
	led8 = gpio.export(14, {
	  ready: function(){
	    led8.set();
	  }
	});
        curState = stateEnums.IDLE_WIFI_CHECK;
      }
      break;

    default: 
      curState = stateEnums.IDLE_WIFI_CHECK;
  }




  callback(this.RESULT_SUCCESS);
};



EchoCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('---------------------------------------- onSubscribe ----------------------------------------');

  this._updateValueCallback = updateValueCallback;
};



EchoCharacteristic.prototype.onUnsubscribe = function() {
  console.log('---------------------------------------- onUnsubscribe ----------------------------------------');

  this._updateValueCallback = null;
};



module.exports = EchoCharacteristic;





