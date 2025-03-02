 "use strict";
/*
 * Created with @iobroker/create-adapter v2.3.0
 */

const utils = require("@iobroker/adapter-core");
const foundServerIPs = [];
const foundServerNames =[];
const foundReqTypes = [];
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
		const mdns = require("mdns");
		const ping = require("tcp-ping");
		const linkplayServiceType = mdns.tcp("linkplay");
		const mDNSSearchBrowser = mdns.createBrowser(linkplayServiceType);
		const searchDurationInMilliseconds = 5000;
		mDNSSearchBrowser.on("serviceUp", service => {
			if (service && service.name) {
				//service.names.forEach(ipAddress => {
					foundServerIPs.push(service.addresses[0]);
					foundServerNames.push(service.name);
					//}
				//);
			}
		});
		mDNSSearchBrowser.on("error", error => {
			this.log.error("Error during mDNS search:", error);
			});
		mDNSSearchBrowser.start();
		setTimeout(() => {
			mDNSSearchBrowser.stop(); // Stops all mDNS browsers
			if (foundServerIPs.length > 0) {
				let counter = 1;
				foundServerIPs.forEach(ipAddress => {
					counter++;
				});

		for (let i = 0; i< foundServerNames.length; i++) {


			isJson("http://" + foundServerIPs[i]+"/httpapi.asp?command=getStatusEx")
				.then (result => {
					if (result) {
						myfunction(this, foundServerNames[i], foundServerIPs[i], 80, "http");
						foundReqTypes[i] = "http"; 
					} 
					else {
						myfunction(this, foundServerNames[i], foundServerIPs[i], 443, "https");
						foundReqTypes[i] = "https";
					}

				})
					

			 
		}


		} else {
		this.log.info("No Linkplay servers found in the network.");
		}
		}, searchDurationInMilliseconds);

		


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
			const statename = id.split(".");
			const index = foundServerNames.indexOf(statename[2]);
			const IP_Address = foundServerIPs[index];
			const reqtype = foundReqTypes[index];
			const mysubstring = statename[0]+"."+statename[1]+"."+ statename[2]+".";
			switch (id) {

				case mysubstring+"setShutdown":

					this.getState(mysubstring+"setShutdown", (err, state)=> {

						sendWiimcommand(this, "setShutdown:"+state.val,IP_Address, reqtype);
					});
					break;

				case mysubstring+"playPromptUrl":

					this.getState(mysubstring+"playPromptUrl", (err, state)=> {

						sendWiimcommand(this, "playPromptUrl:"+state.val,IP_Address, reqtype);
					});
					break;


				case mysubstring+"switchmode":
					this.getState(mysubstring+"switchmode", (err, state)=> {

						sendWiimcommand(this, "setPlayerCmd:switchmode:"+state.val,IP_Address, reqtype);
					});
					break;


				case mysubstring+"jumptopos":

					this.getState(mysubstring+"jumptopos", (err, state)=> {

						sendWiimcommand(this, "setPlayerCmd:seek:"+state.val/1000,IP_Address, reqtype);
					});
					break;

				case mysubstring+"jumptopli":

					this.getState(mysubstring+"jumptopli", (err, state)=> {

						sendWiimcommand(this, "setPlayerCmd:playlist:"+state.val,IP_Address, reqtype);
					});
					break;

				case mysubstring+"Play_Pause":
					sendWiimcommand(this, "setPlayerCmd:onepause",IP_Address, reqtype);
					break;

				case mysubstring+"next":
					sendWiimcommand(this, "setPlayerCmd:next",IP_Address, reqtype);
					break;


				case mysubstring+"previous":
					sendWiimcommand(this, "setPlayerCmd:previous",IP_Address, reqtype);
					break;


				case mysubstring+"volume":

					this.getState(mysubstring+"volume", (err, state)=> {

						sendWiimcommand(this, "setPlayerCmd:vol:"+state.val,IP_Address, reqtype);
					});
					break;


				case mysubstring+"play_preset":
					this.getState(mysubstring+"play_preset", (err, state)=> {
						sendWiimcommand(this, "MCUKeyShortClick:"+state.val,IP_Address, reqtype);
					});
					break;

				case mysubstring+"play_URL":
					this.getState(mysubstring+"play_URL", (err, state)=> {
						sendWiimcommand(this, "setPlayerCmd:play:"+state.val,IP_Address, reqtype);
					});
					break;



				case id.mysubstring+"toggle_loop_mode":
					this.getState(mysubstring+"toggle_loop_mode", ()=> {

						sendWiimcommand(this, "setPlayerCmd:loopmode:1",IP_Address, reqtype);
					});
					break;

				case mysubstring+"setMaster":
					this.getState(mysubstring+"setMaster", (err, state)=> {

						sendWiimcommand(this, "ConnectMasterAp:JoinGroupMaster:eth"+state.val,IP_Address, reqtype);
					});
					break;

				case mysubstring+"leaveSyncGroup":
					this.getState(mysubstring+"leaveSyncGroup", ()=> {
						sendWiimcommand(this, "ConnectMasterAp:JoinGroupMaster:eth0.0.0.0",IP_Address, reqtype);
						sendWiimcommand(this, "ConnectMasterAp:LeaveGroup",IP_Address, reqtype);
					});
					break;

			}

		}

	}

}


