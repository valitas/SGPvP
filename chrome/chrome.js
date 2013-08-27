// Include sgpvp.js before this.

SGPvP.prototype.getVersion = function() {
    return chrome.runtime.getManifest().version;
};

SGPvP.prototype.getValues = function(keys, callback) {
    chrome.storage.local.get(keys, callback);
};

SGPvP.prototype.setValues = function(entries) {
    chrome.storage.local.set(entries);
};

// The following are here because the Firefox implementations have to
// deal with oddities introduced by "Mr Xyzzy's Pardus Helper".
// There's no such thing on Chrome, so we can simplify here.

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
    }

    // Still here?
    return [];
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
        var m = this.SHIPBGIMAGE_RX.exec(itd.style.backgroundImage);
        if(m)
            entry.shipModel = m[1];

        // see if we find a faction
        var xpr = document.evaluate("img", itd, null,
                                    XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                    null);
        var img;
        while((img = xpr.iterateNext())) {
            var src = img.src;
            if((m = this.FACTIONSIGN_RX.exec(src)))
                entry.faction = m[1];
        }
    }

    if(!entry.faction)
        entry.faction = 'neu';
};


// Our versions of GM_getResourceURL and GM_getResourceText. We use
// these in Chrome to fetch resources included with the extension.

SGPvP.prototype.RESOURCE = {
    ui_js: 'ui.js',
    ui_html: 'ui.html',
    ui_style: 'ui.css',
    default_keymap: 'default-keymap.json',
    illarion_keymap: 'illarion-keymap.json'
};

SGPvP.prototype.getResourceURL = function(resource_id) {
    return chrome.extension.getURL(this.RESOURCE[resource_id]);
};

SGPvP.prototype.getResourceText = function(resource_id) {
    var rq = new XMLHttpRequest();
    rq.open('GET', this.getResourceURL(resource_id), false);
    rq.send();
    return rq.responseText;
};
