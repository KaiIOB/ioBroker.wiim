"use strict";
/*
 * Created with @iobroker/create-adapter v2.3.0
 */

const utils = require("@iobroker/adapter-core");
let pollTimeout = null;

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
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		let reqtype = "https";
		let pingport = 443;
		if (this.config.Request_Type != "https") {  //if http was selected, port must be 80
			reqtype="http";
			pingport = 80;
		}

		const tcpp = require("tcp-ping");
		tcpp.probe(this.config.IP_Address, pingport, (err, available)=> {
			if (available){
				this.log.info("server responded to ping");}
			else {this.log.info("server does not seem to be online, no reaction to ping. Are you sure it's up and the IP address is correct?");}
		});


		//this.log.info(this.getstates);
		this.setState("info.connection", false, true);
		// Reset the connection indicator during startup
		let json="";
		const http = require(reqtype);
		const url = reqtype + "://"+this.config.IP_Address+"/httpapi.asp?command=getStatusEx";

		await this.setObjectNotExistsAsync("Device_Name", {
			type: "state",
			common: {
				name: "Device_Name",
				type: "string",
				role: "indicator",
				read: true,
				write: false,
			},
			native: {},
		});

		http.get(url,{ validateCertificate: false, rejectUnauthorized: false, requestCert: true },(res) => {
			let body = "";
			//write response chunks to body
			res.on("data", (chunk) => {
				body += chunk;
			});

			res.on("end", () => {
				try {
					json = JSON.parse(body);
					this.log.info("Device with firmware " + json.firmware+ " found. Ready to go, greetings to qlink ;-)");
					this.setState("info.connection", true, true);
					this.setState("Device_Name",json.DeviceName,true);
				} catch (error) {
					this.log.error(error.message);
				}
			});

		}).on("error", (error) => {
			this.log.error(error.message);});

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
				write: false,
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
				write: true,
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
				write: true,
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
				write: true,
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

		getWiimData(this);

	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {

			clearTimeout(pollTimeout);
			pollTimeout = null;
			callback();
		} catch (e) {
			callback();
		}
	}

	onStateChange(id, state) {

		if (state && !state.ack) {

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
						this.log.info(state.val);
						sendWiimcommand(this, "setPlayerCmd:play:"+state.val);
						this.log.info("setPlayerCmd:play:"+state.val);
					});
					break;



				case id.substring(0,7)+"toggle_loop_mode":
					this.getState(id.substring(0,7)+"toggle_loop_mode", ()=> {

						sendWiimcommand(this, "setPlayerCmd:loopmode:1");
					});
					break;

				case id.substring(0,7)+"setMaster":
					this.getState(id.substring(0,7)+"setMaster", (err, state)=> {

						sendWiimcommand(this, "ConnectMasterAp:JoinGroupMaster:eth"+state.val);
						//this.log.info("ConnectMasterAp:JoinGroupMaster:eth"+state.val);
					});
					break;

				case id.substring(0,7)+"leaveSyncGroup":
					this.getState(id.substring(0,7)+"leaveSyncGroup", ()=> {
						sendWiimcommand(this, "ConnectMasterAp:JoinGroupMaster:eth0.0.0.0");
						sendWiimcommand(this, "ConnectMasterAp:LeaveGroup");
						//this.log.info("ConnectMasterAp:LeaveGroup");
					});
					break;

			}

		}

	}

}


