'use strict';
/*
 * Created with @iobroker/create-adapter v2.3.0
 * Optimized, refactored & extended with full Arylic/WiiM API coverage
 */

const utils = require('@iobroker/adapter-core');

// ── HTTP modules loaded once at startup ──────────────────────────────────────
const httpModule = require('node:http');
const httpsModule = require('node:https');

// ── Constants ────────────────────────────────────────────────────────────────

/** Bonjour discovery re-check interval (ms) */
const DISCOVERY_INTERVAL_MS = 15_000;
/** Upper bound for the user-configurable polling interval (seconds) */
const MAX_REFRESH_INTERVAL_S = 2_000_000;
/** HTTP request timeout per device (ms) */
const REQUEST_TIMEOUT_MS = 5_000;
/** Initial delay before first discovery run, giving Bonjour time to find devices (ms) */
const DISCOVERY_INITIAL_DELAY_MS = 3_000;
/**
 * How often device-info (firmware, battery, RSSI…) is polled.
 * These values change rarely, so we poll them every N playback cycles.
 */
const DEVICE_INFO_EVERY_N_CYCLES = 10;

/**
 * Shared options for all HTTP/HTTPS requests to WiiM / LinkPlay devices.
 * Certificate validation intentionally disabled – devices use self-signed certs.
 */
const HTTP_OPTIONS = { rejectUnauthorized: false, requestCert: true };

/**
 * Maps a LinkPlay mode string (as returned by the API) to a human-readable label.
 * String keys match the raw API response directly. (Arylic + WiiM docs combined)
 */
const MODE_MAP = {
	'0': 'idling',
	'1': 'Airplay',
	'2': 'DLNA',
	'10': 'Network',
	'11': 'UDISK',
	'16': 'TF Card',
	'20': 'HTTPAPI',
	'31': 'Spotify Connect',
	'32': 'TIDAL Connect',
	'40': 'Line-In',
	'41': 'Bluetooth',
	'42': 'External Storage',
	'43': 'Optical',
	'45': 'co-axial',
	'47': 'Line-In #2',
	'49': 'HDMI',
	'50': 'Mirror',
	'51': 'USBDAC',
	'60': 'Voice Mail',
	'99': 'MR Guest',
};

/**
 * Maps the `loop` field from getPlayerStatus to a human-readable label.
 * Both Arylic and WiiM APIs use these values.
 */
const LOOP_MAP = {
	'0': 'Repeat all',
	'1': 'Repeat once',
	'2': 'Shuffle + Repeat',
	'3': 'Shuffle',
	'4': 'No repeat',
	'5': 'Shuffle + Repeat once',
};

// ── Type definitions ──────────────────────────────────────────────────────────

/**
 * @typedef  {object} StreamerInfo
 * @property {string}  name         - Bonjour service name / ioBroker namespace segment
 * @property {string}  ip           - Resolved IPv4 address
 * @property {'http'|'https'} reqtype - Protocol supported by this device
 * @property {object|null} upnpClient  - Cached UPnP client instance
 * @property {number}  pollCycle    - Incremented on each poll; used to throttle slow queries
 */

// ── Streamer registry ─────────────────────────────────────────────────────────

/** @type {Map<string, StreamerInfo>} name → StreamerInfo */
const streamers = new Map();

// ── Discovery state ───────────────────────────────────────────────────────────

/** Bonjour discoveries not yet initialised. Set avoids duplicates. */
const pendingDiscoveries = new Set(); // Set<JSON-string of {name, ip}>

let discoveryTimeout = null;
let discoveryRunning = false;
let bonjourInstance = null;

// ── Per-streamer polling handles ──────────────────────────────────────────────

/** @type {Map<string, ReturnType<utils.Adapter['setTimeout']>>} */
const pollTimeouts = new Map();

// ── Unload guard ──────────────────────────────────────────────────────────────

/** True once onUnload fires. Prevents post-shutdown setState calls. */
let isUnloading = false;

// ─────────────────────────────────────────────────────────────────────────────

