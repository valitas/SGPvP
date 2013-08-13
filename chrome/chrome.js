// Include sgpvp.js before this.

SGPvP.prototype.loadSettings = function(keys, callback) {
    chrome.extension.sendMessage({ op: 'load', universe: this.universe, keys: keys }, callback);
};

SGPvP.prototype.storeSettings = function(settings) {
    chrome.extension.sendMessage({ op: 'store', universe: this.universe, settings: settings });
};

SGPvP.prototype.getLocation = function() {
    // We can't use unsafeWindow, so we'll read the bit of script instead...

    // XXX - note this may be very wrong if partial refresh is
    // enabled, and we can't fix that easily <_<

    var scripts = document.getElementsByTagName('script');
    for(var i = 0, end = scripts.length; i < end; i++) {
        var script = scripts[i];
        if(!script.src) {
            var m = /^\s*var userloc = (\d+);/m.exec(script.textContent);
            if(m)
                return m[1];
        }
    }

    return null;
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
