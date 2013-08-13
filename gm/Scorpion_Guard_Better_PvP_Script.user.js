// ==UserScript==
// @name        Scorpion Guard Better PvP Script
// @namespace   tag:dssrzs.org,2012-07-16:PvP
// @description Keyboard commands for Pardus combat
// @include     http://*.pardus.at/main.php*
// @include     http://*.pardus.at/ship2ship_combat.php*
// @include     http://*.pardus.at/ship2opponent_combat.php*
// @include     http://*.pardus.at/building.php*
// @require     sgpvp.js
// @author      Val
// @version     29
// @updateURL   https://dl.dropboxusercontent.com/u/28969566/sgpvp/Scorpion_Guard_Better_PvP_Script.meta.js
// @downloadURL https://dl.dropboxusercontent.com/u/28969566/sgpvp/Scorpion_Guard_Better_PvP_Script.user.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// ==/UserScript==

// Firefox implementation of non-portable bits

// Configuration loading... this seems ridiculously complicated, and
// it is, but Chrome forces a rather weird callback model, which we
// emulate in FF to keep the main logic portable.

SGPvP.prototype.LOADERS = {
    targetingData: function(universe) {
        var s = GM_getValue(universe + '-targeting');
        if(s)
            return JSON.parse(s);

        return {
            ql:{includeFactions:{},
                excludeFactions:{},
                includeAlliances:{},
                excludeAlliances:{},
                includeCharacters:{},
                excludeCharacters:{}},
            include:{ids:{},names:{}},
            exclude:{ids:{},names:{}},
            prioritiseTraders:false,
            retreatTile:null
        };
    },

    textQL: function(universe) {
        var s = GM_getValue(universe + '-ql');
        if(s)
            return s;
        return '';
    },

    retreatTile: function(universe) {
        var n = parseInt(GM_getValue(universe + '-rtid'));
        if(n > 0)
            return n;
        return null;
    },

    armourData: function(universe) {
        var s = GM_getValue(universe + '-armour');
        if(s)
            return JSON.parse(s);

        return {
            points: null,
            level: 5
        };
    },

    lastKnownArmourPoints: function(universe) {
        var n = GM_getValue(universe + '-lkap');
        if(n)
            return parseInt(n);
        return null;
    },

    lastKnownBotsAvailable: function(universe) {
        var n = GM_getValue(universe + '-lkba');
        if(n)
            return parseInt(n);
        return null;
    }

};

SGPvP.prototype.SAVERS = {
    targetingData: function(universe, tdata) {
        GM_setValue(universe + '-ql', tdata.ql);
        GM_setValue(universe + '-targeting', JSON.stringify(tdata.data));
    },

    retreatTile: function(universe, id) {
        id = parseInt(id);
        if(id > 0)
            GM_setValue(universe + '-rtid', id);
        else
            GM_deleteValue(universe + '-rtid');
    },

    armourData: function(universe, adata) {
        GM_setValue(universe + '-armour', JSON.stringify(adata));
    },

    lastKnownArmourPoints: function(universe, value) {
        value = parseInt(value);
        if(isNaN(value))
            GM_deleteValue(universe + '-lkap');
        else
            GM_setValue(universe + '-lkap', value);
    },

    lastKnownBotsAvailable: function(universe, value) {
        value = parseInt(value);
        if(isNaN(value))
            GM_deleteValue(universe + '-lkba');
        else
            GM_setValue(universe + '-lkba', value);
    }
};

SGPvP.prototype.loadSettings = function(keys, callback) {
    var r = new Array();

    for(var i = 0, end = keys.length; i < end; i++) {
        var loader = this.LOADERS[keys[i]];
        if(loader)
            r.push(loader(this.universe));
    }

    callback(r);
};

SGPvP.prototype.storeSettings = function(settings) {
    for(var key in settings) {
        var saver = this.SAVERS[key];
        if(saver)
            saver(this.universe, settings[key]);
    }
};

// We can't use unsafeWindow in Chrome, but we can here

SGPvP.prototype.getLocation = function() {
    return unsafeWindow.userloc;
};

