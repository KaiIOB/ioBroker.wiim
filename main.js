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

		this.log.info(this.getstates);
		this.setState("info.connection", false, true);
		// Reset the connection indicator during startup
		var http = require("https")			
		let url = "https://"+this.config.IP_Address+"/httpapi.asp?command=getStatusEx";

		
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
				write: true,
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

		await this.setObjectNotExistsAsync("wiim_mode", {
			type: "state",
			common: {
				name: "wiim_mode",
				type: "string",
				role: "indicator",
				read: true,
				write: true,
				def: "to be read",
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
		this.subscribeStates("wiim_mode" ,{ val: true, ack: false }) ;

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
			var http = require("https")			
			
			//*********************** request Wiim's playing info and uupdate corresponding datapoints */
			
			let url = "https://"+this.config.IP_Address+"/httpapi.asp?command=getMetaInfo";

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
			
		
			url = "https://"+this.config.IP_Address+"/httpapi.asp?command=getPlayerStatus";

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

						this.setState("loop_mode",json.loop,true);
						this.setState("wiim_mode",json.mode,true);
						
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
		var http = require("https")
		var myInstance = id.substring(0,7);
		if (state) {
			// The state was changed
			
			switch (id) {

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
		var http = require("https")
		
		http.get("https://" + mywiimadapter.config.IP_Address + "/httpapi.asp?command="+wiimcmd, { validateCertificate: false, rejectUnauthorized: false, requestCert: true }, (err) => {
		 
			if (!err) {
				
		} else {
			mywiimadapter.log.info(err);
			}
		}) 
		
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



