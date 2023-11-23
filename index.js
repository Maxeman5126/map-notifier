'use strict';

const Prim = "#9f80ff", Seco = "#bf80ff", Tert = "#df80ff", Gry = "#999999", Wht = "#ffffff", Org = "#ffbf80", Red = "#ff8080"

module.exports = function myDbg(mod) {
	const MSG = new TeraMessage(mod);
	const regexId = /#(\d*)@/;
	
	let droppedItems = new Map(),
		spawnedMarkers = new Set();
	
	mod.command.add("map", {
		$none() {
			mod.settings.enabled = !mod.settings.enabled;
            mod.command.message(`Map Notifier ${mod.settings.enabled?'en':'dis'}abled.`);
		},
		party() {
			mod.settings.notifyParty = !mod.settings.notifyParty;
            mod.command.message(`Map notifications showing ${mod.settings.notifyParty?'in party chat':'locally only'}.`);
		},
		tips() {
			mod.settings.tips = !mod.settings.tips;
            mod.command.message(`Map tips now ${mod.settings.tips?'en':'dis'}abled.`);
		},
		markers() {
			if(mod.settings.markers) spawnedMarkers.clear();
			mod.settings.markers = !mod.settings.markers;
            mod.command.message(`Map markers ${mod.settings.markers?'en':'dis'}abled.`);
		},
		markerItem(id) {
			if (!id) return mod.command.message(`${id} invalid command usage consult readme for an example.`);
			
			const matchedId = id.match(regexId);
			if (!matchedId) return mod.command.message(`${id} is not a valid item id, consult readme for an example.`);
			const parsedId = parseInt(matchedId[1], 10);

			mod.command.message(`Changing Marker Item from ${linkItem(mod.settings.markerItem)} to ${linkItem(parsedId)}`);
			mod.settings.markerItem = parsedId;
		},
		list(action, id, tip) {
			if (!id) {
				Object.keys(mod.settings.whitelist).forEach(key => {
					mod.command.message(`${linkItem(Number(key))} tip: ${mod.settings.whitelist[key]}`);
				});
			} else {
				const matchedId = id.match(regexId);
				if (!matchedId) return mod.command.message(`${id} is not a valid item id, consult readme for an example`);
				const parsedId = parseInt(matchedId[1], 10);

				if (action === "add") {
					mod.settings.whitelist[parsedId] = tip;
					//TODO: What if the tip is too long for chat? Set a limit?
					//TODO: Can I add map markers in the tip?
					mod.command.message(`added item ${linkItem(parsedId)} to whitelist with tip ${tip}`);
				} else if (action === "remove") {
					if (!(parsedId in mod.settings.whitelist)) {
						mod.command.message(`Item ${linkItem(parsedId)} was not found on whitelist`)
						return;
					}
					delete mod.settings.whitelist[parsedId];
					mod.command.message(`removed item ${linkItem(parsedId)} from whitelist`);
				}
			}
		}
	});
	//clear data if loading new zone.
	mod.hook('S_LOAD_TOPO', 'raw', () => {droppedItems.clear(),spawnedMarkers.clear()});
	//Track dropped and picked up items for markers
	mod.hook('S_SPAWN_DROPITEM', 8, e => {if(mod.settings.enabled && mod.settings.markers) sSpawnDropItem(e)})
	mod.hook('S_DESPAWN_DROPITEM', 4, e => {if(mod.settings.enabled && mod.settings.markers && droppedItems.has(e.gameId)) sDespawnDropItem(e)})
	//Notifications of looted items by self and party
	mod.hook("S_SYSTEM_MESSAGE", 1, (e) => {if(mod.settings.enabled) sSystemMessage(e)})
	mod.hook("S_SYSTEM_MESSAGE_LOOT_ITEM", 1, (e) => {if(mod.settings.enabled) sSystemMessageLootItem(e)})
		
	function sSystemMessage(event){
		if (event.message.substring(0,event.message.indexOf('\u000b')) === '@679') {
			sysMessage(event.message,false);
		}
	}
	function sSystemMessageLootItem(event){
		if (event.sysmsg.substring(0,event.sysmsg.indexOf('\u000b')) === '@379') {
			sysMessage(event.sysmsg,true);
		}
	}
	
	function sysMessage(message,myLoot){
		const sysMsg = mod.parseSystemMessage(message)
		let itm = sysMsg.tokens.ItemName;
		let ixq = itm.indexOf('?')
		let ixitem = itm.indexOf('item')
		let ixdbid = itm.indexOf('dbid')
		let item = Number(itm.substring(ixitem+5,(ixq>0 ? ixq : itm.length)))
		let dbid = itm.substring(ixdbid+5)
		//TODO: display item with appropriate dbid if available
		if (!(item in mod.settings.whiteList)) return;
		const itemString = `${MSG.BLU("Map Notifier: ")}${linkItem(item)}${MSG.BLU(" picked up by ")} ${MSG.clr(myLoot ? mod.game.me.name : sysMsg.tokens.PartyPlayerName,Seco)}`
		//TODO: configure option for notice chat vs party chat or both.
		mod.settings.notifyParty ? MSG.partyOut(itemString) : MSG.party(itemString);
		if (mod.settings.whitelist[item] == undefined || !(mod.settings.tips)) return;
		const tipString = `${MSG.BLU("Map Notifier Tip: ")}${MSG.BLU(mod.settings.whitelist[item])}`
		//TODO: configure option for notice chat vs party chat or both.
		mod.settings.notifyParty ? MSG.partyOut(tipString) : MSG.party(tipString);
	}

	function sSpawnDropItem(event){
		mod.log('drop item spawned');
		mod.log(mod.settings.whiteList);
		if(!(event.item in mod.settings.whiteList && event.owners.some(owner => owner === mod.game.me.playerId))) return;
		//spawn a marker item
		spawnMarker(event.gameId,event.loc);
		//Update droppedItems list with the new item
		droppedItems.set(event.gameId, Object.assign(event, {name: itemDesc(event.item)}));
    }
	
    function itemDesc(s) {
        const data = mod.game.data.items.get(s)
        return data ? data.name : "Undefined"
    }
	function linkItem(item){
		return MSG.RED("<ChatLinkAction param=\"1#####"+item+"@-1\">["+itemDesc(item)+"]</ChatLinkAction>")
	}
	
	//functions to spawn and remove a marker at the location of a given gameId (Item, npc, etc.)
	function spawnMarker(gameId, loc) {
		if (spawnedMarkers.has(gameId)) return;
	
		const itemLoc = { ...loc };
		itemLoc.z -= 100;
	
		mod.send("S_SPAWN_DROPITEM", mod.majorPatchVersion >= 99 ? 9 : 8, {
			"gameId": gameId * 10n,
			"loc": itemLoc,
			"item": mod.settings.markerItem,
			"amount": 1,
			"expiry": 0,
			"owners": []
		});
		spawnedMarkers.add(gameId);
	}
	
	function sDespawnDropItem(event){
		//remove marker and clean up droppedItems list
		if (spawnedMarkers.has(event.gameId)) despawnMarker(event.gameId);
		droppedItems.delete(event.gameId);
    }
	
	function despawnMarker(gameId) {
		mod.send("S_DESPAWN_DROPITEM", 4, {
			"gameId": gameId * 10n
		});
		spawnedMarkers.delete(gameId);
	}	
	
	//TODO: make a proper destructor at some point.
	this.destructor = () => {
		droppedItems.clear();
		spawnedMarkers.clear();
		mod.command.remove("map");
	};
};