async function getWiimData(mywiimadapter, reqtype, ServName, IP_Address)
{
	let pingport = 443;
	if (reqtype == "http"){
		pingport = 80;
	}
	const tcpp = require("tcp-ping");
	tcpp.probe(IP_Address, pingport, (err, available)=> {
		if (available){


			const http = require(reqtype);

			//*********************** request Wiim's playing info and uupdate corresponding datapoints */
			if (reqtype == "https") {	//only Wiim supports getMetaInfo
				const url = reqtype+"://"+IP_Address+"/httpapi.asp?command=getMetaInfo";

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
							mywiimadapter.setState(ServName + ".album",json.metaData.album,true);
							mywiimadapter.setState(ServName + ".title",json.metaData.title,true);
							mywiimadapter.setState(ServName + ".artist",json.metaData.artist,true);
							mywiimadapter.setState(ServName + ".albumArtURI",json.metaData.albumArtURI,true);
							mywiimadapter.setState(ServName + ".sampleRate",json.metaData.sampleRate,true);
							mywiimadapter.setState(ServName + ".bitDepth",json.metaData.bitDepth,true);

						} catch (error) {

						}
					});

				}).on("error", (error) => {
					mywiimadapter.log.info("error1:" + error.message);
				});
			}

			const url = reqtype + "://"+IP_Address+"/httpapi.asp?command=getPlayerStatus";

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
						mywiimadapter.setState(ServName + ".loop_mode",json.loop,true);
						mywiimadapter.setState(ServName + ".volume",json.vol,true);

						switch (json.mode) {
							case("0"):
								mywiimadapter.setState(ServName + ".mode","idling",true);
								break;

							case("1"):
								mywiimadapter.setState(ServName + ".mode","Airplay",true);
								break;

							case("2"):
								mywiimadapter.setState(ServName + ".mode","DLNA",true);
								break;

							case("10"):
								mywiimadapter.setState(ServName + ".mode","Network",true);
								break;

							case("11"):
								mywiimadapter.setState(ServName + ".mode","UDISK",true);
								break;

							case("20"):
								mywiimadapter.setState(ServName + ".mode","HTTPAPI",true);
								break;

							case("31"):
								mywiimadapter.setState(ServName + ".mode","Spotify Connect",true);
								break;

							case("40"):
								mywiimadapter.setState(ServName + ".mode","Line-In #1",true);
								break;

							case("41"):
								mywiimadapter.setState(ServName + ".mode","Bluetooth",true);
								break;

							case("43"):
								mywiimadapter.setState(ServName + ".mode","Optical",true);
								break;

							case("45"):
								mywiimadapter.setState(ServName + ".mode","co-axial",true);
								break;

							case("47"):
								mywiimadapter.setState(ServName + ".mode","Line-In #2",true);
								break;

							case("49"):
								mywiimadapter.setState(ServName + ".mode","HDMI",true);
								break;

							case("51"):
								mywiimadapter.setState(ServName + ".mode","USBDAC",true);
								break;

							case("99"):
								mywiimadapter.setState(ServName + ".mode","MR Guest",true);
								break;

						}

						mywiimadapter.setState(ServName + ".curpos",Position,false);
						mywiimadapter.setState(ServName + ".offset_pts",Offset_PTS,true);
						mywiimadapter.setState(ServName + ".tracklength",TotLen,false);
						mywiimadapter.setState(ServName + ".plicurr",PliCurr,false);
						if (reqtype == "http")  //arylic provide album, title and artist only as hex format
						{
							mywiimadapter.setState(ServName + ".album",hexToASCII(json.Album),true);
							mywiimadapter.setState(ServName + ".title",hexToASCII(json.Title),true);
							mywiimadapter.setState(ServName + ".artist",hexToASCII(json.Artist),true);
						}

					} catch (error) {
						mywiimadapter.log.info("no track playing -->" + error.message);
					}
				});

			}).on("error", (error) => {
				mywiimadapter.log.info("error2:" + error.message);
			});

			const theDate = new Date();
			const mydate = theDate.toString();
			mywiimadapter.setState(ServName + ".lastRefresh",mydate.substring(16,25),true);

		}
	});
	pollTimeout = setTimeout(function () {getWiimData(mywiimadapter,reqtype, ServName, IP_Address);}, mywiimadapter.config.Refresh_Interval*1000);
}

