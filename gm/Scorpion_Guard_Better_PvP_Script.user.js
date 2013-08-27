// ==UserScript==
// @name        Scorpion Guard Better PvP Script
// @namespace   tag:dssrzs.org,2012-07-16:PvP
// @description Keyboard commands for Pardus combat
// @match       *://*.pardus.at/main.php*
// @match       *://*.pardus.at/ship2ship_combat.php*
// @match       *://*.pardus.at/ship2opponent_combat.php*
// @match       *://*.pardus.at/building.php*
// @match       *://*.pardus.at/logout.php
// @require     sgpvp.js
// @resource    ui_js ui.js
// @resource    ui_html ui.html
// @resource    ui_style ui.css
// @resource    default_keymap default-keymap.json
// @author      Val
// @version     31.3
// @updateURL   https://dl.dropboxusercontent.com/u/28969566/sgpvp-dev/Scorpion_Guard_Better_PvP_Script.meta.js
// @downloadURL https://dl.dropboxusercontent.com/u/28969566/sgpvp-dev/Scorpion_Guard_Better_PvP_Script.user.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_getResourceURL
// @grant       GM_getResourceText
// @grant       GM_info
// ==/UserScript==

// Firefox implementation of non-portable bits

SGPvP.prototype.getVersion = function() {
    return GM_info.script.version;
};

// Configuration handling is a tad more complicated than one would
// expect, because chrome.storage imposes a funny callback
// architecture, and here on Firefox we emulate it so we can have a
// single source with the main logic. This isn't expensive at all,
// really, just a bit confusing.

SGPvP.prototype.getValues = function(keys, callback) {
    var r = new Object();
    for(var i in keys) {
        var key = keys[i];
        var val = GM_getValue(key);
        if(typeof(val) != 'undefined') {
            // This check is for smooth upgrading of installed
            // versions; we'll remove in the future.  Thing is, we
            // used to store one parameter, only one, in a form that
            // isn't amenable to JSON.parse(). So, we test for that
            // here, and if detected we return the literal string.
            if(/^[0-9{"]/.test(val))
                r[key] = JSON.parse(val);
            else
                r[key] = val;
        }
    }
    callback(r);
};

SGPvP.prototype.setValues = function(entries) {
    for(var key in entries)
        GM_setValue(key, JSON.stringify(entries[key]));
};

// The following are here because they deal with oddities introduced
// by the Firefox extension "Mr Xyzzy's Pardus Helper".  There is no
// Mr. X in Chrome, so we can simplify these there.

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

SGPvP.prototype.getResourceURL = function(resource_id) {
    return GM_getResourceURL(resource_id);
};

SGPvP.prototype.getResourceText = function(resource_id) {
    return GM_getResourceText(resource_id);
};

// Just start the ball...

var controller = new SGPvP();
