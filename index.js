var Service, Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-broadlink-http", "BroadlinkHttp", BroadlinkHttpAccessory);
};

function BroadlinkHttpAccessory(log, config) {
  this.log = log;

  // url info
  this.on_url = config["on_url"];
  this.on_body = config["on_body"];
  this.off_url = config["off_url"];
  this.off_body = config["off_body"];
  this.status_url = config["status_url"];
  this.brightness_url = config["brightness_url"];
  this.brightnesslvl_url = config["brightnesslvl_url"];
  this.http_method = config["http_method"] || "GET";

  this.http_brightness_method = config["http_brightness_method"] || this.http_method;
  this.username = config["username"] || "";
  this.password = config["password"] || "";
  this.sendimmediately = config["sendimmediately"] || "";
  this.service = config["service"] || "Switch";
  this.name = config["name"];
  this.brightnessHandling = config["brightnessHandling"] || "no";
  this.switchHandling = config["switchHandling"] || "no";

  //realtime polling info
  this.state = false;
  this.currentlevel = 0;
  this.enableSet = true;
  var that = this;

  // Status Polling, if you want to add additional services that don't use switch handling you can add something like this || (this.service=="Smoke" || this.service=="Motion"))
  if (this.status_url && this.switchHandling == "realtime") {
    var powerurl = this.status_url;
    var statusemitter = pollingtoevent(function (done) {
      that.httpRequest(powerurl, "", "GET", that.username, that.password, that.sendimmediately, function (error, response, body) {
        if (error) {
          that.log('HTTP get power function failed: %s', error.message);
          done(error);
        } else {
          done(null, body);
        }
      })
    }, {longpolling: true, interval: 300, longpollEventName: "statuspoll"});

    statusemitter.on("statuspoll", function (data) {
      var binaryState = parseInt(data.replace(/\D/g, ""));
      that.state = binaryState > 0;
      that.log(that.service, "received power", that.status_url, "state is currently", binaryState);
      // switch used to easily add additonal services
      that.enableSet = false;
      switch (that.service) {
        case "Switch":
          if (that.switchService) {
            that.switchService.getCharacteristic(Characteristic.On)
              .setValue(that.state);
          }
          break;
        case "Light":
          if (that.lightbulbService) {
            that.lightbulbService.getCharacteristic(Characteristic.On)
              .setValue(that.state);
          }
          break;
      }
      that.enableSet = true;
    });

  }
  // Brightness Polling
  if (this.brightnesslvl_url && this.brightnessHandling == "realtime") {
    var brightnessurl = this.brightnesslvl_url;
    var levelemitter = pollingtoevent(function (done) {
      that.httpRequest(brightnessurl, "", "GET", that.username, that.password, that.sendimmediately, function (error, response, responseBody) {
        if (error) {
          that.log('HTTP get power function failed: %s', error.message);
          return;
        } else {
          done(null, responseBody);
        }
      }) // set longer polling as slider takes longer to set value
    }, {longpolling: true, interval: 300, longpollEventName: "levelpoll"});

    levelemitter.on("levelpoll", function (data) {
      that.currentlevel = parseInt(data);

      that.enableSet = false;
      if (that.lightbulbService) {
        that.log(that.service, "received brightness", that.brightnesslvl_url, "level is currently", that.currentlevel);
        that.lightbulbService.getCharacteristic(Characteristic.Brightness)
          .setValue(that.currentlevel);
      }
      that.enableSet = true;
    });
  }
}