async function sendWiimcommand(mywiimadapter, wiimcmd, IP_Address, reqtype)
{
	const http = require(reqtype);
	http.get(reqtype+"://" + IP_Address + "/httpapi.asp?command="+wiimcmd, { validateCertificate: false, rejectUnauthorized: false, requestCert: true }, (err) => {



		if (err) {
			mywiimadapter.log.info(err.message);
		}
	});

}



async function myfunction (mywiimadapter,ServName,myIPAddress, pingport, reqtype) {


	const tcpp = require("tcp-ping");

	tcpp.probe(myIPAddress, pingport, (err, available)=> {
		if (available){
			mywiimadapter.log.info("server "+ServName+":"+pingport+ " responded to ping");}
		else {mywiimadapter.log.info("server " + ServName+":"+pingport + " does not seem to be online, no reaction to ping. Are you sure it's up and the IP address is correct?");}
	});


	mywiimadapter.setState("info.connection", false, true);
	// Reset the connection indicator during startup
	let json="";
	const http = require(reqtype);
	const url = reqtype + "://"+myIPAddress+"/httpapi.asp?command=getStatusEx";


	await mywiimadapter.setObjectNotExistsAsync(ServName+".Device_Name", {
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
				mywiimadapter.log.info("Device with firmware " + json.firmware+ " found. Ready to go!");
				mywiimadapter.setState("info.connection", true, true);
				mywiimadapter.setState(ServName + ".Device_Name",json.DeviceName,true);
			} catch (error) {
				this.log.error(error.message);
			}
		});

	}).on("error", (error) => {
		mywiimadapter.log.error(error.message);});

	await mywiimadapter.setObjectNotExistsAsync(ServName+".album", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".title", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName+".artist", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName+".albumArtURI", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName+".sampleRate", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".bitDepth", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName +".Play_Pause", {
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


	await mywiimadapter.setObjectNotExistsAsync(ServName + ".next", {
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


	await mywiimadapter.setObjectNotExistsAsync(ServName + ".previous", {
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


	await mywiimadapter.setObjectNotExistsAsync(ServName + ".loop_mode", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".lastRefresh", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".volume", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".play_preset", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".play_URL", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".toggle_loop_mode", {
		type: "state",
		common: {
			name: "toggle_loop_mode",
			type: "boolean",
			role: "indicator",
			read: true,
			write: true,
			def: false,
		},
		native: {},
	});

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".curpos", {
		type: "state",
		common: {
			name: "current_pos",
			type: "number",
			role: "indicator",
			read: true,
			write: true,
			def: 0,
		},
		native: {},
	});

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".offset_pts", {
		type: "state",
		common: {
			name: "offset_pts",
			type: "number",
			role: "indicator",
			read: true,
			write: false,
			def: 0,
		},
		native: {},
	});

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".setMaster", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".leaveSyncGroup", {
		type: "state",
		common: {
			name: "leaveSyncGroup",
			type: "boolean",
			role: "button",
			read: true,
			write: true,
			def: false,
		},
		native: {},
	});

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".tracklength", {
		type: "state",
		common: {
			name: "tracklength",
			type: "number",
			role: "indicator",
			read: true,
			write: true,
			def: 0,
		},
		native: {},
	});

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".plicurr", {
		type: "state",
		common: {
			name: "plicurr",
			type: "number",
			role: "indicator",
			read: true,
			write: true,
			def: 0,
		},
		native: {},
	});

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".jumptopos", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".jumptopli", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".mode", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".switchmode", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".playPromptUrl", {
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

	await mywiimadapter.setObjectNotExistsAsync(ServName + ".setShutdown", {
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


	mywiimadapter.subscribeStates(ServName + ".album", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".title", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".artist", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".albumArtURI", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".sampleRate", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".bitDepth", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".Play_Pause", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".next", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".previous", { val: true, ack: true });
	mywiimadapter.subscribeStates(ServName + ".lastRefresh", { val: true, ack: false });
	mywiimadapter.subscribeStates(ServName + ".volume", { val: true, ack: false });
	mywiimadapter.subscribeStates(ServName + ".play_preset", { val: true, ack: false });
	mywiimadapter.subscribeStates(ServName + ".play_URL", { val: true, ack: false });
	mywiimadapter.subscribeStates(ServName + ".loop_mode" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".toggle_loop_mode" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".setMaster" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".leaveSyncGroup" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".jumptopos" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".jumptopli" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".mode" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".switchmode" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".playPromptUrl" ,{ val: true, ack: false }) ;
	mywiimadapter.subscribeStates(ServName + ".setShutdown" ,{ val: true, ack: false }) ;

	getWiimData(mywiimadapter, reqtype, ServName, myIPAddress);

}




async function isJson(url) {
	try {
		const res = await fetch(url);
		const data = await res.json();
		return true;
	} catch (e) {
		return false;
		}
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