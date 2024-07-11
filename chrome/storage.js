// -*- js3-indent-level: 4; js3-indent-tabs-mode: nil -*-

function SGStorage( universe ) {
    this.universe = universe;
};

// A specification of the stuff we keep in persistent storage.
// 'u' is true for parameters set once for all universes.
// 'd' is the default value.

SGStorage.prototype.PARAM_DEFINITION = {
    version: { u: true, d: 0 },
    keymap: { u: true, d: null },
    rtid: { u: false, d: null }, // retreat tile id
    lkap: { u: false, d: null }, // last known armour points
    lkba: { u: false, d: null }, // last known bots available
    ql: { u: false, d: '' },
    targeting: { u: false,
                 d: { ql: { includeFactions: {},
                            excludeFactions: {},
                            includeAlliances: {},
                            excludeAlliances: {},
                            includeCharacters: {},
                            excludeCharacters: {} },
                      include: { ids: {}, names: {} },
                      exclude: { ids: {}, names: {} },
                      prioritiseTraders: false,
                      retreatTile: null } },
    armour: { u: false, d: { low: null, max: null, level: 5 } },
    wayp: { u: false, d: { currentIndex : -1, direction : -1, len : 0, tid : {} } }
};

// Request retrieval of named values from persistent storage.  Once retrieved,
// these will be available as own properties of the SGStorage instance.
//
// "names" is an array of strings.  "callback" is a function to be called when
// the requested values are available; it will receive a single parameter, a
// reference to this SGStorage object.

SGStorage.prototype.get = function( names, callback ) {
    var storageNames = {},
        specs = this.PARAM_DEFINITION,
        prefix = this.universe + '-',
        i, end, name, spec;

    for ( i = 0, end = names.length; i < end; i++ ) {
        name = names[ i ];
        spec = specs[ name ];
        storageNames[ spec.u ? name : prefix + name ] = name;
    }

    chrome.storage.local.get( Object.keys(storageNames), onValues.bind(this) );

    function onValues( values ) {
        var sname, value;
        for ( sname in storageNames ) {
            name = storageNames[ sname ];
            spec = specs[ name ];
            value = values[ sname ];
            if( typeof(value) === 'undefined' )
                value = spec.d;
            this[ name ] = value;
        }
        callback( this );
    }
}

// Store all properties of the given object both as properties of the SGStorage
// instance, and in persistent storage.

SGStorage.prototype.set = function( settings, callback ) {
    var o = new Object(),
        specs = this.PARAM_DEFINITION,
        prefix = this.universe + '-',
        name, storageName, value;

    for( name in settings ) {
        storageName = specs[name].u ? name : prefix + name;
        value = settings[ name ];
        this[ name ] = value;
        o[ storageName ] = value;
    }

    chrome.storage.local.set( o, callback );
}

// Update configuration.  Only call this if this.version is not 45 or better,
// and don't use this SGStorage afterward, load it again.

SGStorage.prototype.migrate = function (callback) {
    if (this.version >= 45) {
        throw new Error('unexpected migration');
    }
    
    if (this.version >= 41) {
        SGStorage.fixV41().then(callback);
    }
    else {
        SGStorage.resetToV45().then(callback);
    }
}

SGStorage.resetToV45 = async function () {
    console.log('configuration is too old, resettting');
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ version: 45 });
}

SGStorage.fixV41 = async function () {
    // This SGStorage instance loaded the configuration for the current
    // universe. However, we need to fix all universes so read again.
    //
    // (Really should just migrate each universe as it's used, but I'm trying to
    // disturb old code as little as i can to get this running first.)
    const current = await chrome.storage.local.get(['artemis-wayp', 'orion-wayp', 'pegasus-wayp']);
    const fixes = { version: 45 };
    const saneWayp = { currentIndex: -1, direction: -1, len: 0, tid: {} };

    for (const [key, wayp] of Object.entries(current)) {
        if (Object.hasOwn(wayp, 'length')) {
            // waypoint cfg is borked for this universe, reset
            fixes[key] = saneWayp;
        }
    }

    await chrome.storage.local.set(fixes);
};

// Go over the supplied keymap and fix old entries with bad formatting.
// This is done when migrating a configuration, and also when importing one,
// because it may be old.
SGStorage.prototype.fixKeymap = function( keymap ) {
    var winrx = /^(win(?:Raid|B|BRaid)?,)(\d+|s),(.*)$/,
    safes = [],
        key, action, m, safe;

    for ( key in keymap ) {
        action = keymap[ key ];
        switch ( action ) {
        case 'bots':
            keymap[ key ] = 'bots,m';
            break;
        case 'testBots':
            keymap[ key ] = 'testBots';
            break;
        default:
            m = winrx.exec( action );
            if ( m ) {
                if ( m[2] != 's' )
                    safes.push( m[2] );
                keymap[ key ] = m[1] + 'l,' + m[3];
            }
        }
    }

    if ( safes.length > 0 )
        safe = Math.max.apply( Math, safes );

    return { safeArmour: safe }
}
