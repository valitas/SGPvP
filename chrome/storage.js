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
    armour: { u: false, d: { low: null, max: null, level: 5 } }
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

    this.rawGet( Object.keys(storageNames), onValues.bind(this) );

    function onValues( values ) {
        var sname, value;
        for ( sname in storageNames ) {
            name = storageNames[ sname ];
            spec = specs[ name ];
            value = values[ sname ];
            if( typeof(value) == 'undefined' )
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

    this.rawSet( o, callback );
};

// Update configuration.  We don't do this automatically because we don't want
// to trigger an unnecessary fetch.  Instead, we retrieve the config version
// along with our normal parameters, and if we detect we need to fix it, we call
// this from SGMain and reload.
SGStorage.prototype.migrate = function( callback ) {

    // The configuration prior to V40 stored only one armour level, called
    // "points".  V40 stored two, safe and max, with max being the old points.
    // If the user had defined any "win" actions, we get the safe level from one
    // of these.  Otherwise, we set safe equal to max.
    //
    // And then, in V41 we're changing things again from V40's "safe" and "max"
    // armour levels.  We have "low" and "max" now, with different semantics,
    // but it's safe to use "safe" as "low".
    //
    // We deal with both cases because, with our boneheaded policy of keeping a
    // "private" version available only to friends, we now have plenty instances
    // of this script in the wild using both styles.  We'll upgrade all to V41.

    this.rawGet(
        [ 'keymap', 'artemis-armour', 'orion-armour', 'pegasus-armour' ],
        onValues.bind( this ) );

    function onValues( entries ) {
        var safe;

        if ( entries.keymap )
            safe = this.fixKeymap( entries.keymap ).safe;

        fixArmour( entries['artemis-armour'], safe );
        fixArmour( entries['orion-armour'], safe );
        fixArmour( entries['pegasus-armour'], safe );

        entries.version = 41;
        //console.log( 'Old configuration migrated', entries );
        this.rawSet( entries, callback );
    }

    function fixArmour( armour, safe ) {
        if ( armour ) {
            if ( armour.points > 0 )
                armour.max = armour.low = armour.points;
            else {
                if ( armour.max > 0 ) {
                    if ( armour.safe > 0 && armour.safe < armour.max )
                        armour.low = armour.safe;
                    else if ( safe > 0 && safe < armour.max )
                        armour.low = safe;
                    else
                        armour.low = armour.max;
                }
                else {
                    armour.max = null;
                    armour.low = null;
                }
            }

            // Make sure these obsolete settings are wiped
            delete armour.points;
            delete armour.safe;
        }
    }
}

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