class TeraMessage {
	constructor(mod) {
		this.mod = mod;
	}
	//HTML colors
	clr(text, hexColor) {
		return `<font color="${hexColor}">${text}</font>`;
	}
	RED(text) {
		return `<font color="#FF0000">${text}</font>`;
	}
	BLU(text) {
		return `<font color="#56B4E9">${text}</font>`;
	}
	YEL(text) {
		return `<font color="#E69F00">${text}</font>`;
	}
	TIP(text) {
		return `<font color="#00FFFF">${text}</font>`;
	}
	GRY(text) {
		return `<font color="#A0A0A0">${text}</font>`;
	}
	PIK(text) {
		return `<font color="#FF00DC">${text}</font>`;
	}
	
	//Tera chat channels
	chat(msg) {
		this.mod.command.message(msg);
	}
	party(msg) {
		this.mod.send("S_CHAT", this.mod.majorPatchVersion >= 108 ? 4 : 3, {
			"channel": 21,
			"message": msg
		});
	}
	partyOut(msg) { //Send to party notice chat.
		this.mod.send("C_CHAT", 1, {
			"channel": 21,
			"message": msg
		});
	}
	raids(msg) {
		this.mod.send("S_CHAT", this.mod.majorPatchVersion >= 108 ? 4 : 3, {
			"channel": 25,
			"message": msg
		});
	}
	alert(msg, type) {
		this.mod.send("S_DUNGEON_EVENT_MESSAGE", 2, {
			"type": type,
			"chat": false,
			"channel": 0,
			"message": msg
		});
	}
}