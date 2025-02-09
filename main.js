"use strict";



/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");


// Load your modules here, e.g.:
// const fs = require("fs");

class Wiim extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	
	*/
	constructor(options) {
		super({
			...options,
			name: "wiim",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
        let reqtype = "https";
		if (this.config.Request_Type != "https") {reqtype="http";}
		   
		this.log.info(this.getstates);
		this.setState("info.connection", false, true);
		// Reset the connection indicator during startup
		var http = require(reqtype)			
		let url = reqtype + "://"+this.config.IP_Address+"/httpapi.asp?command=getStatusEx";

		
		http.get(url,{ validateCertificate: false, rejectUnauthorized: false, requestCert: true },(res) => {
			let body = "";
		
					//write response chunks to body
			res.on("data", (chunk) => {
				body += chunk;
			});
		
			res.on("end", () => {
				try {
					let json = JSON.parse(body);
					//this.log.info(body);
					this.log.info("Wiim with firmware " + json.firmware+ " found. Ready to go, greetings to qlink ;-)");
					this.setState("info.connection", true, true);

				//	if (body==="OK") {
				//		this.setState("info.connection", true, true);
				//	}
				//	else {this.setState("info.connection", false, true);}
				//	this.log.info("Wiim wifi status: "+body + ", IP: " +this.config.IP_Address);
				//	this.log.info("Refresh interval: " + this.config.Refresh_Interval + "sec.");
				} catch (error) {
					this.log.error(error.message);
				};
			});
		
		}).on("error", (error) => {
			this.log.error(error.message);})
		
		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		//this.log.info("config IP_Address: " + this.config.IP_Address);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/


		await this.setObjectNotExistsAsync("album", {
			type: "state",
			common: {
				name: "album",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("title", {
			type: "state",
			common: {
				name: "title",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("artist", {
			type: "state",
			common: {
				name: "artist",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("albumArtURI", {
			type: "state",
			common: {
				name: "albumArtURI",
				type: "string",
				role: "indicator",
				read: true,
				write: false ,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("sampleRate", {
			type: "state",
			common: {
				name: "samplRate",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("bitDepth", {
			type: "state",
			common: {
				name: "bitDepth",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("Play_Pause", {
			type: "state",
			common: {
				name: "Play_Pause",
				type: "boolean",
				role: "button.play",
				read: true,
				write: true,
			},
			native: {},
		});


		await this.setObjectNotExistsAsync("next", {
			type: "state",
			common: {
				name: "next",
				type: "boolean",
				role: "button.play",
				read: true,
				write: true,
			},
			native: {},
		});


		await this.setObjectNotExistsAsync("previous", {
			type: "state",
			common: {
				name: "previous",
				type: "boolean",
				role: "button.play",
				read: true,
				write: true,
			},
			native: {},
		});


		await this.setObjectNotExistsAsync("loop_mode", {
			type: "state",
			common: {
				name: "loop_mode",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
				def: "to be read", 
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("lastRefresh", {
			type: "state",
			common: {
				name: "lastRefresh",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
				def: "never",
			},
			native: {},
		});

		
		await this.setObjectNotExistsAsync("volume", {
			type: "state",
			common: {
				name: "volume",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "never",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("play_preset", {
			type: "state",
			common: {
				name: "play_preset",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "none",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("play_URL", {
			type: "state",
			common: {
				name: "play_URL",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "none",
			},
			native: {},
		});



		await this.setObjectNotExistsAsync("toggle_loop_mode", {
			type: "state",
			common: {
				name: "toggle_loop_mode",
				type: "boolean",
				role: "indicator",
				read: true,
				write: true,
				def: "false",
			},
			native: {},
		});



		await this.setObjectNotExistsAsync("curpos", {
			type: "state",
			common: {
				name: "current_pos",
				type: "number",
				role: "indicator",
				read: true,
				write: false,
				def: "",
			},
			native: {},
		});
		
		
		await this.setObjectNotExistsAsync("offset_pts", {
			type: "state",
			common: {
				name: "offset_pts",
				type: "number",
				role: "indicator",
				read: true,
				write: false,
				def: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("setMaster", {
			type: "state",
			common: {
				name: "setMaster",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "0.0.0.0",
			},
			native: {},
		});


		await this.setObjectNotExistsAsync("leaveSyncGroup", {
			type: "state",
			common: {
				name: "leaveSyncGroup",
				type: "boolean",
				role: "button",
				read: true,
				write: true,
				def: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("tracklength", {
			type: "state",
			common: {
				name: "tracklength",
				type: "number",
				role: "indicator",
				read: true,
				write: false,
				def: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("plicurr", {
			type: "state",
			common: {
				name: "plicurr",
				type: "number",
				role: "indicator",
				read: true,
				write: false,
				def: "undefined",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("jumptopos", {
			type: "state",
			common: {
				name: "jumptops",
				type: "number",
				role: "indicator",
				read: true,
				write: true,
				def: 0,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("jumptopli", {
			type: "state",
			common: {
				name: "jumptopli",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "",
			},
			native: {},
		});


		await this.setObjectNotExistsAsync("mode", {
			type: "state",
			common: {
				name: "mode",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
				def: "",
			},
			native: {},
		});


		await this.setObjectNotExistsAsync("switchmode", {
			type: "state",
			common: {
				name: "switchmode",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "",
			},
			native: {},
		});



		
		await this.setObjectNotExistsAsync("playPromptUrl", {
			type: "state",
			common: {
				name: "playPromptUrl",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("setShutdown", {
			type: "state",
			common: {
				name: "setShutdown",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "",
			},
			native: {},
		});


		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("album", { val: true, ack: true });
		this.subscribeStates("title", { val: true, ack: true });
		this.subscribeStates("artist", { val: true, ack: true });
		this.subscribeStates("albumArtURI", { val: true, ack: true });
		this.subscribeStates("sampleRate", { val: true, ack: true });
		this.subscribeStates("bitDepth", { val: true, ack: true });
		this.subscribeStates("Play_Pause", { val: true, ack: true });
		this.subscribeStates("next", { val: true, ack: true });
		this.subscribeStates("previous", { val: true, ack: true });
		this.subscribeStates("lastRefresh", { val: true, ack: false });
		this.subscribeStates("volume", { val: true, ack: false });
		this.subscribeStates("play_preset", { val: true, ack: false });
		this.subscribeStates("play_URL", { val: true, ack: false });
		this.subscribeStates("loop_mode" ,{ val: true, ack: false }) ;
		this.subscribeStates("toggle_loop_mode" ,{ val: true, ack: false }) ;
		this.subscribeStates("setMaster" ,{ val: true, ack: false }) ;
		this.subscribeStates("leaveSyncGroup" ,{ val: true, ack: false }) ;
		this.subscribeStates("jumptopos" ,{ val: true, ack: false }) ;
		this.subscribeStates("jumptopli" ,{ val: true, ack: false }) ;
		this.subscribeStates("mode" ,{ val: true, ack: false }) ;
		this.subscribeStates("switchmode" ,{ val: true, ack: false }) ;
		this.subscribeStates("playPromptUrl" ,{ val: true, ack: false }) ;
		this.subscribeStates("setShutdown" ,{ val: true, ack: false }) ;

		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync("testVariable", true);
		//await this.setStateAsync("Playing", {val: this.config.IP_Address, ack: true});

		// same thing, but the value is flagged "ack"
		// ack should be a lways set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info("check user admin pw iobroker: " + result);

		result = await this.checkGroupAsync("admin", "admin");
		this.log.info("check group user admin group admin: " + result);
		
		setInterval(()=> { 
						// alle XX Sekunden ausführen		
			var http = require(reqtype)			
			
			//*********************** request Wiim's playing info and uupdate corresponding datapoints */
			if (reqtype == "https") {
			let url = reqtype+"://"+this.config.IP_Address+"/httpapi.asp?command=getMetaInfo";

			http.get(url,{ validateCertificate: false, rejectUnauthorized: false, requestCert: true },(res) => {
				let body = "";
			
						//write response chunks to body
				res.on("data", (chunk) => {
					body += chunk;
				});
			
				res.on("end", () => {
					try {
						let json = JSON.parse(body);
						//var myInstance = id.substring(0,7);
						// write info to statea

						this.setState("album",json.metaData.album,true);
						this.setState("title",json.metaData.title,true);
						this.setState("artist",json.metaData.artist,true);
						this.setState("albumArtURI",json.metaData.albumArtURI,true);
						this.setState("sampleRate",json.metaData.sampleRate,true);
						this.setState("bitDepth",json.metaData.bitDepth,true);
		

					} catch (error) {
						this.log.error(error.message);
					};
				});
			
			}).on("error", (error) => {
				this.log.error(error.message);
			});
		}
		
			url = reqtype + "://"+this.config.IP_Address+"/httpapi.asp?command=getPlayerStatus";

			http.get(url,{ validateCertificate: false, rejectUnauthorized: false, requestCert: true },(res) => {
				let body = "";
			
						//write response chunks to body
				res.on("data", (chunk) => {
					body += chunk;
				});
	
				res.on("end", () => {
					try {
						let json = JSON.parse(body);
						//var myInstance = id.substring(0,7);
						// write info to statea
						let Position = Number(json.curpos);
 						let Offset_PTS = Number (json.offset_pts);
						let TotLen = Number(json.totlen);
						let PliCurr = Number(json.plicurr);
						this.setState("loop_mode",json.loop,true);
//this.log.info(json.mode);	
						switch (json.mode) {
							case("0"):
								this.setState("mode","idling",true);
							break;


							case("1"):
								this.setState("mode","Airplay",true);
							break;

							case("2"):
								this.setState("mode","DLNA",true);
							break;


							case("10"):
								this.setState("mode","Network",true);
							break;
							case("11"):
								this.setState("mode","UDISK",true);
							break;

							case("20"):
								this.setState("mode","HTTPAPI",true);
							break;


							case("31"):
								this.setState("mode","Spotify Connect",true);
							break;
							case("40"):
								this.setState("mode","Line-In #1",true);
							break;


							case("41"):
								this.setState("mode","Bluetooth",true);
							break;

							case("43"):
								this.setState("mode","Optical",true);
							break;

							case("45"):
								this.setState("mode","co-axial",true);
							break;



							case("47"):
								this.setState("mode","Line-In #2",true);
							break;

							case("49"):
								this.setState("mode","HDMI",true);
							break;



							case("51"):
								this.setState("mode","USBDAC",true);
							break;
							
							case("99"):
							this.setState("mode","MR Guest",true);
						break;

						}


						this.setState("curpos",Position,false);
						this.setState("offset_pts",Offset_PTS,true);
						this.setState("tracklength",TotLen,false);
						this.setState("plicurr",PliCurr,false);
						if (reqtype == "http")
						{
							this.setState("album",hexToASCII(json.Album),true);
							this.setState("title",hexToASCII(json.Title),true);
							this.setState("artist",hexToASCII(json.Artist),true);}



					} catch (error) {
						this.log.error(error.message);
					};
				});
			
			}).on("error", (error) => {
				this.log.error(error.message);
			});
			


			



	
			var theDate = new Date();
			var mydate = theDate.toString();
			//this.log.info(mydate.substring(16,25));
			this.setState("lastRefresh",mydate.substring(16,25),true);







		}, this.config.Refresh_Interval*1000); 
	
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	onStateChange(id, state) {
		//var http = require("https")
		var myInstance = id.substring(0,7);
		if (state) {
			// The state was changed
			
			switch (id) {

					case id.substring(0,7)+"setShutdown":

						this.getState(id.substring(0,7)+"setShutdown", (err, state)=> {

						sendWiimcommand(this, "setShutdown:"+state.val);
			
									}); 
					break;

					case id.substring(0,7)+"playPromptUrl":

						this.getState(id.substring(0,7)+"playPromptUrl", (err, state)=> {

							sendWiimcommand(this, "playPromptUrl:"+state.val);
							}); 
					break;



					case id.substring(0,7)+"switchmode":

						this.getState(id.substring(0,7)+"switchmode", (err, state)=> {

							sendWiimcommand(this, "setPlayerCmd:switchmode:"+state.val);
							}); 
					break;


					case id.substring(0,7)+"jumptopos":

						this.getState(id.substring(0,7)+"jumptopos", (err, state)=> {

							sendWiimcommand(this, "setPlayerCmd:seek:"+state.val/1000);
						}); 
					break;

					case id.substring(0,7)+"jumptopli":

						this.getState(id.substring(0,7)+"jumptopli", (err, state)=> {

							sendWiimcommand(this, "setPlayerCmd:playlist:"+state.val);
						}); 
					break;






					case id.substring(0,7)+"Play_Pause":					
						sendWiimcommand(this, "setPlayerCmd:onepause");
					break;

						
					case id.substring(0,7)+"next":
						sendWiimcommand(this, "setPlayerCmd:next");	
					break;
				

					case id.substring(0,7)+"previous":
						sendWiimcommand(this, "setPlayerCmd:previous");
					break;


					case id.substring(0,7)+"volume":

						this.getState(id.substring(0,7)+"volume", (err, state)=> {
    
							sendWiimcommand(this, "setPlayerCmd:vol:"+state.val);
						}); 
					break;


					case id.substring(0,7)+"play_preset":
						this.getState(id.substring(0,7)+"play_preset", (err, state)=> {
							sendWiimcommand(this, "MCUKeyShortClick:"+state.val);
						}); 
					break;

					
					case id.substring(0,7)+"play_URL":
						this.getState(id.substring(0,7)+"play_URL", (err, state)=> {

							sendWiimcommand(this, "setPlayerCmd:play:"+state.val);
							this.log.info("setPlayerCmd:play:"+state.val);
						}); 
					break;



					case id.substring(0,7)+"toggle_loop_mode":
						this.getState(id.substring(0,7)+"toggle_loop_mode", (err, state)=> {

							sendWiimcommand(this, "setPlayerCmd:loopmode:1");
						}); 
					break;

					case id.substring(0,7)+"setMaster":
						this.getState(id.substring(0,7)+"setMaster", (err, state)=> {

							sendWiimcommand(this, "ConnectMasterAp:JoinGroupMaster:eth"+state.val);
							this.log.info("ConnectMasterAp:JoinGroupMaster:eth"+state.val)
						}); 
					break;

					case id.substring(0,7)+"leaveSyncGroup":
						this.getState(id.substring(0,7)+"leaveSyncGroup", (err, state)=> {
							sendWiimcommand(this, "ConnectMasterAp:JoinGroupMaster:eth0.0.0.0")
							sendWiimcommand(this, "ConnectMasterAp:LeaveGroup");
							this.log.info("ConnectMasterAp:LeaveGroup")
						}); 
					break;



			} 

			
		
		} else {
			// The state was deleted
			//this.log.info(`state ${id} deleted`);
		}
		

	}

	

	
	
	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }
}




async function sendWiimcommand(mywiimadapter, wiimcmd)
	{	
		let reqtype = "https";
		if (mywiimadapter.config.Request_Type != "https") {reqtype="http";}
		var http = require(reqtype)
		
		http.get(reqtype+"://" + mywiimadapter.config.IP_Address + "/httpapi.asp?command="+wiimcmd, { validateCertificate: false, rejectUnauthorized: false, requestCert: true }, (err) => {
		 
mywiimadapter.log.info(reqtype+ "://" + mywiimadapter.config.IP_Address + "/httpapi.asp?command="+wiimcmd);

			if (!err) {
				
		} else {
			mywiimadapter.log.info(err);
			}
		}) 
		
	}

	function hexToASCII(hex) {
        // initialize the ASCII code string as empty.
        var ascii = "";
 
        for (var i = 0; i < hex.length; i += 2) {
          // extract two characters from hex string
          var part = hex.substring(i, i + 2);
 
          // change it into base 16 and
          // typecast as the character
          var ch = String.fromCharCode(parseInt(part, 16));
 
          // add this char to final ASCII string
          ascii = ascii + ch;
        }
        return ascii;
      }




if (require.main !== module) { 
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Wiim(options);
} else {
	// otherwise start the instance directly
	new Wiim();

}



