// A message responder that manages the stored settings. We do this in
// a background page so settings are stored in the extension's
// localStorage, rather than that of the actual pardus pages.  This
// complicates things a bit but no way around it due to Chrome
// design...

var LOADERS = {
    targetingData: function(universe) {
        var s = localStorage.getItem(universe + '-targeting');
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
        var s = localStorage.getItem(universe + '-ql');
        if(s)
            return s;
        return '';
    },

    retreatTile: function(universe) {
        var n = parseInt(localStorage.getItem(universe + '-rtid'));
        if(n > 0)
            return n;
        return null;
    },

    armourData: function(universe) {
        var s = localStorage.getItem(universe + '-armour');
        if(s)
            return JSON.parse(s);

        return {
            points: null,
            level: 5
        };
    },

    lastKnownArmourPoints: function(universe) {
        var n = localStorage.getItem(universe + '-lkap');
        if(n)
            return parseInt(n);
        return null;
    },

    lastKnownBotsAvailable: function(universe) {
        var n = localStorage.getItem(universe + '-lkba');
        if(n)
            return parseInt(n);
        return null;
    }

};

var SAVERS = {
    targetingData: function(universe, tdata) {
        localStorage.setItem(universe + '-ql', tdata.ql);
        localStorage.setItem(universe + '-targeting', JSON.stringify(tdata.data));
    },

    retreatTile: function(universe, id) {
        id = parseInt(id);
        if(id > 0)
            localStorage.setItem(universe + '-rtid', id);
        else
            localStorage.removeItem(universe + '-rtid');
    },

    armourData: function(universe, adata) {
        localStorage.setItem(universe + '-armour', JSON.stringify(adata));
    },

    lastKnownArmourPoints: function(universe, value) {
        value = parseInt(value);
        if(isNaN(value))
            localStorage.removeItem(universe + '-lkap');
        else
            localStorage.setItem(universe + '-lkap', value);
    },

    lastKnownBotsAvailable: function(universe, value) {
        value = parseInt(value);
        if(isNaN(value))
            localStorage.removeItem(universe + '-lkba');
        else
            localStorage.setItem(universe + '-lkba', value);
    }

};

function handler(request, sender, sendResponse) {
    var universe = request.universe;

    if(request.op == 'load') {
        var keys = request.keys, r = new Array();

        for(var i = 0, end = keys.length; i < end; i++) {
            var loader = LOADERS[keys[i]];
            if(loader)
                r.push(loader(universe));
        }

        sendResponse(r);
    }
    else if(request.op == 'store') {
        var settings = request.settings;

        for(var key in settings) {
            var saver = SAVERS[key];
            if(saver)
                saver(universe, settings[key]);
        }

        if(sendResponse)
            sendResponse(true);
    }
};

chrome.extension.onMessage.addListener(handler);