class Wiim extends utils.Adapter {
	/** @param {Partial<utils.AdapterOptions>} [options] */
	constructor(options) {
		super({ ...options, name: 'wiim' });
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async onReady() {
		// Validate and normalise the refresh interval once at startup
		this._refreshIntervalMs = normaliseRefreshInterval(
			Number(this.config.Refresh_Interval) || 10,
			this,
		);

		// Subscribe once – not once per discovered streamer
		this.subscribeStates('*');

		this.log.debug('Starting Bonjour streamer discovery');
		const bonjour = require('bonjour')();
		bonjourInstance = bonjour;

		bonjour.find({ type: 'linkplay' }, (service) => {
			if (!service || !service.host) {
				this.log.debug('Bonjour: received service without host, skipping');
				return;
			}
			const name = service.host.substring(0, service.host.indexOf('.'));
			const addrList = Array.isArray(service.addresses)
				? service.addresses
				: `${service.addresses}`.split(',');
			const ip = (addrList[0] || '').trim();
			if (!ip) {
				this.log.debug(`Bonjour: no IP for ${name}, skipping`);
				return;
			}

			const existing = streamers.get(name);
			if (existing) {
				// Device already known – it may have come back online after an outage.
				// If polling has stopped (no active timeout), restart it.
				if (!pollTimeouts.has(name)) {
					this.log.info(`Bonjour: known streamer ${name} reappeared – restarting poll`);
					pollStreamer(this, existing);
				}
				return;
			}

			// New device: queue for initialisation
			const key = JSON.stringify({ name, ip });
			if (!pendingDiscoveries.has(key)) {
				this.log.debug(`Bonjour: queued new streamer ${name} @ ${ip}`);
				pendingDiscoveries.add(key);
				// Trigger an immediate discovery run instead of waiting up to 15 s
				if (!discoveryRunning) {
					this.clearTimeout(discoveryTimeout);
					discoveryTimeout = this.setTimeout(() => checkNewStreamers(this), 100);
				}
			}
		});

		// Initial delay lets Bonjour collect responses before the first check
		discoveryTimeout = this.setTimeout(
			() => checkNewStreamers(this),
			DISCOVERY_INITIAL_DELAY_MS,
		);
	}

	onUnload(callback) {
		isUnloading = true;
		try {
			for (const handle of pollTimeouts.values()) {
				this.clearTimeout(handle);
			}
			pollTimeouts.clear();
			this.clearTimeout(discoveryTimeout);
			discoveryTimeout = null;
			if (bonjourInstance) {
				try {
					bonjourInstance.destroy();
				} catch (_) {
					/* ignore */
				}
				bonjourInstance = null;
			}
			callback();
		} catch (e) {
			this.log.error(`onUnload error: ${e.message}`);
			callback();
		}
	}

	onStateChange(id, state) {
		if (!state || state.ack) return;

		const lastDot = id.lastIndexOf('.');
		if (lastDot < 0) return;
		const ns = id.substring(0, lastDot + 1);

		const withoutDatapoint = id.substring(0, lastDot);
		const secondLastDot = withoutDatapoint.lastIndexOf('.');
		if (secondLastDot < 0) return;
		const streamerName = withoutDatapoint.substring(secondLastDot + 1);

		const streamer = streamers.get(streamerName);
		if (!streamer) return;

		const { ip, reqtype } = streamer;
		const val = state.val;

		/** Send a command built from the current state value. */
		const send = (buildCmd) => sendWiimCommand(this, buildCmd(val), ip, reqtype);

		switch (id) {
			// ── Playback transport ──────────────────────────────────────────────
			case `${ns}Play_Pause`:
				sendWiimCommand(this, 'setPlayerCmd:onepause', ip, reqtype);
				break;
			case `${ns}pause`:
				sendWiimCommand(this, 'setPlayerCmd:pause', ip, reqtype);
				break;
			case `${ns}resume`:
				sendWiimCommand(this, 'setPlayerCmd:resume', ip, reqtype);
				break;
			case `${ns}stop`:
				sendWiimCommand(this, 'setPlayerCmd:stop', ip, reqtype);
				break;
			case `${ns}next`:
				sendWiimCommand(this, 'setPlayerCmd:next', ip, reqtype);
				break;
			case `${ns}previous`:
				sendWiimCommand(this, 'setPlayerCmd:prev', ip, reqtype);
				break;

			// ── Volume & mute ───────────────────────────────────────────────────
			case `${ns}volume`:
				send((v) => `setPlayerCmd:vol:${v}`);
				break;
			case `${ns}volume_up`:
				sendWiimCommand(this, 'setPlayerCmd:vol%2b%2b', ip, reqtype);
				break;
			case `${ns}volume_down`:
				sendWiimCommand(this, 'setPlayerCmd:vol--', ip, reqtype);
				break;
			case `${ns}mute`:
				send((v) => `setPlayerCmd:mute:${v ? '1' : '0'}`);
				break;

			// ── Position & playlist ─────────────────────────────────────────────
			case `${ns}jumptopos`:
				send((v) => `setPlayerCmd:seek:${Number(v) / 1000}`);
				break;
			case `${ns}jumptopli`:
				send((v) => `setPlayerCmd:playlist:${v}`);
				break;
			case `${ns}play_index`:
				send((v) => `setPlayerCmd:playindex:${v}`);
				break;
			case `${ns}play_local`:
				send((v) => `setPlayerCmd:playLocalList:${v}`);
				break;

			// ── Loop / shuffle ──────────────────────────────────────────────────
			case `${ns}loopmode`:
				send((v) => `setPlayerCmd:loopmode:${v}`);
				break;
			case `${ns}toggle_loop_mode`:
				sendWiimCommand(this, 'setPlayerCmd:loopmode:1', ip, reqtype);
				break;

			// ── Source & URLs ───────────────────────────────────────────────────
			case `${ns}switchmode`:
				send((v) => `setPlayerCmd:switchmode:${v}`);
				break;
			case `${ns}play_URL`:
				send((v) => `setPlayerCmd:play:${v}`);
				break;
			case `${ns}play_m3u`:
				send((v) => `setPlayerCmd:m3u:play:${v}`);
				break;
			case `${ns}play_preset`:
				send((v) => `MCUKeyShortClick:${v}`);
				break;
			case `${ns}playPromptUrl`:
				send((v) => `playPromptUrl:${v}`);
				break;

			// ── EQ (WiiM only) ──────────────────────────────────────────────────
			case `${ns}eq_on`:
				sendWiimCommand(this, 'EQOn', ip, reqtype);
				break;
			case `${ns}eq_off`:
				sendWiimCommand(this, 'EQOff', ip, reqtype);
				break;
			case `${ns}eq_load`:
				send((v) => `EQLoad:${v}`);
				break;

			// ── Device control ──────────────────────────────────────────────────
			case `${ns}reboot`:
				sendWiimCommand(this, 'reboot', ip, reqtype);
				break;
			case `${ns}setShutdown`:
				send((v) => `setShutdown:${v}`);
				break;

			// ── Multiroom ───────────────────────────────────────────────────────
			case `${ns}setMaster`:
				send((v) => `ConnectMasterAp:JoinGroupMaster:eth${v}`);
				break;
			case `${ns}leaveSyncGroup`:
				sendWiimCommand(
					this,
					'ConnectMasterAp:JoinGroupMaster:eth0.0.0.0',
					ip,
					reqtype,
				);
				sendWiimCommand(this, 'ConnectMasterAp:LeaveGroup', ip, reqtype);
				break;
			case `${ns}multiroom_ungroup`:
				sendWiimCommand(this, 'multiroom:Ungroup', ip, reqtype);
				break;
			case `${ns}multiroom_kickout`:
				send((v) => `multiroom:SlaveKickout:${v}`);
				break;
			case `${ns}multiroom_slave_volume`:
				// val format: "ip:volume" e.g. "192.168.1.50:60"
				send((v) => `multiroom:SlaveVolume:${v}`);
				break;
			case `${ns}multiroom_slave_mute`:
				// val format: "ip:0" or "ip:1"
				send((v) => `multiroom:SlaveMute:${v}`);
				break;
		}
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Performs a single HTTP(S) GET with a timeout and explicit Host header.
 * @param {'http'|'https'} reqtype
 * @param {string} url
 * @returns {Promise<{statusCode: number, body: string}>}
 */
function httpGet(reqtype, url) {
	const http = reqtype === 'https' ? httpsModule : httpModule;
	const parsed = new URL(url);
	const options = {
		...HTTP_OPTIONS,
		headers: { Host: parsed.hostname },
	};
	return new Promise((resolve, reject) => {
		const req = http.get(url, options, (res) => {
			let body = '';
			res.on('data', (chunk) => (body += chunk));
			res.on('end', () => resolve({ statusCode: res.statusCode || 200, body }));
		});
		req.on('error', reject);
		req.setTimeout(REQUEST_TIMEOUT_MS, () => {
			req.destroy(
				new Error(`Request to ${url} timed out after ${REQUEST_TIMEOUT_MS} ms`),
			);
		});
	});
}

/**
 * Returns true if the device at `ip` responds to plain HTTP.
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function supportsHttp(ip) {
	try {
		const { statusCode } = await httpGet(
			'http',
			`http://${ip}/httpapi.asp?command=getStatusEx`,
		);
		return statusCode >= 200 && statusCode < 400;
	} catch (_) {
		return false;
	}
}

/**
 * Decodes a hex-encoded UTF-8 string as used by Arylic/LinkPlay devices.
 * @param {string} hex
 * @returns {string}
 */
function hexToUtf8(hex) {
	if (!hex || typeof hex !== 'string' || hex.length % 2 !== 0) return '';
	try {
		return Buffer.from(hex, 'hex').toString('utf8');
	} catch (_) {
		return '';
	}
}

/**
 * Converts a raw device name into a valid ioBroker state-ID segment.
 * @param {string} pName
 * @param {InstanceType<typeof Wiim>} adapter
 * @returns {string}
 */
function name2id(pName, adapter) {
	return (pName || '').replace(adapter.FORBIDDEN_CHARS, '_').replace(/\./g, '_');
}

/**
 * Clamps and returns the polling interval in milliseconds.
 * @param {number} configuredS
 * @param {InstanceType<typeof Wiim>} adapter
 * @returns {number}
 */
function normaliseRefreshInterval(configuredS, adapter) {
	if (configuredS > MAX_REFRESH_INTERVAL_S) {
		adapter.log.warn(
			`Refresh_Interval ${configuredS} s exceeds maximum – capped at ${MAX_REFRESH_INTERVAL_S} s`,
		);
		return MAX_REFRESH_INTERVAL_S * 1000;
	}
	if (configuredS < 1) {
		adapter.log.warn('Refresh_Interval must be at least 1 s – using 10 s');
		return 10_000;
	}
	return configuredS * 1000;
}

// ── Core polling ──────────────────────────────────────────────────────────────

/**
 * Fetches current playback + device state from one streamer and writes to ioBroker.
 * Device-info (firmware, battery, RSSI…) is polled every DEVICE_INFO_EVERY_N_CYCLES.
 * @param {InstanceType<typeof Wiim>} adapter
 * @param {StreamerInfo} streamer
 */
async function pollStreamer(adapter, streamer) {
	if (isUnloading) return;

	const { name, ip, reqtype } = streamer;
	streamer.pollCycle = (streamer.pollCycle || 0) + 1;

	// ── WiiM: rich metadata via getMetaInfo ───────────────────────────────────
	if (reqtype === 'https') {
		try {
			const { body } = await httpGet(
				reqtype,
				`${reqtype}://${ip}/httpapi.asp?command=getMetaInfo`,
			);
			if (isUnloading) return;
			const json = JSON.parse(body);
			const md = json.metaData;
			adapter.setState(`${name}.album`, md.album, true);
			adapter.setState(`${name}.title`, md.title, true);
			adapter.setState(`${name}.artist`, md.artist, true);
			adapter.setState(`${name}.albumArtURI`, md.albumArtURI, true);
			adapter.setState(`${name}.sampleRate`, md.sampleRate, true);
			adapter.setState(`${name}.bitDepth`, md.bitDepth, true);
		} catch (error) {
			if (!error.message.includes('Failed')) {
				adapter.log.debug(`getMetaInfo error for ${name}: ${error.message}`);
			}
		}
	} else {
		// ── Arylic/LinkPlay: album art via UPnP ──────────────────────────────
		try {
			if (!streamer.upnpClient) {
				const UPnPClient = require('node-upnp');
				streamer.upnpClient = new UPnPClient({
					url: `http://${ip}:49152/description.xml`,
				});
			}
			const result = await streamer.upnpClient.call('AVTransport', 'GetInfoEx', {
				InstanceID: 0,
			});
			if (isUnloading) return;
			const xml = result.TrackMetaData.replace(/&gt;/g, '>').replace(/&lt;/g, '<');
			const start = xml.indexOf('<upnp:albumArtURI>') + 18;
			const end = xml.indexOf('</upnp:albumArtURI>');
			if (start > 17 && end > start) {
				adapter.setState(`${name}.albumArtURI`, xml.substring(start, end), true);
			}
		} catch (error) {
			streamer.upnpClient = null;
			adapter.log.debug(`UPnP albumArtURI error for ${name}: ${error.message}`);
		}
	}

	// ── Playback status (both device types) ──────────────────────────────────
	try {
		const { body } = await httpGet(
			reqtype,
			`${reqtype}://${ip}/httpapi.asp?command=getPlayerStatus`,
		);
		if (isUnloading) return;
		const json = JSON.parse(body);

		adapter.setState(`${name}.volume`, Number(json.vol), true);
		adapter.setState(`${name}.mute`, json.mute === '1', true);
		adapter.setState(`${name}.status`, json.status, true);
		adapter.setState(`${name}.curpos`, Number(json.curpos), true);
		adapter.setState(`${name}.offset_pts`, Number(json.offset_pts), true);
		adapter.setState(`${name}.tracklength`, Number(json.totlen), true);
		adapter.setState(`${name}.plicurr`, Number(json.plicurr), true);
		adapter.setState(`${name}.plicount`, Number(json.plicount), true);
		adapter.setState(`${name}.eq`, json.eq, true);
		adapter.setState(`${name}.ch`, json.ch, true);
		adapter.setState(`${name}.type`, json.type, true);

		// Loop mode: store both raw value and human-readable label
		adapter.setState(`${name}.loop_mode`, json.loop, true);
		if (Object.prototype.hasOwnProperty.call(LOOP_MAP, json.loop)) {
			adapter.setState(`${name}.loop_mode_text`, LOOP_MAP[json.loop], true);
		}

		if (Object.prototype.hasOwnProperty.call(MODE_MAP, json.mode)) {
			adapter.setState(`${name}.mode`, MODE_MAP[json.mode], true);
		} else {
			adapter.log.debug(`${name}: unknown mode value '${json.mode}'`);
		}

		if (reqtype === 'http') {
			// Arylic encodes track fields as hex-encoded UTF-8
			adapter.setState(`${name}.album`, hexToUtf8(json.Album), true);
			adapter.setState(`${name}.title`, hexToUtf8(json.Title), true);
			adapter.setState(`${name}.artist`, hexToUtf8(json.Artist), true);
			adapter.setState(`${name}.status`, hexToUtf8(json.Status), true);
		}

		adapter.setState(
			`${name}.lastRefresh`,
			new Date().toTimeString().substring(0, 8),
			true,
		);
		adapter.setState(`${name}.alive`, true, true);
	} catch (error) {
		if (isUnloading) return;
		adapter.log.debug(`getPlayerStatus error for ${name}: ${error.message}`);
		adapter.setState(`${name}.alive`, false, true);
		adapter.setState(`${name}.lastError`, error.message, true);
		// Remove the timeout entry so the Bonjour callback can detect that polling
		// has stopped and will restart it when the device reappears on the network.
		pollTimeouts.delete(name);
		return;
	}

	// ── Device info: polled every N cycles to avoid flooding ─────────────────
	if (streamer.pollCycle % DEVICE_INFO_EVERY_N_CYCLES === 0) {
		await pollDeviceInfo(adapter, streamer);
	}

	// ── Schedule next poll ────────────────────────────────────────────────────
	if (!isUnloading) {
		const handle = adapter.setTimeout(
			() => pollStreamer(adapter, streamer),
			adapter._refreshIntervalMs,
		);
		pollTimeouts.set(name, handle);
	}
}

/**
 * Polls slowly-changing device metadata from getStatusEx and multiroom:getSlaveList.
 * Called every DEVICE_INFO_EVERY_N_CYCLES polling cycles.
 * @param {InstanceType<typeof Wiim>} adapter
 * @param {StreamerInfo} streamer
 */
async function pollDeviceInfo(adapter, streamer) {
	const { name, ip, reqtype } = streamer;

	// getStatusEx – firmware, battery, RSSI, network info …
	try {
		const { body } = await httpGet(
			reqtype,
			`${reqtype}://${ip}/httpapi.asp?command=getStatusEx`,
		);
		if (isUnloading) return;
		const json = JSON.parse(body);

		adapter.setState(`${name}.firmware`, json.firmware || '', true);
		adapter.setState(`${name}.uuid`, json.uuid || '', true);
		adapter.setState(`${name}.hardware`, json.hardware || '', true);
		adapter.setState(`${name}.internet`, json.internet === '1', true);
		adapter.setState(`${name}.battery_charging`, json.battery === '1', true);
		adapter.setState(`${name}.battery_percent`, Number(json.battery_percent) || 0, true);
		adapter.setState(`${name}.rssi`, Number(json.RSSI) || 0, true);
		adapter.setState(`${name}.wifi_channel`, json.WifiChannel || '', true);
		adapter.setState(`${name}.update_available`, json.VersionUpdate === '1', true);
		adapter.setState(`${name}.new_firmware`, json.NewVer || '', true);
		adapter.setState(`${name}.prompt_status`, json.prompt_status === '1', true);
		adapter.setState(`${name}.group_role`, json.group === '0' ? 'master' : 'slave', true);
	} catch (error) {
		if (!isUnloading) {
			adapter.log.debug(`getStatusEx error for ${name}: ${error.message}`);
		}
	}

	// multiroom:getSlaveList – slave count and details
	try {
		const { body } = await httpGet(
			reqtype,
			`${reqtype}://${ip}/httpapi.asp?command=multiroom:getSlaveList`,
		);
		if (isUnloading) return;
		const json = JSON.parse(body);
		adapter.setState(`${name}.multiroom_slaves`, Number(json.slaves) || 0, true);
		adapter.setState(
			`${name}.multiroom_slave_list`,
			JSON.stringify(json.slave_list || []),
			true,
		);
	} catch (error) {
		if (!isUnloading) {
			adapter.log.debug(`getSlaveList error for ${name}: ${error.message}`);
		}
	}
}

// ── Command sender ────────────────────────────────────────────────────────────

/**
 * Sends a single command to a WiiM / LinkPlay device.
 * @param {InstanceType<typeof Wiim>} adapter
 * @param {string} cmd
 * @param {string} ip
 * @param {'http'|'https'} reqtype
 */
async function sendWiimCommand(adapter, cmd, ip, reqtype) {
	const url = `${reqtype}://${ip}/httpapi.asp?command=${cmd}`;
	try {
		const { statusCode } = await httpGet(reqtype, url);
		if (statusCode >= 400) {
			adapter.log.warn(`Command "${cmd}" → ${ip} returned HTTP ${statusCode}`);
		} else {
			adapter.log.debug(`Command OK: "${cmd}" → ${ip}`);
		}
	} catch (error) {
		adapter.log.warn(`Command "${cmd}" → ${ip} failed: ${error.message}`);
	}
}

// ── Discovery ─────────────────────────────────────────────────────────────────

/**
 * Processes newly queued Bonjour discoveries. Runs every DISCOVERY_INTERVAL_MS.
 * @param {InstanceType<typeof Wiim>} adapter
 */
async function checkNewStreamers(adapter) {
	if (isUnloading) return;

	if (discoveryRunning) {
		discoveryTimeout = adapter.setTimeout(
			() => checkNewStreamers(adapter),
			DISCOVERY_INTERVAL_MS,
		);
		return;
	}
	discoveryRunning = true;

	try {
		for (const key of pendingDiscoveries) {
			if (isUnloading) break;

			const { name, ip } = JSON.parse(key);
			pendingDiscoveries.delete(key);

			if (streamers.has(name)) continue;

			const reqtype = (await supportsHttp(ip)) ? 'http' : 'https';
			adapter.log.info(`New streamer: ${name} @ ${ip} (${reqtype})`);

			/** @type {StreamerInfo} */
			const info = { name, ip, reqtype, upnpClient: null, pollCycle: 0 };
			streamers.set(name, info);

			await createDataPoints(adapter, info);
			if (!isUnloading) {
				adapter.setState(`${name}.alive`, true, true);
				pollStreamer(adapter, info);
			}
		}
	} catch (error) {
		adapter.log.error(`checkNewStreamers error: ${error.message}`);
	} finally {
		discoveryRunning = false;
	}

	if (!isUnloading) {
		discoveryTimeout = adapter.setTimeout(
			() => checkNewStreamers(adapter),
			DISCOVERY_INTERVAL_MS,
		);
	}
}

// ── Data point initialisation ─────────────────────────────────────────────────

/**
 * Creates all ioBroker state objects for a newly discovered streamer.
 * @param {InstanceType<typeof Wiim>} adapter
 * @param {StreamerInfo} streamer
 */
async function createDataPoints(adapter, streamer) {
	const { name, ip, reqtype } = streamer;
	const safeId = name2id(name, adapter);

	await adapter.setObjectNotExistsAsync(safeId, {
		type: 'device',
		common: { name: safeId, type: 'device', read: false, write: false },
		native: {},
	});

	/** @param {string} id @param {object} common */
	const mkState = (id, common) =>
		adapter.setObjectNotExistsAsync(`${name}.${id}`, {
			type: 'state',
			common,
			native: {},
		});

	await Promise.all([
		// ── Connection & diagnostics ──────────────────────────────────────────
		mkState('Device_Name', {
			name: 'Device_Name',
			type: 'string',
			role: 'indicator',
			read: true,
			write: false,
		}),
		mkState('reqtype', {
			name: 'reqtype',
			type: 'string',
			role: 'info',
			read: true,
			write: false,
			def: reqtype,
		}),
		mkState('ipaddress', {
			name: 'IP_address',
			type: 'string',
			role: 'info.ip',
			read: true,
			write: false,
			def: ip,
		}),
		mkState('alive', {
			name: 'alive',
			type: 'boolean',
			role: 'indicator.connected',
			read: true,
			write: false,
			def: false,
		}),
		mkState('lastError', {
			name: 'lastError',
			type: 'string',
			role: 'text',
			read: true,
			write: false,
			def: 'none',
		}),
		mkState('lastRefresh', {
			name: 'lastRefresh',
			type: 'string',
			role: 'value.time',
			read: true,
			write: false,
			def: 'never',
		}),

		// ── Device info (from getStatusEx) ────────────────────────────────────
		mkState('firmware', {
			name: 'Firmware version',
			type: 'string',
			role: 'info.firmware',
			read: true,
			write: false,
			def: '',
		}),
		mkState('uuid', {
			name: 'Device UUID',
			type: 'string',
			role: 'info.serial',
			read: true,
			write: false,
			def: '',
		}),
		mkState('hardware', {
			name: 'Hardware model',
			type: 'string',
			role: 'info.hardware',
			read: true,
			write: false,
			def: '',
		}),
		mkState('internet', {
			name: 'Internet access',
			type: 'boolean',
			role: 'indicator.connected',
			read: true,
			write: false,
			def: false,
		}),
		mkState('battery_charging', {
			name: 'Battery charging',
			type: 'boolean',
			role: 'indicator.charging',
			read: true,
			write: false,
			def: false,
		}),
		mkState('battery_percent', {
			name: 'Battery level',
			type: 'number',
			role: 'value.battery',
			unit: '%',
			min: 0,
			max: 100,
			read: true,
			write: false,
			def: 0,
		}),
		mkState('rssi', {
			name: 'WiFi signal strength (RSSI)',
			type: 'number',
			role: 'value.signal',
			read: true,
			write: false,
			def: 0,
		}),
		mkState('wifi_channel', {
			name: 'WiFi channel',
			type: 'string',
			role: 'info',
			read: true,
			write: false,
			def: '',
		}),
		mkState('update_available', {
			name: 'Firmware update available',
			type: 'boolean',
			role: 'indicator.update',
			read: true,
			write: false,
			def: false,
		}),
		mkState('new_firmware', {
			name: 'New firmware version',
			type: 'string',
			role: 'info.firmware',
			read: true,
			write: false,
			def: '',
		}),
		mkState('prompt_status', {
			name: 'Voice prompts enabled',
			type: 'boolean',
			role: 'indicator',
			read: true,
			write: false,
			def: true,
		}),
		mkState('group_role', {
			name: 'Multiroom role (master/slave)',
			type: 'string',
			role: 'info',
			read: true,
			write: false,
			def: 'master',
		}),

		// ── Playback status ───────────────────────────────────────────────────
		mkState('status', {
			name: 'Playback status',
			type: 'string',
			role: 'media.state',
			read: true,
			write: false,
			def: 'stop',
			states: { stop: 'Stopped', play: 'Playing', pause: 'Paused', load: 'Loading' },
		}),
		mkState('mode', {
			name: 'Playback mode',
			type: 'string',
			role: 'media.input',
			read: true,
			write: false,
			def: '',
		}),
		mkState('ch', {
			name: 'Active channel',
			type: 'string',
			role: 'media.mode',
			read: true,
			write: false,
			def: '0',
			states: { '0': 'Stereo', '1': 'Left', '2': 'Right' },
		}),
		mkState('type', {
			name: 'Device role in group',
			type: 'string',
			role: 'info',
			read: true,
			write: false,
			def: '0',
			states: { '0': 'Master/Standalone', '1': 'Slave' },
		}),
		mkState('loop_mode', {
			name: 'Loop mode (raw)',
			type: 'string',
			role: 'media.mode.repeat',
			read: true,
			write: false,
			def: '4',
		}),
		mkState('loop_mode_text', {
			name: 'Loop mode',
			type: 'string',
			role: 'media.mode.repeat',
			read: true,
			write: false,
			def: 'No repeat',
		}),
		mkState('eq', {
			name: 'Equalizer preset',
			type: 'string',
			role: 'media.mode',
			read: true,
			write: false,
			def: '0',
		}),

		// ── Track metadata ────────────────────────────────────────────────────
		mkState('album', {
			name: 'Album',
			type: 'string',
			role: 'media.album',
			read: true,
			write: false,
		}),
		mkState('title', {
			name: 'Title',
			type: 'string',
			role: 'media.title',
			read: true,
			write: false,
		}),
		mkState('artist', {
			name: 'Artist',
			type: 'string',
			role: 'media.artist',
			read: true,
			write: false,
		}),
		mkState('albumArtURI', {
			name: 'Album art URL',
			type: 'string',
			role: 'media.cover',
			read: true,
			write: false,
		}),
		mkState('sampleRate', {
			name: 'Sample rate',
			type: 'string',
			role: 'media.bitrate',
			read: true,
			write: false,
		}),
		mkState('bitDepth', {
			name: 'Bit depth',
			type: 'string',
			role: 'media.bitrate',
			read: true,
			write: false,
		}),

		// ── Volume & mute ─────────────────────────────────────────────────────
		mkState('volume', {
			name: 'Volume',
			type: 'number',
			role: 'level.volume',
			min: 0,
			max: 100,
			read: true,
			write: true,
			def: 15,
		}),
		mkState('mute', {
			name: 'Mute',
			type: 'boolean',
			role: 'media.mute',
			read: true,
			write: true,
			def: false,
		}),
		mkState('volume_up', {
			name: 'Volume up (+6)',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
		}),
		mkState('volume_down', {
			name: 'Volume down (-6)',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
		}),

		// ── Position & playlist ───────────────────────────────────────────────
		mkState('curpos', {
			name: 'Current position (ms)',
			type: 'number',
			role: 'media.elapsed',
			unit: 'ms',
			read: true,
			write: false,
			def: 0,
		}),
		mkState('offset_pts', {
			name: 'Offset PTS',
			type: 'number',
			role: 'media.elapsed',
			unit: 'ms',
			read: true,
			write: false,
			def: 0,
		}),
		mkState('tracklength', {
			name: 'Track length (ms)',
			type: 'number',
			role: 'media.duration',
			unit: 'ms',
			read: true,
			write: false,
			def: 0,
		}),
		mkState('plicurr', {
			name: 'Current playlist index',
			type: 'number',
			role: 'media.track',
			read: true,
			write: false,
			def: 0,
		}),
		mkState('plicount', {
			name: 'Playlist track count',
			type: 'number',
			role: 'media.count',
			read: true,
			write: false,
			def: 0,
		}),

		// ── Transport buttons ─────────────────────────────────────────────────
		mkState('Play_Pause', {
			name: 'Play / Pause toggle',
			type: 'boolean',
			role: 'button.play',
			read: false,
			write: true,
		}),
		mkState('pause', {
			name: 'Pause',
			type: 'boolean',
			role: 'button.pause',
			read: false,
			write: true,
		}),
		mkState('resume', {
			name: 'Resume',
			type: 'boolean',
			role: 'button.play',
			read: false,
			write: true,
		}),
		mkState('stop', {
			name: 'Stop',
			type: 'boolean',
			role: 'button.stop',
			read: false,
			write: true,
		}),
		mkState('next', {
			name: 'Next track',
			type: 'boolean',
			role: 'button.next',
			read: false,
			write: true,
		}),
		mkState('previous', {
			name: 'Previous track',
			type: 'boolean',
			role: 'button.prev',
			read: false,
			write: true,
		}),

		// ── Loop & shuffle ────────────────────────────────────────────────────
		mkState('loopmode', {
			name: 'Set loop/shuffle mode',
			type: 'number',
			role: 'media.mode.repeat',
			min: 0,
			max: 5,
			read: true,
			write: true,
			def: 4,
			states: {
				0: 'Repeat all',
				1: 'Repeat once',
				2: 'Shuffle + Repeat',
				3: 'Shuffle',
				4: 'No repeat',
				5: 'Shuffle + Repeat once',
			},
		}),
		mkState('toggle_loop_mode', {
			name: 'Toggle loop mode',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			def: false,
		}),

		// ── Source & URL playback ─────────────────────────────────────────────
		mkState('switchmode', {
			name: 'Switch input source',
			type: 'string',
			role: 'media.input',
			read: true,
			write: true,
			def: 'wifi',
			states: {
				wifi: 'WiFi',
				'line-in': 'Line-In',
				bluetooth: 'Bluetooth',
				optical: 'Optical',
				'co-axial': 'Co-Axial',
				'line-in2': 'Line-In 2',
				udisk: 'USB Disk',
				PCUSB: 'USBDAC',
			},
		}),
		mkState('play_URL', {
			name: 'Play URL',
			type: 'string',
			role: 'media.url',
			read: true,
			write: true,
			def: '',
		}),
		mkState('play_m3u', {
			name: 'Play M3U playlist URL',
			type: 'string',
			role: 'media.url',
			read: true,
			write: true,
			def: '',
		}),
		mkState('play_preset', {
			name: 'Play preset (1-10)',
			type: 'number',
			role: 'media.playid',
			min: 1,
			max: 10,
			read: true,
			write: true,
			def: 1,
		}),
		mkState('play_index', {
			name: 'Play track by playlist index',
			type: 'number',
			role: 'media.track',
			read: true,
			write: true,
			def: 1,
		}),
		mkState('play_local', {
			name: 'Play USB file by index',
			type: 'number',
			role: 'media.track',
			read: true,
			write: true,
			def: 1,
		}),
		mkState('jumptopos', {
			name: 'Seek to position (ms)',
			type: 'number',
			role: 'media.elapsed',
			unit: 'ms',
			read: true,
			write: true,
			def: 0,
		}),
		mkState('jumptopli', {
			name: 'Jump to playlist index',
			type: 'string',
			role: 'media.jump',
			read: true,
			write: true,
			def: '',
		}),
		mkState('playPromptUrl', {
			name: 'Play notification sound URL',
			type: 'string',
			role: 'media.url.announcement',
			read: true,
			write: true,
			def: '',
		}),

		// ── EQ (WiiM only) ────────────────────────────────────────────────────
		mkState('eq_on', {
			name: 'EQ on',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
		}),
		mkState('eq_off', {
			name: 'EQ off',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
		}),
		mkState('eq_load', {
			name: 'Load EQ preset by name',
			type: 'string',
			role: 'media.mode',
			read: true,
			write: true,
			def: 'Flat',
		}),

		// ── Device control ────────────────────────────────────────────────────
		mkState('reboot', {
			name: 'Reboot device',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
		}),
		mkState('setShutdown', {
			name: 'Shutdown timer (seconds; 0=now, -1=cancel)',
			type: 'number',
			role: 'level.timer',
			read: true,
			write: true,
			def: -1,
		}),

		// ── Multiroom ─────────────────────────────────────────────────────────
		mkState('setMaster', {
			name: 'Join multiroom group (master IP)',
			type: 'string',
			role: 'info.ip',
			read: true,
			write: true,
			def: '0.0.0.0',
		}),
		mkState('leaveSyncGroup', {
			name: 'Leave sync group',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
			def: false,
		}),
		mkState('multiroom_ungroup', {
			name: 'Ungroup multiroom (host only)',
			type: 'boolean',
			role: 'button',
			read: false,
			write: true,
		}),
		mkState('multiroom_kickout', {
			name: 'Kick guest out of group (guest IP)',
			type: 'string',
			role: 'info.ip',
			read: true,
			write: true,
			def: '',
		}),
		mkState('multiroom_slave_volume', {
			name: 'Set guest volume ("ip:vol")',
			type: 'string',
			role: 'level.volume',
			read: true,
			write: true,
			def: '',
		}),
		mkState('multiroom_slave_mute', {
			name: 'Set guest mute ("ip:0" or "ip:1")',
			type: 'string',
			role: 'media.mute',
			read: true,
			write: true,
			def: '',
		}),
		mkState('multiroom_slaves', {
			name: 'Number of multiroom guests',
			type: 'number',
			role: 'value',
			read: true,
			write: false,
			def: 0,
		}),
		mkState('multiroom_slave_list', {
			name: 'Multiroom guest list (JSON)',
			type: 'string',
			role: 'json',
			read: true,
			write: false,
			def: '[]',
		}),
	]);

	// Fetch Device_Name from getStatusEx (non-blocking)
	httpGet(reqtype, `${reqtype}://${ip}/httpapi.asp?command=getStatusEx`)
		.then(({ body }) => {
			if (isUnloading) return;
			const json = JSON.parse(body);
			adapter.setState(`${name}.Device_Name`, name2id(json.DeviceName, adapter), true);
			adapter.setState('info.connection', true, true);
		})
		.catch((error) => {
			adapter.log.debug(
				`Could not retrieve device name for ${name} @ ${ip}: ${error.message}`,
			);
		});
}

// ── Module export ─────────────────────────────────────────────────────────────

if (require.main !== module) {
	/** @param {Partial<utils.AdapterOptions>} [options] */
	module.exports = (options) => new Wiim(options);
} else {
	new Wiim();
}