// The following are here because they deal with oddities introduced
// by the Firefox extension "Mr Xyzzy's Pardus Helper".  We can
// simplify these in Chrome.

SGPvP.prototype.BUILDING_PLAYER_DETAIL_RX = /^building\.php\?detail_type=player&detail_id=(\d+)/;
SGPvP.prototype.getShipsBuilding = function() {
    var xpr = document.evaluate("//table[@class='messagestyle']/tbody/tr/th",
                                document, null,
                                XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    var th;
    while((th = xpr.iterateNext())) {
        var heading = th.textContent;
        if(heading == 'Other Ships')
            return this.parseOtherShipsTable(th.parentNode.parentNode,
                                             this.BUILDING_PLAYER_DETAIL_RX);
        else if(heading == ' ATTACK Other Ships ATTACK ')
            return this.parseOtherShipsTable_MrX(th.parentNode.parentNode);
    }

    // Still here?
    return [];
};

// XXX - untested!!
SGPvP.prototype.SHIP2SHIP_RX = /^ship2ship_combat\.php\?playerid=(\d+)/;
SGPvP.prototype.getShipsCombat = function() {
    var xpr = document.evaluate("//table[@class='messagestyle']/tbody/tr/th",
                                document, null,
                                XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    var th;
    while((th = xpr.iterateNext())) {
        var heading = th.textContent;
        if(heading == 'Other Ships')
            return this.parseOtherShipsTable(th.parentNode.parentNode,
                                             SHIP2SHIP_RX);
        else if(heading == ' ATTACK Other Ships ATTACK ')
            return this.parseOtherShipsTable_MrX(th.parentNode.parentNode);
    }

    // Still here?
    return [];
};

// Mr. X makes a right muck of the otherships table...
SGPvP.prototype.MRX_MUCK_RX = />([^<>&]+)&nbsp;(?:.*alliance\.php\?id=(\d+))?/;
SGPvP.prototype.parseOtherShipsTable_MrX = function(tbody) {
    var ships = [];
    var xpr = document.evaluate("tr/td/a[@title = 'Attack']",
                              tbody, null,
                               XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    var a;
    while((a = xpr.iterateNext())) {
        // Just get it dirty
        var m = this.SHIP2SHIP_RX.exec(a.getAttribute('href'));
        if(m) {
            var id = parseInt(m[1]);
            m = this.MRX_MUCK_RX.exec(a.innerHTML);
            if(m) {
                var entry = {
                    td: a.parentNode,
                    id: id,
                    name: m[1],
                    ally_id: parseInt(m[2])
                };
                this.getShipEntryExtras(entry);
                ships.push(entry);
            }
        }
    }

    return ships;
};

// This gets the faction and ship type from a ship entry. It's a
// separate method to reuse it - we do it the same in all pages.
SGPvP.prototype.SHIPBGIMAGE_RX = /^url\("[^"]+\/ships\/([^/.]+)(?:_paint\d+|xmas)?\.png"\)$/;
SGPvP.prototype.SHIPIMSRC_RX = /ships\/([^/.]+)(?:_paint\d+|xmas)?\.png$/;
SGPvP.prototype.FACTIONSIGN_RX = /factions\/sign_(fed|emp|uni)/;
SGPvP.prototype.getShipEntryExtras = function(entry) {
    // find the ship type
    var itd = entry.td.previousElementSibling;
    if(itd) {
        var shipModel;
        var m = this.SHIPBGIMAGE_RX.exec(itd.style.backgroundImage);
        if(m)
            shipModel = entry.shipModel = m[1];

        // see if we find a faction
        var xpr = document.evaluate("img", itd, null,
                                    XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                    null);
        var img;
        while((img = xpr.iterateNext())) {
            var src = img.src;
            if((m = this.FACTIONSIGN_RX.exec(src)))
                entry.faction = m[1];
            else if(!shipModel && (m = this.SHIPIMSRC_RX.exec(src)))
                // More Mr X breakage
                entry.shipModel = m[1];
        }
    }

    if(!entry.faction)
        entry.faction = 'neu';
};

// Just start the ball...

var controller = new SGPvP();
