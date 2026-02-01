'use strict';
/*
 * Created with @iobroker/create-adapter v2.3.0
 */

const utils = require('@iobroker/adapter-core');
const foundStreamerIPs = [];
const foundStreamerNames = [];
const foundReqTypes = [];
let pollTimeout = null;

class Wiim extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options]
     */
    constructor(options) {
        super({
            ...options,
            name: 'wiim',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        const bonjour = require('bonjour')();
        let bonjourcounter = 0;
        let bonjourfinished = false;

        this.log.debug('Starting bonjour streamer discovery');
        bonjour.find({ type: 'linkplay' }, service => {
            foundStreamerNames.push(service.host.substring(0, service.host.indexOf('.')));
            foundStreamerIPs.push(service.addresses);
            const bonjourInterval = this.setInterval(() => {
                if (bonjourcounter >= 5 && foundStreamerNames.length >= 0) {
                    clearInterval(bonjourInterval);
                    bonjourfinished = true;
                }
                bonjourcounter++;
            }, 4000);
        });

        let splitfinished = false;
        const evalInterval = this.setInterval(() => {
            if (bonjourfinished) {
                for (let n = 0; n < foundStreamerNames.length; n++) {
                    const IPString = `${foundStreamerIPs[n]}`;
                    foundStreamerIPs[n] = IPString.substring(0, IPString.indexOf(','));
                    splitfinished = true;
                }
                this.clearInterval(evalInterval);
            }
        }, 3000);

        const outerInterval = setInterval(() => {
            const noStreamers = foundStreamerNames.length;
            if (noStreamers > 0 && splitfinished) {
                clearInterval(outerInterval);
                for (let i = 0; i < foundStreamerNames.length; i++) {
                    const innerInterval = setInterval(() => {
                        isJson(`http://${foundStreamerIPs[i]}/httpapi.asp?command=getStatusEx`)
                            .then(result => {
                                if (result) {
                                    //hier muss JSON ausgewertet werden => IP_address muss ermittelt werden
                                    this.log.debug(
                                        `streamer ${foundStreamerNames[i]}(${foundStreamerIPs[i]})` +
                                            ` uses http, assuming generic Linkplay product`,
                                    );
                                    foundReqTypes[i] = 'http';
                                    DataPointIni(this, i);
                                } else {
                                    foundReqTypes[i] = 'https';
                                    DataPointIni(this, i);
                                    this.log.debug(
                                        `streamer ${foundStreamerNames[i]}(${foundStreamerIPs[i]})` +
                                            ` uses https, assuming Wiim product`,
                                    );
                                }
                            })
                            .catch(error => {
                                this.log.debug(`Linkplay streamer query failed: ${error.message}`);
                            });

                        clearInterval(innerInterval);
                    }, 5000);
                }
            } else {
                this.log.debug(
                    'No streamers detected after 10s. If you are sure streamers are up and running, please open the control app, to trigger broadcast.',
                );
            }
        }, 10000);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.clearTimeout(pollTimeout);
            pollTimeout = null;
            callback();
        } catch (e) {
            console.log(e.message);
            callback();
        }
    }

    onStateChange(id, state) {
        if (state && !state.ack) {
            const statename = id.split('.');
            const index = foundStreamerNames.indexOf(statename[2]);
            const IP_Address = foundStreamerIPs[index];
            const reqtype = foundReqTypes[index];
            const mysubstring = `${statename[0]}.${statename[1]}.${statename[2]}.`;
            switch (id) {
                case `${mysubstring}setShutdown`:
                    this.getState(`${mysubstring}setShutdown`, (err, state) => {
                        sendWiimcommand(this, `setShutdown:${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}playPromptUrl`:
                    this.getState(`${mysubstring}playPromptUrl`, (err, state) => {
                        sendWiimcommand(this, `playPromptUrl:${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}switchmode`:
                    this.getState(`${mysubstring}switchmode`, (err, state) => {
                        sendWiimcommand(this, `setPlayerCmd:switchmode:${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}jumptopos`:
                    this.getState(`${mysubstring}jumptopos`, (err, state) => {
                        sendWiimcommand(this, `setPlayerCmd:seek:${state.val / 1000}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}jumptopli`:
                    this.getState(`${mysubstring}jumptopli`, (err, state) => {
                        sendWiimcommand(this, `setPlayerCmd:playlist:${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}Play_Pause`:
                    sendWiimcommand(this, 'setPlayerCmd:onepause', IP_Address, reqtype);
                    break;

                case `${mysubstring}next`:
                    sendWiimcommand(this, 'setPlayerCmd:next', IP_Address, reqtype);
                    break;

                case `${mysubstring}previous`:
                    sendWiimcommand(this, 'setPlayerCmd:previous', IP_Address, reqtype);
                    break;

                case `${mysubstring}volume`:
                    this.getState(`${mysubstring}volume`, (err, state) => {
                        sendWiimcommand(this, `setPlayerCmd:vol:${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}play_preset`:
                    this.getState(`${mysubstring}play_preset`, (err, state) => {
                        sendWiimcommand(this, `MCUKeyShortClick:${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}play_URL`:
                    this.getState(`${mysubstring}play_URL`, (err, state) => {
                        sendWiimcommand(this, `setPlayerCmd:play:${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${id.mysubstring}toggle_loop_mode`:
                    this.getState(`${mysubstring}toggle_loop_mode`, () => {
                        sendWiimcommand(this, 'setPlayerCmd:loopmode:1', IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}setMaster`:
                    this.getState(`${mysubstring}setMaster`, (err, state) => {
                        sendWiimcommand(this, `ConnectMasterAp:JoinGroupMaster:eth${state.val}`, IP_Address, reqtype);
                    });
                    break;

                case `${mysubstring}leaveSyncGroup`:
                    this.getState(`${mysubstring}leaveSyncGroup`, () => {
                        sendWiimcommand(this, 'ConnectMasterAp:JoinGroupMaster:eth0.0.0.0', IP_Address, reqtype);
                        sendWiimcommand(this, 'ConnectMasterAp:LeaveGroup', IP_Address, reqtype);
                    });
                    break;
            }
        }
    }
}

async function getWiimData(mywiimadapter, reqtype, ServName, IP_Address) {
    const http = require(`node:${reqtype}`);
    //*********************** request Wiim's playing info and uupdate corresponding datapoints */
    if (reqtype == 'https') {
        //only Wiim supports getMetaInfo
        const url = `${reqtype}://${IP_Address}/httpapi.asp?command=getMetaInfo`;
        http.get(url, { validateCertificate: false, rejectUnauthorized: false, requestCert: true }, res => {
            let body = '';
            //write response chunks to body
            res.on('data', chunk => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    // write info to states
                    mywiimadapter.setState(`${ServName}.album`, json.metaData.album, true);
                    mywiimadapter.setState(`${ServName}.title`, json.metaData.title, true);
                    mywiimadapter.setState(`${ServName}.artist`, json.metaData.artist, true);
                    mywiimadapter.setState(`${ServName}.albumArtURI`, json.metaData.albumArtURI, true);
                    mywiimadapter.setState(`${ServName}.sampleRate`, json.metaData.sampleRate, true);
                    mywiimadapter.setState(`${ServName}.bitDepth`, json.metaData.bitDepth, true);
                    mywiimadapter.setState(`${ServName}.online`, true, true);
                } catch (error) {
                    if (body != `Failed`) {
                        mywiimadapter.log.debug(
                            `something went wrong for ${ServName}at ${IP_Address} :${error.message}`,
                        );
                        mywiimadapter.log.debug(`The request sent to the server was: ${url}`);
                        mywiimadapter.log.debug(`The response was: ${body}`);
                    }
                }
            });
        }).on('error', error => {
            mywiimadapter.setState(`${ServName}.online`, false, true);
            mywiimadapter.setState(`${ServName}.lastError`, error.message, true);
        });
    } else {
        // if the streamer is a generic linkplay device, upnp is used to geht the album Art URI
        const UPnPClient = require('node-upnp');
        try {
            const client = new UPnPClient({
                url: `http://${IP_Address}:49152/description.xml`,
            });
            const volume = await client.call('AVTransport', 'GetInfoEx', {
                InstanceID: 0,
            });
            var mytext = volume.TrackMetaData.replace(/&gt;/g, '>').replace(/&lt;/g, '<');
            var tagposbegin = mytext.indexOf('<upnp:albumArtURI>') + 18;
            var tagposend = mytext.indexOf('</upnp:albumArtURI>');
            mywiimadapter.setState(`${ServName}.albumArtURI`, mytext.substring(tagposbegin, tagposend), true);
            mywiimadapter.setState(`${ServName}.online`, true, true);
        } catch {
            mywiimadapter.setState(`${ServName}.online`, false, true);
        }
    }

    const url = `${reqtype}://${IP_Address}/httpapi.asp?command=getPlayerStatus`;
    http.get(url, { validateCertificate: false, rejectUnauthorized: false, requestCert: true }, res => {
        let body = '';
        //write response chunks to body
        res.on('data', chunk => {
            body += chunk;
        });

        res.on('end', () => {
            try {
                const json = JSON.parse(body);
                // write info to statea
                const Position = Number(json.curpos);
                const Offset_PTS = Number(json.offset_pts);
                const TotLen = Number(json.totlen);
                const PliCurr = Number(json.plicurr);
                mywiimadapter.setState(`${ServName}.loop_mode`, json.loop, true);
                mywiimadapter.setState(`${ServName}.volume`, json.vol, true);
                mywiimadapter.setState(`${ServName}.online`, true, true);
                mywiimadapter.setState(`${ServName}.status`, json.status, true);
                switch (json.mode) {
                    case '0':
                        mywiimadapter.setState(`${ServName}.mode`, 'idling', true);
                        break;

                    case '1':
                        mywiimadapter.setState(`${ServName}.mode`, 'Airplay', true);
                        break;

                    case '2':
                        mywiimadapter.setState(`${ServName}.mode`, 'DLNA', true);
                        break;

                    case '10':
                        mywiimadapter.setState(`${ServName}.mode`, 'Network', true);
                        break;

                    case '11':
                        mywiimadapter.setState(`${ServName}.mode`, 'UDISK', true);
                        break;

                    case '20':
                        mywiimadapter.setState(`${ServName}.mode`, 'HTTPAPI', true);
                        break;

                    case '31':
                        mywiimadapter.setState(`${ServName}.mode`, 'Spotify Connect', true);
                        break;

                    case '40':
                        mywiimadapter.setState(`${ServName}.mode`, 'Line-In #1', true);
                        break;

                    case '41':
                        mywiimadapter.setState(`${ServName}.mode`, 'Bluetooth', true);
                        break;

                    case '43':
                        mywiimadapter.setState(`${ServName}.mode`, 'Optical', true);
                        break;

                    case '45':
                        mywiimadapter.setState(`${ServName}.mode`, 'co-axial', true);
                        break;

                    case '47':
                        mywiimadapter.setState(`${ServName}.mode`, 'Line-In #2', true);
                        break;

                    case '49':
                        mywiimadapter.setState(`${ServName}.mode`, 'HDMI', true);
                        break;

                    case '51':
                        mywiimadapter.setState(`${ServName}.mode`, 'USBDAC', true);
                        break;

                    case '99':
                        mywiimadapter.setState(`${ServName}.mode`, 'MR Guest', true);
                        break;
                }

                mywiimadapter.setState(`${ServName}.curpos`, Position, true);
                mywiimadapter.setState(`${ServName}.offset_pts`, Offset_PTS, true);
                mywiimadapter.setState(`${ServName}.tracklength`, TotLen, true);
                mywiimadapter.setState(`${ServName}.plicurr`, PliCurr, true);
                if (reqtype == 'http') {
                    //arylic provide album, title and artist only as hex format
                    mywiimadapter.setState(`${ServName}.album`, hexToASCII(json.Album), true);
                    mywiimadapter.setState(`${ServName}.title`, hexToASCII(json.Title), true);
                    mywiimadapter.setState(`${ServName}.artist`, hexToASCII(json.Artist), true);
                    mywiimadapter.setState(`${ServName}.status`, hexToASCII(json.Status), true);
                }
            } catch (error) {
                mywiimadapter.log.debug(`no track playing: ${error.message}`);
            }
        });
    }).on('error', error => {
        mywiimadapter.setState(`${ServName}.online`, false, true);
        mywiimadapter.setState(`${ServName}.lastError`, error.message, true);
    });

    const theDate = new Date();
    const mydate = theDate.toString();
    mywiimadapter.setState(`${ServName}.lastRefresh`, mydate.substring(16, 25), true);

    let MyRefresh = mywiimadapter.config.Refresh_Interval;

    if (MyRefresh > 2000000) {
        MyRefresh = 2000000;
        mywiimadapter.log.info('refresh interval limited to 2000000');
    }
    pollTimeout = setTimeout(function () {
        getWiimData(mywiimadapter, reqtype, ServName, IP_Address);
    }, MyRefresh * 1000);
}

// ***********************   Retrieve data from streamer@IP_address using command wiimcmd and reqtype http or https   ************************
async function sendWiimcommand(mywiimadapter, wiimcmd, IP_Address, reqtype) {
    const http = require(reqtype);
    http.get(
        `${reqtype}://${IP_Address}/httpapi.asp?command=${wiimcmd}`,
        { validateCertificate: false, rejectUnauthorized: false, requestCert: true },
        err => {
            if (!err) {
                mywiimadapter.log.debug(err);
            }
        },
    );
}

async function DataPointIni(mywiimadapter, StreamerIndex) {
    const ServName = foundStreamerNames[StreamerIndex];
    const myIPAddress = foundStreamerIPs[StreamerIndex];
    const reqtype = foundReqTypes[StreamerIndex];
    mywiimadapter.setState('info.connection', false, true);
    // Reset the connection indicator during startup
    let json = '';
    const http = require(reqtype);
    const url = `${reqtype}://${myIPAddress}/httpapi.asp?command=getStatusEx`;

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.Device_Name`, {
        type: 'state',
        common: {
            name: 'Device_Name',
            type: 'string',
            role: 'indicator',
            read: true,
            write: false,
        },
        native: {},
    });

    http.get(url, { validateCertificate: false, rejectUnauthorized: false, requestCert: true }, res => {
        let body = '';
        //write response chunks to body
        res.on('data', chunk => {
            body += chunk;
        });

        res.on('end', () => {
            try {
                json = JSON.parse(body);
                mywiimadapter.setState('info.connection', true, true);
                mywiimadapter.setState(`${ServName}.Device_Name`, name2id(json.DeviceName, mywiimadapter), true);
            } catch (error) {
                mywiimadapter.log.error(`Parse error: ${error.message}`);
            }
        });
    }).on('error', error => {
        mywiimadapter.log.debug(
            `Could not retrieve data from streamer ${ServName} at ${myIPAddress}. Is it up and connected to same network --> ${error.message}`,
        );
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}`, {
        type: 'device',
        common: {
            name: `${ServName}`,
            type: 'device',
            read: false,
            write: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.album`, {
        type: 'state',
        common: {
            name: 'album',
            type: 'string',
            role: 'media.album',
            read: true,
            write: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.ipaddress`, {
        type: 'state',
        common: {
            name: 'IP_address',
            type: 'string',
            role: 'info.ip',
            read: true,
            write: false,
            def: myIPAddress,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.online`, {
        type: 'state',
        common: {
            name: 'online',
            type: 'boolean',
            role: 'info.status',
            read: true,
            write: false,
            def: true,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.status`, {
        type: 'state',
        common: {
            name: 'status',
            type: 'string',
            role: 'media.state',
            read: true,
            write: false,
            def: 'tbd',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.title`, {
        type: 'state',
        common: {
            name: 'title',
            type: 'string',
            role: 'media.title',
            read: true,
            write: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.artist`, {
        type: 'state',
        common: {
            name: 'artist',
            type: 'string',
            role: 'media.artist',
            read: true,
            write: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.albumArtURI`, {
        type: 'state',
        common: {
            name: 'albumArtURI',
            type: 'string',
            role: 'media.cover',
            read: true,
            write: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.sampleRate`, {
        type: 'state',
        common: {
            name: 'samplRate',
            type: 'string',
            role: 'media.bitrate',
            read: true,
            write: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.bitDepth`, {
        type: 'state',
        common: {
            name: 'bitDepth',
            type: 'string',
            role: 'media.bitrate',
            read: true,
            write: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.Play_Pause`, {
        type: 'state',
        common: {
            name: 'Play_Pause',
            type: 'boolean',
            role: 'button.play',
            read: false,
            write: true,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.next`, {
        type: 'state',
        common: {
            name: 'next',
            type: 'boolean',
            role: 'button.next',
            read: false,
            write: true,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.previous`, {
        type: 'state',
        common: {
            name: 'previous',
            type: 'boolean',
            role: 'button.prev',
            read: false,
            write: true,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.loop_mode`, {
        type: 'state',
        common: {
            name: 'loop_mode',
            type: 'string',
            role: 'media.mode.repeat',
            read: true,
            write: false,
            def: 'to be read',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.lastRefresh`, {
        type: 'state',
        common: {
            name: 'lastRefresh',
            type: 'string',
            role: 'value.time',
            read: true,
            write: false,
            def: 'never',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.volume`, {
        type: 'state',
        common: {
            name: 'volume',
            type: 'string',
            role: 'level.volume',
            read: true,
            write: true,
            def: '15',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.play_preset`, {
        type: 'state',
        common: {
            name: 'play_preset',
            type: 'string',
            role: 'media.playid',
            read: true,
            write: true,
            def: 'none',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.play_URL`, {
        type: 'state',
        common: {
            name: 'play_URL',
            type: 'string',
            role: 'media.url',
            read: true,
            write: true,
            def: 'none',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.toggle_loop_mode`, {
        type: 'state',
        common: {
            name: 'toggle_loop_mode',
            type: 'boolean',
            role: 'button',
            read: false,
            write: true,
            def: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.curpos`, {
        type: 'state',
        common: {
            name: 'current_pos',
            type: 'number',
            role: 'media.elapsed',
            read: true,
            write: false,
            def: 0,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.offset_pts`, {
        type: 'state',
        common: {
            name: 'offset_pts',
            type: 'number',
            role: 'media.jump',
            read: true,
            write: false,
            def: 0,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.setMaster`, {
        type: 'state',
        common: {
            name: 'setMaster',
            type: 'string',
            role: 'info.ip',
            read: true,
            write: true,
            def: '0.0.0.0',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.leaveSyncGroup`, {
        type: 'state',
        common: {
            name: 'leaveSyncGroup',
            type: 'boolean',
            role: 'button',
            read: false,
            write: true,
            def: false,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.tracklength`, {
        type: 'state',
        common: {
            name: 'tracklength',
            type: 'number',
            role: 'media.duration',
            read: true,
            write: false,
            def: 0,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.plicurr`, {
        type: 'state',
        common: {
            name: 'plicurr',
            type: 'number',
            role: 'media.track',
            read: true,
            write: false,
            def: 0,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.jumptopos`, {
        type: 'state',
        common: {
            name: 'jumptopos',
            type: 'number',
            role: 'media.elapsed',
            read: true,
            write: true,
            def: 0,
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.jumptopli`, {
        type: 'state',
        common: {
            name: 'jumptopli',
            type: 'string',
            role: 'media.jump',
            read: true,
            write: true,
            def: '',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.mode`, {
        type: 'state',
        common: {
            name: 'mode',
            type: 'string',
            role: 'media.input',
            read: true,
            write: false,
            def: '',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.switchmode`, {
        type: 'state',
        common: {
            name: 'switchmode',
            type: 'string',
            role: 'media.input',
            read: true,
            write: true,
            def: '',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.playPromptUrl`, {
        type: 'state',
        common: {
            name: 'playPromptUrl',
            type: 'string',
            role: 'media.url.announecment',
            read: true,
            write: true,
            def: '',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.lastError`, {
        type: 'state',
        common: {
            name: 'lastError',
            type: 'string',
            role: 'text',
            read: true,
            write: false,
            def: 'none',
        },
        native: {},
    });

    await mywiimadapter.setObjectNotExistsAsync(`${ServName}.setShutdown`, {
        type: 'state',
        common: {
            name: 'setShutdown',
            role: 'level.timer',
            type: 'string',
            read: false,
            write: true,
            def: '',
        },
        native: {},
    });
    mywiimadapter.subscribeStates(`${ServName}.Play_Pause`);
    mywiimadapter.subscribeStates(`${ServName}.next`);
    mywiimadapter.subscribeStates(`${ServName}.previous`);
    mywiimadapter.subscribeStates(`${ServName}.volume`);
    mywiimadapter.subscribeStates(`${ServName}.play_preset`);
    mywiimadapter.subscribeStates(`${ServName}.play_URL`);
    mywiimadapter.subscribeStates(`${ServName}.toggle_loop_mode`);
    mywiimadapter.subscribeStates(`${ServName}.setMaster`);
    mywiimadapter.subscribeStates(`${ServName}.leaveSyncGroup`);
    mywiimadapter.subscribeStates(`${ServName}.jumptopos`);
    mywiimadapter.subscribeStates(`${ServName}.jumptopli`);
    mywiimadapter.subscribeStates(`${ServName}.switchmode`);
    mywiimadapter.subscribeStates(`${ServName}.playPromptUrl`);
    getWiimData(mywiimadapter, reqtype, ServName, myIPAddress);
}

async function isJson(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`anfrage gescheitert! ${res.status}`);
        }
        return true;
    } catch (error) {
        console.log(`error:${error.message}`);
        return false;
    }
    //const data = await res.json();
    //return res;
}

function hexToASCII(hex) {
    let ascii = '';
    for (let i = 0; i < hex.length; i += 2) {
        const part = hex.substring(i, i + 2);
        const ch = String.fromCharCode(parseInt(part, 16));
        ascii = ascii + ch;
    }
    return ascii;
}
function name2id(pName, mywiimadapter) {
    return (pName || '').replace(mywiimadapter.FORBIDDEN_CHARS, '_').replace('', '_').replace('.', '_');
}
if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options]
     */
    module.exports = options => new Wiim(options);
} else {
    // otherwise start the instance directly
    new Wiim();
}