BroadlinkHttpAccessory.prototype = {

  httpRequest: function (url, body, method, username, password, sendimmediately, callback) {
    request({
        url: url,
        body: body,
        method: method,
        rejectUnauthorized: false,
        auth: {
          user: username,
          pass: password,
          sendImmediately: sendimmediately
        }
      },
      function (error, response, body) {
        callback(error, response, body)
      })
  },

  setPowerState: function (powerOn, callback) {

    if (this.enableSet == true && (this.currentlevel == 0 || !powerOn )) {

      var url;
      var body;

      if (!this.on_url || !this.off_url) {
        this.log.warn("Ignoring request; No power url defined.");
        callback(new Error("No power url defined."));
        return;
      }

      if (powerOn) {
        url = this.on_url;
        body = this.on_body;
        this.log("Setting power state to on");
      } else {
        url = this.off_url;
        body = this.off_body;
        this.log("Setting power state to off");
      }

      this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function (error, response, responseBody) {
        if (error) {
          this.log('HTTP set power function failed: %s', error.message);
          callback(error);
        } else {
          this.log('HTTP set power function succeeded!');
          callback();
        }
      }.bind(this));
    } else {
      callback();
    }
  },

  getPowerState: function (callback) {
    if (!this.status_url) {
      this.log.warn("Ignoring request; No status url defined.");
      callback(new Error("No status url defined."));
      return;
    }

    var url = this.status_url;
    this.log("Getting power state");

    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function (error, response, responseBody) {
      if (error) {
        this.log('HTTP get power function failed: %s', error.message);
        callback(error);
      } else {
        var active = responseBody.includes("ACTIVE");
        if(!active) active = responseBody.includes("ok");

        var powerOn = false;
        
        if (active) {
          powerOn = JSON.parse(responseBody)['on'];
        }
        this.log("Power state is currently %s", powerOn);
        callback(null, powerOn);
      }
    }.bind(this));
  },

  getBrightness: function (callback) {
    if (!this.brightnesslvl_url) {
      this.log.warn("Ignoring request; No brightness level url defined.");
      callback(new Error("No brightness level url defined."));
      return;
    }
    var url = this.brightnesslvl_url;
    this.log("Getting Brightness level");

    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function (error, response, responseBody) {
      if (error) {
        this.log('HTTP get brightness function failed: %s', error.message);
        callback(error);
      } else {
        var binaryState = parseInt(responseBody.replace(/\D/g, ""));
        var level = binaryState;
        this.log("brightness state is currently %s", binaryState);
        callback(null, level);
      }
    }.bind(this));
  },

  setBrightness: function (level, callback) {
    if (this.enableSet == true) {
      if (!this.brightness_url) {
        this.log.warn("Ignoring request; No brightness url defined.");
        callback(new Error("No brightness url defined."));
        return;
      }

      var url = this.brightness_url.replace("%b", level)

      this.log("Setting brightness to %s", level);

      this.httpRequest(url, "", this.http_brightness_method, this.username, this.password, this.sendimmediately, function (error, response, body) {
        if (error) {
          this.log('HTTP brightness function failed: %s', error);
          callback(error);
        } else {
          this.log('HTTP brightness function succeeded!');
          callback();
        }
      }.bind(this));
    } else {
      callback();
    }
  },

  identify: function (callback) {
    this.log("Identify requested!");
    callback(); // success
  },

  getServices: function () {

    var that = this;

    // you can OPTIONALLY create an information service if you wish to override
    // the default values for things like serial number, model, etc.
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Broadlink HTTP Manufacturer")
      .setCharacteristic(Characteristic.Model, "Broadlink HTTP Model")
      .setCharacteristic(Characteristic.SerialNumber, "Broadlink HTTP Serial Number");

    switch (this.service) {
      case "Switch":
        this.switchService = new Service.Switch(this.name);
        switch (this.switchHandling) {
          //Power Polling
          case "yes":
            this.switchService
              .getCharacteristic(Characteristic.On)
              .on('get', this.getPowerState.bind(this))
              .on('set', this.setPowerState.bind(this));
            break;
          case "realtime":
            this.switchService
              .getCharacteristic(Characteristic.On)
              .on('get', function (callback) {
                callback(null, that.state)
              })
              .on('set', this.setPowerState.bind(this));
            break;
          default  :
            this.switchService
              .getCharacteristic(Characteristic.On)
              .on('set', this.setPowerState.bind(this));
            break;
        }
        return [this.switchService];
      case "Light":
        this.lightbulbService = new Service.Lightbulb(this.name);
        switch (this.switchHandling) {
          //Power Polling
          case "yes" :
            this.lightbulbService
              .getCharacteristic(Characteristic.On)
              .on('get', this.getPowerState.bind(this))
              .on('set', this.setPowerState.bind(this));
            break;
          case "realtime":
            this.lightbulbService
              .getCharacteristic(Characteristic.On)
              .on('get', function (callback) {
                callback(null, that.state)
              })
              .on('set', this.setPowerState.bind(this));
            break;
          default:
            this.lightbulbService
              .getCharacteristic(Characteristic.On)
              .on('set', this.setPowerState.bind(this));
            break;
        }
        // Brightness Polling
        if (this.brightnessHandling == "realtime") {
          this.lightbulbService
            .addCharacteristic(new Characteristic.Brightness())
            .on('get', function (callback) {
              callback(null, that.currentlevel)
            })
            .on('set', this.setBrightness.bind(this));
        } else if (this.brightnessHandling == "yes") {
          this.lightbulbService
            .addCharacteristic(new Characteristic.Brightness())
            .on('get', this.getBrightness.bind(this))
            .on('set', this.setBrightness.bind(this));
        }

        return [informationService, this.lightbulbService];
        break;
    }
  }
};