async function getWiimData(mywiimadapter)
{
	let pingport = 443;
	const reqtype = mywiimadapter.config.Request_Type;
	if (reqtype == "http"){
		pingport = 80;
	}
	const tcpp = require("tcp-ping");
	tcpp.probe(mywiimadapter.config.IP_Address, pingport, (err, available)=> {
	//mywiimadapter.log.info("ping result:" + available);
		if (available){


			const http = require(reqtype);

			//*********************** request Wiim's playing info and uupdate corresponding datapoints */
			if (reqtype == "https") {	//only Wiim supports getMetaInfo
				const url = reqtype+"://"+mywiimadapter.config.IP_Address+"/httpapi.asp?command=getMetaInfo";

				http.get(url,{ validateCertificate: false, rejectUnauthorized: false, requestCert: true },(res) => {
					let body = "";
					//write response chunks to body
					res.on("data", (chunk) => {
						body += chunk;
					});

					res.on("end", () => {
						try {
							const json = JSON.parse(body);
							// write info to statea
							mywiimadapter.setState("album",json.metaData.album,true);
							mywiimadapter.setState("title",json.metaData.title,true);
							mywiimadapter.setState("artist",json.metaData.artist,true);
							mywiimadapter.setState("albumArtURI",json.metaData.albumArtURI,true);
							mywiimadapter.setState("sampleRate",json.metaData.sampleRate,true);
							mywiimadapter.setState("bitDepth",json.metaData.bitDepth,true);

						} catch (error) {
							//mywiimadapter.log.info("no track playing");
						}
					});

				}).on("error", (error) => {
					mywiimadapter.log.error("error1:" + error.message);
				});
			}

			const url = reqtype + "://"+mywiimadapter.config.IP_Address+"/httpapi.asp?command=getPlayerStatus";

			http.get(url,{ validateCertificate: false, rejectUnauthorized: false, requestCert: true },(res) => {
				let body = "";
				//write response chunks to body
				res.on("data", (chunk) => {
					body += chunk;
				});

				res.on("end", () => {
					try {
						const json = JSON.parse(body);
						// write info to statea
						const Position = Number(json.curpos);
						const Offset_PTS = Number (json.offset_pts);
						const TotLen = Number(json.totlen);
						const PliCurr = Number(json.plicurr);
						mywiimadapter.setState("loop_mode",json.loop,true);
						mywiimadapter.setState("volume",json.vol,true);

						switch (json.mode) {
							case("0"):
								mywiimadapter.setState("mode","idling",true);
								break;

							case("1"):
								mywiimadapter.setState("mode","Airplay",true);
								break;

							case("2"):
								mywiimadapter.setState("mode","DLNA",true);
								break;

							case("10"):
								mywiimadapter.setState("mode","Network",true);
								break;

							case("11"):
								mywiimadapter.setState("mode","UDISK",true);
								break;

							case("20"):
								mywiimadapter.setState("mode","HTTPAPI",true);
								break;

							case("31"):
								mywiimadapter.setState("mode","Spotify Connect",true);
								break;

							case("40"):
								mywiimadapter.setState("mode","Line-In #1",true);
								break;

							case("41"):
								mywiimadapter.setState("mode","Bluetooth",true);
								break;

							case("43"):
								mywiimadapter.setState("mode","Optical",true);
								break;

							case("45"):
								mywiimadapter.setState("mode","co-axial",true);
								break;

							case("47"):
								mywiimadapter.setState("mode","Line-In #2",true);
								break;

							case("49"):
								mywiimadapter.setState("mode","HDMI",true);
								break;

							case("51"):
								mywiimadapter.setState("mode","USBDAC",true);
								break;

							case("99"):
								mywiimadapter.setState("mode","MR Guest",true);
								break;

						}

						mywiimadapter.setState("curpos",Position,false);
						mywiimadapter.setState("offset_pts",Offset_PTS,true);
						mywiimadapter.setState("tracklength",TotLen,false);
						mywiimadapter.setState("plicurr",PliCurr,false);
						if (reqtype == "http")  //arylic provide album, title and artist only as hex format
						{
							mywiimadapter.setState("album",hexToASCII(json.Album),true);
							mywiimadapter.setState("title",hexToASCII(json.Title),true);
							mywiimadapter.setState("artist",hexToASCII(json.Artist),true);
						}

					} catch (error) {
						mywiimadapter.log.info("no track playing -->" + error.message);
					}
				});

			}).on("error", (error) => {
				mywiimadapter.log.error("error2:" + error.message);
			});

			const theDate = new Date();
			const mydate = theDate.toString();
			mywiimadapter.setState("lastRefresh",mydate.substring(16,25),true);

		}
	});
	pollTimeout = setTimeout(function () {getWiimData(mywiimadapter);}, mywiimadapter.config.Refresh_Interval*1000);
}

async function sendWiimcommand(mywiimadapter, wiimcmd)
{
	let reqtype = "https";
	if (mywiimadapter.config.Request_Type != "https") {reqtype="http";}
	const http = require(reqtype);
	http.get(reqtype+"://" + mywiimadapter.config.IP_Address + "/httpapi.asp?command="+wiimcmd, { validateCertificate: false, rejectUnauthorized: false, requestCert: true }, (err) => {

		//mywiimadapter.log.info(reqtype+ "://" + mywiimadapter.config.IP_Address + "/httpapi.asp?command="+wiimcmd);

		if (err) {
			mywiimadapter.log.info(err.message);
		}
	});

}

function hexToASCII(hex) {
	// initialize the ASCII code string as empty.
	let ascii = "";
	for (let i = 0; i < hex.length; i += 2) {
		// extract two characters from hex string
		const part = hex.substring(i, i + 2);

		// change it into base 16 and
		// typecast as the character
		const ch = String.fromCharCode(parseInt(part, 16));

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