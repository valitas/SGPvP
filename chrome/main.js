function SGMain(doc) {
    var url, m;

    this.doc = doc;

    url = doc.location.href;
    m = this.LOCATION_RX.exec(url);
    if(!m)
        return;

    this.universe = m[1];
    this.page = m[2];
    this.storage = new SGStorage( this.universe );

    switch(this.page) {
    case 'main':
        this.setupPageSpecific = this.setupNavPage;
        break;
    case 'ship2ship_combat':
    case 'building':
        this.setupPageSpecific = function() {
            this.setupCombatPage();
            this.setMissiles(true);
            // leave rounds alone for now. if the user engages with a
            // key, we'll set the proper option then
        };
        break;
    case 'ship2opponent_combat':
        this.setupPageSpecific = function() { this.setupCombatPage(); };
        break;
    default:
        // ambush, logout
        this.setupPageSpecific = function() {}; // nop
    }

    loadConfig.call( this, true );

    // This function returns immediately at this point.

    // Now this below is a bit convoluted because of the callback structure,
    // which is needed for the design of the Chrome API, which is really just
    // the right way given how Javascript works.
    //
    // Essentially: loadConfig returns immediately, but arranging for
    // checkConfig to be called shortly after.  checkConfig may migrate the
    // configuration and cause loadConfig to be called again, just once; or it
    // may detect that the keyboard is missing and arrange for the default
    // keymap to be loaded and storeKeymap to be called; or it may just call
    // finishConfig immediately.  storeKeymap stores the keymap and arranges for
    // finishConfig to be called.  finishConfig finally configures the script.

    function loadConfig( allowRetry ) {
        var names = [ 'keymap', 'targeting', 'armour',
                      'lkap', 'lkba', 'rtid', 'version', 'wayp' ];
        this.storage.get( names, checkConfig.bind(this, allowRetry) );
    }

    function checkConfig(allowRetry) {
        if (allowRetry && !(this.storage.version >= 41))
            this.storage.migrate(loadConfig.bind(this, false));
        else {
            if (this.storage.keymap) {
                finishConfig.call(this);
            } else {
                this.getResourceText('default-keymap.json')
                    .then((json) => storeKeymap.call(this, json));
            }
        }
    }

    function storeKeymap( json ) {
        this.storage.set( { keymap: JSON.parse(json) },
                          finishConfig.bind( this ) );
    }

    function finishConfig() {
        // Insert a bit of script to execute in the page's context and
        // send us what we need. And add a listener to receive the call.
        let window = this.doc.defaultView;
        window.addEventListener( 'message', this.setupPage.bind(this) );
        let script = this.doc.createElement( 'script' );
        script.src = chrome.runtime.getURL('postvars.js');
        script.onload = function() { this.remove(); };
        this.doc.head.appendChild(script);
        this.configured = true;
    }
}

SGMain.prototype.LOCATION_RX = /^https?:\/\/([^.]+)\.pardus\.at\/([^.]+)\.php/;

// Ship priorities - all else being the same, first listed here are first shot
SGMain.prototype.SHIPS = [
    // 1 - real traders and low level hybrids
    'leviathan', 'boa_ultimate_carrier', 'behemoth', 'extender', 'celeus',
    'lanner', 'blood_lanner', 'mantis', 'elpadre', 'constrictor', 'hercules',
    'babel_transporter', 'junkeriv', 'lanner_mini', 'slider', 'harrier',

    // 2 - possible traders relatively easy to kill
    'mooncrusher', 'war_nova',

    // 3 - fighters
    'dominator', 'liberator', 'liberator_eps', 'sudden_death', 'gauntlet',
    'bopx', 'pantagruel', 'chitin', 'horpor', 'gargantua', 'reaper',
    'vulcan', 'piranha', 'venom', 'rover', 'mercury', 'trident', 'marauder',
    'shadow_stealth_craft', 'hawk', 'scorpion', 'doomstar', "harvester",

    // 4 - breakers
    'phantom_advanced_stealth_craft', 'viper_defence_craft', 'nano',
    'nighthawk_deluxe', 'nighthawk',

    // 5 - harmless noob ships that may still be under protection
    'thunderbird', 'spectre', 'interceptor', 'adder', 'tyrant', 'rustfire',
    'wasp', 'ficon', 'rustclaw', 'sabre'
];

// This is a handler for DOM messages coming from the game page.
// Arrival of a message means the page contents were updated. The
// message contains the value of the userloc variable, too.
//
// Doing things this way may seem a bit awkward to Firefox userscript
// writers, but it is the proper (only?) way to do it in Chrome.
// Plus, this spares us from using unsafeWindow at all, which is a
// Good Thing.
SGMain.prototype.setupPage = function(event) {
    //console.log(`handling message with sgpvp opcode ${event.data.sgpvp}`);
    if(event.data.sgpvp === 'pardus-vars') {
        this.userloc = parseInt(event.data.loc);
        this.ajax = event.data.ajax;
        this.setupPageSpecific();
    } else if(event.data.sgpvp === 'keydown') {
        //console.log(`forwarding keycode ${event.data.keyCode}`);
        this.keyPressHandler(event.data.keyCode);
    }
};

SGMain.prototype.closeUi = function() {
    if(this.sgpvpui)
        this.sgpvpui.close();
};

SGMain.prototype.keyPressHandler = function(keyCode) {
    if(!this.configured)
        // User is mashing too fast, we haven't even had time to load
        // our settings. Ignore this, they'll try again, no doubt.
        return false;

    if(keyCode == 27) {
        if(this.sgpvpui)
            this.sgpvpui.toggle();
        else
            this.configure();
        return false;
    }

    var astr = this.storage.keymap[ keyCode ];
    if(astr) {
        var args = astr.split(','),
        methodname = args.shift();
        this[methodname].apply(this, args);
        return true;
    }

    return false;
};

SGMain.prototype.NOTIFICATION_STYLE = {
    background: '#00002C', border: '2px outset #335', fontSize: '18px',
    left: '50%', margin: '-2.2em 0 0 -4em', padding: '0.5em',
    position: 'fixed', textAlign: 'center', top: '50%', width: '8em',
    zIndex: '15'
};

SGMain.prototype.showNotification = function(text, delay) {
    if(this.notification_timer)
        window.clearTimeout(this.notification_timer);
    this.hideNotification();
    this.notification =
        this.createElement('div', this.NOTIFICATION_STYLE, null, text, null);
    this.doc.body.appendChild(this.notification);

    this.notification_timer =
        window.setTimeout(callback.bind(this), delay);

    function callback() {
        this.notification_timer = null;
        this.hideNotification();
    }
};

SGMain.prototype.hideNotification = function() {
    if(this.notification)
        this.doc.body.removeChild(this.notification);
    this.notification = null;
};

SGMain.prototype.createElement = function(tag, style, attributes,
                                         text_content, parent) {
    var doc = this.doc, e = doc.createElement(tag), property;
    if(attributes)
        for(property in attributes)
            e[property] = attributes[property];
    if(style)
        for(property in style)
            e.style[property] = style[property];
    if(text_content)
        e.appendChild(doc.createTextNode(text_content));
    if(parent)
        parent.appendChild(e);
    return e;
};

SGMain.prototype.scanForTargets = function(targeting_data, ships) {
    var exc = new Array(), inc = new Array(),
    ql = targeting_data.ql,
    include = targeting_data.include,
    exclude = targeting_data.exclude;

    for(var i in ships) {
        var ship = ships[i], name = ship.name.toLowerCase(), n;

        if((n = include.ids[ship.id]) || (n = include.names[name])) {
            ship.includePriority = n;
            inc.push(ship);
        }
        else if(exclude.ids[ship.id] || exclude.names[name])
            exc.push(ship);
        else if(ql.excludeFactions[ship.faction] ||
                ql.excludeAlliances[ship.ally_id] ||
                ql.excludeCharacters[ship.id])
            exc.push(ship);
        else if(ql.includeFactions[ship.faction] ||
                ql.includeAlliances[ship.ally_id] ||
                ql.includeCharacters[ship.id])
            inc.push(ship);
    }

    return { excluded: exc, included: inc };
};

SGMain.prototype.chooseTarget = function(ships, ship_pri) {
    var best, i;

    for(i in ships) {
        var ship = ships[i];
        if(!best)
            best = ship;
        else {
            if(best.includePriority) {
                if(ship.includePriority &&
                   (ship.includePriority < best.includePriority))
                    best = ship;
            }
            else {
                if(ship.includePriority)
                    best = ship;
                else {
                    if(ship_pri) {
                        var sm = ship_pri[ship.shipModel],
                        bm = ship_pri[best.shipModel];

                        if(sm < bm)
                            best = ship;
                        else if(sm == bm) {
                            if(ship.id < best.id)
                                best = ship;
                        }
                    }
                    else {
                        if(ship.id < best.id)
                            best = ship;
                    }
                }
            }
        }
    }

    return best;
};

SGMain.prototype.getShipModelPriorities = function() {
    var a = this.SHIPS, o = new Object(), i;
    for(i in a)
        o[a[i]] = i + 1;
    return o;
};

// This if called every time the nav page is loaded or a partial
// refresh completes.  It should run fast and report no errors.
SGMain.prototype.setupNavPage = function() {
    var doc = this.doc,
        settings = {},
        n = NaN,
        elt, m, resid;

    // we'll set these if found below
    this.useBotsAmountField = null;
    this.useBotsButton = null;

    // Get the current ship armour. It's in a properly ID'd span.
    elt = doc.getElementById('spanShipArmor');
    if(elt)
        n = parseInt(elt.textContent);
    if(!isNaN(n))
        settings.lkap = n;

    // Get amount of bots in the cargo hold, from the Nav screen. This
    // information is always available, except when the user clicked
    // on the "[Use]" link for a resource other than bots. In that
    // case, the script will use the last known value stored in the
    // settings.
    n = NaN;
    elt = doc.getElementById('tdCargoRes8');
    if(elt) {
        m = elt.textContent.match(/(\d+)/);
        if(m)
            n = parseInt(m[1]);
    }
    else {
        elt = doc.getElementById('useform');
        if(elt) {
            resid = elt.elements.namedItem('resid');
            if(resid && resid.value == 8) {
                // The useres form is open for bots. Remember this...
                this.useResourceForm = elt;
                this.useBotsAmountField = elt.elements.namedItem('amount');
                this.useBotsButton = elt.elements.namedItem('useres');
                // ... and get the amount of bots available:
                m = elt.textContent.match(/On board:[\s:]*(\d+)/);
                if(m)
                    n = parseInt(m[1]);
            }
        }
        else {
            // the useres form is closed. we *know* we have no bots.
            n = 0;
        }
    }

    if(!isNaN(n))
        settings.lkba = n;

    this.storage.set( settings );
}

// This if called every time the ship2ship or building pages are
// loaded. It should run fast and report no errors.
SGMain.prototype.setupCombatPage = function() {
    var doc = this.doc,
        settings = {},
        elt;

    elt = doc.evaluate( "//td/input[@name = 'resid' and @value = '8']",
                        doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                        null ).singleNodeValue;
    if(elt) {
        // Found the resid hidden element for bots. It is contained in
        // a td. The previous td contains the amount available; the
        // next input in the current td should be the amount to use
        // field, and the next input, the submit button.
        var available =
            parseInt(elt.parentNode.previousElementSibling.textContent);
        if(!isNaN(available))
            settings.lkba = available;

        var amountField = elt.nextElementSibling;
        if(amountField && amountField.name == 'amount') {
            var submit = amountField.nextElementSibling;
            if(submit.value == 'Use') {
                this.useBotsAmountField = amountField;
                this.useBotsButton = submit;
            }
        }
    }
    else {
        // No bots available. If this is a combat screen, we know we
        // have no bots now. The building screen doesn't always show
        // how many bots we have (e.g. if the building isn't blocking)
        // so in that case we let the script use the last known value.
        if(this.page != 'building')
            settings.lkba = 0;
    }

    elt = doc.evaluate("//font[contains(text(), 'Armor points:')]",
                       doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt) {
        var armour = parseInt(elt.textContent.substring(13));
        if(!isNaN(armour))
            settings.lkap = armour;
    }

    this.storage.set( settings );
};

// Mode is either 'l' or 'm', or a number specifying exactly how many bots to
// use.
//
// 'l' mode is the normal case: if the ship's armour is below the "low"
// threshold, then use enough bots to reach max armour.  'm' mode ignores the
// low threshold and repairs whenever armour is below max.
SGMain.prototype.useBots = function( mode ) {
    var storage = this.storage,
        thisMany, bots, botWorth, newSettings, amount, submit, form;

    if ( typeof mode == 'number' ) {
        // dont bother trying to compute armour, use what we're told exactly
        thisMany = mode;
        botWorth = Math.floor( 180 / storage.armour.level );
    }
    else {
        bots = this.computeBotsNeeded( mode == 'm' );
        if ( bots.error ) {
            // Tell the user.  We'll reload immediately so they may not see it,
            // but at least try.
            this.showNotification(bots.error, 2000)
            this.nav();
            return;
        }

        if( !bots.repair || !(bots.available > 0) ) {
            this.nav();
            return;
        }

        botWorth = bots.botWorth;
        thisMany = bots.available;
    }

    // Compute how much armour the bots will repair, and how many
    // we'll have left, and update last known values.
    newSettings = {
        lkap: typeof( storage.lkap ) == 'number' ?
            storage.lkap + thisMany * botWorth : null,
        lkba: storage.lkba > thisMany ? storage.lkba - thisMany : 0
    };

    if ( this.useBotsAmountField ) {
        amount = this.useBotsAmountField;
        submit = this.useBotsButton;
    }
    else {
        // This really should only happen in the nav and building
        // screens, but it should work on any page...
        form = this.getMadeUpBotsForm();
        amount = form.elements[ 'amount' ];
        submit = form.elements[ 'useres' ];
    }

    storage.set( newSettings );
    amount.value = thisMany;
    submit.click();
}

SGMain.prototype.getMadeUpBotsForm = function() {
    var doc = this.doc, form = doc.getElementById('sgpvp-useform');
    if(form)
        return form;

    var action, method;
    if(this.page == 'main') {
        action = 'main.php';
        method = 'get'; // for some reason main doesn't respond to posts..
    }
    else {
        action = this.page + '.php';
        method = 'post';
    }

    form = this.createElement('form', {display: 'none'},
                              {id: 'sgpvp-useform', action: action,
                               method: method},
                              null, null);
    this.createElement('input', null,
                       {type: 'text', name: 'resid', value: 8}, null, form);
    this.createElement('input', null,
                       {type: 'text', name: 'amount'}, null, form);
    this.createElement('input', null,
                       {type: 'submit', name: 'useres', value: 'Use',
                        onclick: 'useRes(document.getElementById("sgpvp-useform").elements["resid"].value, document.getElementById("sgpvp-useform").elements["amount"].value);return false;'},
                       null, form);
    doc.body.appendChild(form);
    return form;
};

// This function always returns an object with the following properties:
//
// error: If non-null, a misconfiguration was detected.  This will be a string
//        that the caller can show in a notification (this function does not
//        notify the user).
//
// needed: Contains the amount of bots needed to repair to max armour; can be
//        zero if no bots are needed.
//
// available: Contains the amount of bots that can actually be used to repair
//        (not the amount of bots in the hold; this property will always be less
//        than or equal to "needed").  If this value is non-zero, this is the
//        amount of bots to use.
//
// botWorth: Contains how much armour a bot will repair.
//
// repair: If false, repair should not be performed, even if available is larger
//        than zero, because the armour is not low enough.  Note that repair may
//        be true even if available is 0; caller then should tell the user that
//        no bots are available.
//
// If alwaysRepair is true, the configured low armour threshold is ignored; the
// caller is instructed to repair whenever armour is below max.

SGMain.prototype.computeBotsNeeded = function( alwaysRepair ) {

    var storage = this.storage,
        armour = storage.armour,
        lkap = storage.lkap,
        lkba = storage.lkba,
        r = {
            error: null,
            needed: 0,
            available: 0,
            botWorth: 0,
            repair: false
        }

    if ( !(armour.level > 0) ) {
        r.error = 'Armour level not configured!';
        return r;
    }

    r.botWorth = Math.floor( 180 / armour.level );

    if ( !(armour.max > 0) ) {
        r.error = 'Max armour not configured!';
        return r;
    }

    if ( typeof(lkap) != 'number' || lkap < 0 ) {
        // In the nav screen, we should always see the ship's armour
        r.error = 'SGPvP error 5001: ship armour not found';
        return r;
    }

    if ( lkap >= armour.max )
        // Bots not needed
        return r;

    if ( !(lkba > 0) )
        // No bots available. Don't return just yet.
        lkba = 0;

    r.needed = Math.floor( (armour.max - lkap + r.botWorth - 1) / r.botWorth );
    r.available = r.needed > lkba ? lkba : r.needed;

    if ( alwaysRepair )
        r.repair = true;
    else {
        if ( !(armour.low > 0) )
            // Low armour apparently not configured; behave as if low = max
            r.repair = true;

        r.repair = ( lkap < armour.low );
    }

    return r;
};

SGMain.prototype.getShips = function() {
    switch(this.page) {
    case 'building':
        return this.getShipsBuilding();
    case 'ship2ship_combat':
        return this.getShipsCombat();
    case 'main':
        return this.getShipsNav();
    case 'ship2opponent_combat':
        return [];
    }
    return null;
};

SGMain.prototype.SCANID_RX =
    /^javascript:scanId\((\d+), "player"\)|^main\.php\?scan_details=(\d+)&scan_type=player/;
SGMain.prototype.ALLYID_RX = /^alliance\.php\?id=(\d+)/;
SGMain.prototype.getShipsNav = function() {
    var ships = [],
    doc = this.doc, sbox = doc.getElementById('otherships_content');
    if(sbox) {
        var a,
        xpr = doc.evaluate('table/tbody/tr/td[position() = 2]/a', sbox,
                           null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                           null);
        while((a = xpr.iterateNext())) {
            var m = this.SCANID_RX.exec(a.getAttribute('href'));
            if(m) {
                var r, td = a.parentNode;
                if(!(r = m[1]))
                    r = m[2];
                var entry = {
                    td: td,
                    id: parseInt(r),
                    name: a.textContent
                };
                var a2,
                xpr2 = doc.evaluate("font/b/a", td, null,
                                    XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                    null);
                while((a2 = xpr2.iterateNext())) {
                    m = this.ALLYID_RX.exec(a2.getAttribute('href'));
                    if(m)
                        entry.ally_id = parseInt(m[1]);
                }

                this.getShipEntryExtras(entry);
                ships.push(entry);
            }
        }
    }

    return ships;
};

SGMain.prototype.parseOtherShipsTable = function(tbody, link_rx) {
    var doc = this.doc, a, ships = [],
    xpr = doc.evaluate("tr/td/a", tbody, null,
                       XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((a = xpr.iterateNext())) {
        var m = link_rx.exec(a.getAttribute('href'));
        if(m) {
            var a2, td = a.parentNode,
            entry = { td: td, id: parseInt(m[1]), name: a.textContent },
            xpr2 = doc.evaluate("font/b/a", td, null,
                                XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                null);
            while((a2 = xpr2.iterateNext())) {
                m = this.ALLYID_RX.exec(a2.getAttribute('href'));
                if(m)
                    entry.ally_id = parseInt(m[1]);
            }

            this.getShipEntryExtras(entry);
            ships.push(entry);
        }
    }

    return ships;
};

SGMain.prototype.setMissiles = function(fire) {
    // ends-with() would be better, but not supported on FF
    var doc = this.doc, ck,
    xpath = "//input[@type='checkbox' and contains(@name,'_missile')]",
    xpr = doc.evaluate(xpath, doc, null,
                       XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((ck = xpr.iterateNext()))
        ck.checked = fire;
};

// Find in the given select element the option with the largest
// numeric value that is less than or equal to limit, and select it.
// Don't assume options are in any specific order, because some people
// use round reversers.
SGMain.prototype.selectMaxValue = function(select, limit) {
    var opts = select.options, max = -1, maxindex = -1;
    for(var i = 0, end = opts.length; i < end; i++) {
        var n = parseInt(opts[i].value);
        if(n <= limit && n > max)
            maxindex = i;
    }
    if(maxindex >= 0)
        select.selectedIndex = maxindex;
};

SGMain.prototype.setRounds = function(limit) {
    var doc = this.doc, sel,
    xpr = doc.evaluate('//select[@name = "rounds"]', doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    var index = 0;
    while((sel = xpr.snapshotItem(index))) {
        if(sel.style.display == 'none' &&
           sel.nextElementSibling.tagName == 'SELECT')
            // for some reason, Pardus now hides the rounds select,
            // and instead adds a second, visible select element, with
            // a gibberish name.
            sel = sel.nextElementSibling;

        this.selectMaxValue(sel, limit);
        index++;
    }
};

SGMain.prototype.doEngage = function(rounds, missiles, raid) {
    var doc = this.doc, elt, m, attack_button, premium_buttons = new Object(),
    xpr = doc.evaluate('//input[@type="submit"]', doc, null,
                       XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((elt = xpr.iterateNext())) {
      if(!elt.classList.contains('disabled') &&
         /^button\d+$/.test(elt.name) &&
         (m = /^(\d+)\s+\(\d+ APs\)$/.exec(elt.value)))
        premium_buttons[parseInt(m[1])] = elt;
      else
        if(elt.name == 'ok' && elt.value == 'Attack')
          attack_button = elt;
    }

    if(attack_button) {
      var surr = doc.getElementById('letsurrender');
      if(surr)
        surr.checked = raid;
      this.setMissiles(missiles != 'n');
      rounds = rounds ? parseInt(rounds) : 20;
      if((elt = premium_buttons[rounds]))
        elt.click();
      else {
        this.setRounds(rounds);
        attack_button.click();
      }
      // Prevent freeze by user mashing keys too fast
      this.doEngage = this.nop;
      return;
    }

    // no attack button?
    this.target();
};

SGMain.prototype.doWin = function( mode, rounds, missiles, raid ) {
    var storage = this.storage,
        armour = storage.armour,
        points = ( mode == 'm' ) ? armour.max : armour.low,
        lkap = storage.lkap,
        lkba = storage.lkba;

    if ( points > 0 && armour.level > 0 && lkba && lkap < points )
        // Armour points and level are configured, we have bots available, and
        // the last known armour points is below the threshold.  So use bots.
        this.useBots( mode );
    else
        this.doEngage( rounds, missiles, raid );

    this.doWin = this.nop; // Prevent user from navving too fast
}

SGMain.prototype.doWinB = function( botMode, attackMode, missiles ) {
    var storage = this.storage,
        armour = storage.armour,
        points = ( botMode == 'm' ) ? armour.max : armour.low,
        lkap = storage.lkap,
        lkba = storage.lkba;

    if ( points > 0 && armour.level > 0 && lkba && lkap < points )
        this.useBots( botMode );
    else
        this.doAttackBuilding( attackMode, missiles );

    this.doWinB = this.nop; // Prevent user from navving too fast
}

SGMain.prototype.doAttackBuilding = function(mode, missiles) {
    var doc = this.doc,
    xpath='//input[@name="' + mode + '" and @type="submit"]',
    elt = doc.evaluate(xpath, doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt && elt.click) {
        this.setMissiles(missiles != 'n');
        elt.click();
        return;
    }
    // no destroy/raid button?
    doc.location = 'building.php';
    this.doAttackBuilding = this.nop; // prevent freezes by user mashing key too fast
};

// Click on a link with a javascript: href. This can't be done from the content
// script because of CSP, so post a message for the injected script there to do
// it.
SGMain.prototype.clickByIdMsg = function(id) {
    let w = this.doc.defaultView;
    let data = {
        sgpvp: 'click-id',
        id: id
    };
    w.postMessage(data, this.doc.location.origin);
}

SGMain.prototype.clickById = function(id) {
    var elt = this.doc.getElementById(id);
    if(elt && elt.click &&
       !(elt.disabled || elt.classList.contains('disabled')) )
        elt.click();
    else
        this.nav();
};

// Thank you Traxus :)
// mode can be offensive, balanced or defensive (exactly)
SGMain.prototype.switchCombatMode = function(newCombatMode) {
    switch(this.page) {
    case 'main':
        var url = "/overview_advanced_skills.php",
            params = "action=switch_combat_mode&combat_mode=" + newCombatMode;
        this.postRequest(url, params, callback.bind(this));
        break;

    case 'ship2ship_combat':
    case 'building':
    case 'ship2opponent_combat':
        // were are in PvP, PvNPC or PvB, find the button
        var button = this.doc.evaluate(
            "//input[@type='submit' and @name='combat_mode' and @value='" +
                capitalizeFirstLetter(newCombatMode) + "']",
            this.doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
            null).singleNodeValue;
        if ( button )
            button.click();
    }

    // function returns here.

    function capitalizeFirstLetter( s ) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function callback( status, responseText ) {
        if (status != 200)
            this.showNotification("Can't switch combat mode", 1000);
        else {
            // now check what the response from the server was
            if (responseText.indexOf("<font color='red'>OFFENSIVE</font>") > -1)
                this.showNotification("OFFENSIVE COMBAT", 1000);
            else if (responseText.indexOf("<font color='gray'>BALANCED</font>") > -1)
                this.showNotification("Balanced combat", 1000);
            else if (responseText.indexOf("<font color='green'>DEFENSIVE</font>") > -1)
                this.showNotification("Defensive combat", 1000);
        }
    }
};

SGMain.prototype.postRequest = function(url, params, callback) {
    var r, href, http;
    // Firefox doesn't like relative URLs in XMLHttpRequest.open.
    href = new URL( url, this.doc.location ).href;
    http = new XMLHttpRequest();
    http.open("POST", href, true);
    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    http.onreadystatechange = function() {
        if( http.readyState == 4 )
            callback( http.status, http.responseText );
    }
    http.send(params);
};

SGMain.prototype.DEPLOYED_TB_RX = /Type (I|II) Tbomb active in<br>(.*?) \[(\d+),(\d+)\]<\/font>/;
// type is 1 or 2
SGMain.prototype.deployTimebomb = function( type ) {
    var url = "/overview_advanced_skills.php",
        params = "action=deploy_timebomb&timebomb_type=type_" + type;

    this.postRequest(url, params, callback.bind(this));

    // Function returns here.

    function callback( status, responseText ) {
        if (status != 200) {
            this.showNotification("Error, can't deploy", 1000);
        } else {
            // now check what the response from the server was
            // is TB deployed ?
            var deployed = this.DEPLOYED_TB_RX.exec(responseText);
            if (deployed) {
                this.showNotification("TB " + deployed[1] + " deployed at " +
                                      deployed[2] + " [" +deployed[3]+ "," +
                                      deployed[4] + "]", 1000);
            } else if (responseText.indexOf("There is an object on your current position!") > -1)
                this.showNotification("Can't deploy here", 1000);
            else
                this.showNotification("Can't deploy", 1000);
        }
    }
}


// Methods below are the actual actions we perform in response to key presses.
// Keep the method names in sync with the UI.


SGMain.prototype.setRetreatPoint = function() {
    if( this.userloc) {
        this.storage.set( { rtid: this.userloc } );
        this.showNotification( 'Retreat tile set: ' + this.storage.rtid, 500 );
    }
    else
        this.showNotification( 'Can not set retreat tile', 500 );
}

SGMain.prototype.engage = function(rounds, missiles) {
    this.doEngage(rounds, missiles, false);
};

SGMain.prototype.win = function( minArmour, rounds, missiles ) {
    this.doWin( minArmour, rounds, missiles, false );
};

SGMain.prototype.raid = function(rounds, missiles) {
    this.doEngage(rounds, missiles, true);
};

SGMain.prototype.winRaid = function( minArmour, rounds, missiles ) {
    this.doWin( minArmour, rounds, missiles, true );
};

SGMain.prototype.disengage = function() {
    var storage = this.storage,
        doc = this.doc,
        elt, form, destination, input;

    // no frantic keypressing.  but this means that, once we're in
    // this function, we *have* to reload, so watch this.
    this.disengage = this.nop;

    elt = doc.evaluate( '//input[@name="retreat" and @type="submit"]',
                        doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                        null ).singleNodeValue;
    if( elt && elt.click &&
        !( elt.disabled || elt.classList.contains('disabled') ) ) {
        elt.click(); // this reloads the page
        return;
    }

    // no retreat button...

    if( !storage.rtid ) {
        this.showNotification( 'NO RETREAT TILE SET', 500 );
        this.nav(); // this reloads the page
        return;
    }

    form = doc.getElementById( 'navForm' );
    if ( form ) {
        destination = form.elements.destination;
        if( destination )
            destination.value = storage.rtid;
    }
    else {
        // No form, add one.
        form = doc.createElement( 'form' );
        form.name = 'navForm';
        form.method = 'post';
        form.action = '/main.php';
        form.style.display = 'none';
        input = doc.createElement( 'input' );
        input.type = 'hidden';
        input.name = 'destination';
        input.value = storage.rtid;
        form.appendChild( input );
        input = doc.createElement( 'input' );
        input.type = 'hidden';
        input.name = 'ts';
        input.value = Date.now();
        doc.body.appendChild( form );
    }

    form.submit(); // this reloads the page
};

SGMain.prototype.nop = function() { };
SGMain.prototype.nav = function() { this.doc.location = 'main.php'; this.nav = this.nop; };
SGMain.prototype.bots = function( mode ) { this.useBots( mode ); };
SGMain.prototype.forceBots = function( n ) { this.useBots( parseInt(n) ); };
SGMain.prototype.testBots = function() {
    var bots = this.computeBotsNeeded( false ),
        delay = 1000,
        plural, msg;

    if ( bots.error ) {
        msg = bots.error;
        delay = 2000;
    }
    else {
        if ( bots.needed > 0 ) {
            if ( bots.needed == 1 )
                plural = '1 bot';
            else
                plural = bots.needed + ' bots';

            if ( bots.available > 0 ) {
                if ( bots.available == bots.needed )
                    msg = 'Need ' + plural;
                else if ( bots.available > 0 ) {
                    msg = 'Need ' + plural + ', have ' + bots.available;
                    delay += 500; // give them a bit more time to read
                }
                if (!bots.repair) {
                    msg += ", won't use yet";
                    delay += 500; // and a bit more
                }
            }
            else
                msg = 'Need ' + plural + ', have none';
        }
        else
            msg = 'Bots not needed';
    }

    if( bots.available && this.useBotsAmountField )
        this.useBotsAmountField.value = bots.available;

    this.showNotification(msg, delay);
};

SGMain.prototype.damageBuilding = function(missiles) {
    this.doAttackBuilding('destroy', missiles);
};
SGMain.prototype.raidBuilding = function(missiles) {
    this.doAttackBuilding('raid', missiles);
};
SGMain.prototype.winB = function( minArmour, missiles ) {
    this.doWinB( minArmour, 'destroy', missiles );
};
SGMain.prototype.winBRaid = function( minArmour, missiles ) {
    this.doWinB( minArmour, 'raid', missiles );
};


SGMain.prototype.flyClose = function() {
    this.doc.location = 'main.php?entersb=1';
    this.flyClose = this.nop;
};
SGMain.prototype.exitFlyClose = function() {
    this.doc.location = 'main.php?exitsb=1';
    this.exitFlyClose = this.nop;
};

SGMain.prototype.toggleFlyClose = function() {
    // if there is a enter SB button
    // or the ship is on starbase main page, or starbase equipment pages
    // then fly close
    // otherwise, exit sb
    // notable fail state is if on SB tile and in pvp - generally only happens on friendly SBs.
    // results in +1 nav when want to enter/chase i guess.
    if (this.doc.getElementById("aCmdStarbase") || this.doc.location.pathname.indexOf('/starbase') != -1 || this.doc.location.pathname.indexOf('/ship_equipment') != -1) {
        this.doc.location = 'main.php?entersb=1';
    }
    else {
        this.doc.location = 'main.php?exitsb=1';
    }
    this.toggleFlyClose = this.nop;
};

SGMain.prototype.dockUndock = function() { this.undock() || this.dock(); };
SGMain.prototype.dock = function() { top.location = 'game.php?logout=1'; };
SGMain.prototype.undock = function() {
    var doc = this.doc,
    xpath = '//input[@value="Launch Ship" and @type="submit"]',
    elt = doc.evaluate(xpath, doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return true;
    }
    return false;
};

SGMain.prototype.testTargeting = function() {
    var ships = this.getShips();
    if(!ships)
        return;

    var i,
    highlight_target = function(td, colour) {
        td.style.backgroundColor = colour;
        td.previousElementSibling.style.backgroundColor = colour;
    };

    for(i in ships)
        highlight_target(ships[i].td, 'inherit');

    // XXX storage.targeting should not be needed for scan...
    var targets = this.scanForTargets( this.storage.targeting, ships );
    // turn the excluded ships green
    for(i in targets.excluded)
        highlight_target(targets.excluded[i].td, '#050');
    if(targets.included.length > 0) {
        // turn the included ships red
        for(i in targets.included)
            highlight_target(targets.included[i].td, '#500');
        // highlight the chosen target
        var ship_pri = (this.page == 'main') ?
            this.getShipModelPriorities() : null;
        var best = this.chooseTarget(targets.included, ship_pri);
        highlight_target(best.td, '#900');
    }
};

SGMain.prototype.target = function() {
    var ships = this.getShips();
    if(!ships)
        return;

    var targets = this.scanForTargets( this.storage.targeting, ships );
    if(targets.included.length > 0) {
        var ship_pri = (this.page == 'main') ?
            this.getShipModelPriorities() : null;
        var best = this.chooseTarget(targets.included, ship_pri);
        this.doc.location = 'ship2ship_combat.php?playerid=' + best.id;
        this.target = this.nop; // prevent freezes by user mashing key too fast
        return;
    }

    // no target?
    this.nav();
};

SGMain.prototype.cloak = function() { this.clickById('inputShipCloak'); };
SGMain.prototype.uncloak = function() { this.clickById('inputShipUncloak'); };
SGMain.prototype.toggleCloak = function() { 
    var elt = this.doc.getElementById('inputShipCloak');
    if(elt && elt.click &&
       !(elt.disabled || elt.classList.contains('disabled')) )
        elt.click();
    else
        this.uncloak();
};
SGMain.prototype.fillTank = function() { this.clickByIdMsg('aCmdTank'); };
SGMain.prototype.jumpWH = function() { this.clickByIdMsg('aCmdWarp'); };
SGMain.prototype.stdCommand = function() { 
    let navTable = this.doc.getElementById( 'navareatransition' );
	if ( !navTable )
		navTable = this.doc.getElementById( 'navarea' );
    if ( !navTable ) {
        this.nav();
        return;
        }
    var elt = this.doc.evaluate( './/a[contains(@id, "stdCommand")]', 
        navTable, null, XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null).singleNodeValue;
    elt.click();
};
SGMain.prototype.collect = function() { this.clickByIdMsg('aCmdCollect'); };

SGMain.prototype.setAmbushRP = function() {
    var doc = this.doc,
    xpath = '//div[@id="emsg"]//input[@name="retreat_point_set" and @type="submit"]',
    elt = doc.evaluate(xpath, doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt) {
        elt.click(); return;
    }
    this.clickByIdMsg('aCmdRetreatInfo');
};

SGMain.prototype.ambush = function() {
    var storage, doc, xpath, elt, ta, apply;

    // Throttle frantic keypresses.
    this.ambush = this.nop;

    if(this.page != 'ambush') {
        this.clickById('aCmdAmbush');
        return;
    }

    // Below we assume some elements are always found.  There's
    // nothing sensible to do here if they aren't.
    doc = this.doc;
    xpath = '//b[contains(text(), "Quicklist parsed and applied")]';
    elt = doc.evaluate( xpath, doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                        null ).singleNodeValue;
    if(elt) {
        // just parsed a QL - set!
        doc.evaluate('//input[@name="confirm" and @type="submit"]',
                     doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                     null).singleNodeValue.click();
        return;
    }

    elt = doc.getElementById('readlist');
    ta = doc.evaluate( '//textarea[@name="readlist"]',
                       elt, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null ).singleNodeValue;
    apply = doc.evaluate( '//input[@name="apply_ql"]',
                          elt, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                          null ).singleNodeValue;
    if(ta.value == '') {
        // load the configured QL and apply
        this.storage.get( ['ql'], function( storage ) {
            ta.value = storage.ql;
            apply.click();
        } );
        return;
    }

    // ta.value already has a QL, just apply
    apply.click();
};

SGMain.prototype.switchToDC = function() {
  this.switchCombatMode("defensive");
};
SGMain.prototype.switchToBalanced = function() {
  this.switchCombatMode("balanced");
};
SGMain.prototype.switchToOC = function() {
  this.switchCombatMode("offensive");
};

SGMain.prototype.activateAB = function() {
  this.activateBoost("agility");
};

SGMain.prototype.activateTB = function() {
  this.activateBoost("taming");
};

SGMain.prototype.activateCB = function() {
  this.activateBoost("cloaking");
};

SGMain.prototype.deployTB1 = function() {
  this.deployTimebomb( 1 );
};
SGMain.prototype.deployTB2 = function() {
  this.deployTimebomb( 2 );
};

// Thanks Traxus!
SGMain.prototype.planetRepair = function() {
    switch(this.page) {
    case 'ship_equipment':
        var openTab =
            this.doc.evaluate(
                "//td[contains(@style,'/tabactive.png')]/text()",
                this.doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                null).singleNodeValue;
        if(!openTab)
            return;

        if (openTab.textContent != "Repair") {
            this.doc.location = 'ship_equipment.php?sort=repair';
            return;
        }

        var button = this.doc.evaluate(
            "//form[input[@name='action' and @value='regenerateall']]/input[@type='submit' and @value='Repair all']",
            this.doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
            null).singleNodeValue;

        if (!button || button.disabled)
            this.doc.location = 'main.php';
        else
            button.click();
        break;

    case 'main':
        this.doc.location = 'ship_equipment.php?sort=repair';
        return;
    }
}

SGMain.prototype.TELEROB_RX = /[?&]playerid=(\d+)/;
SGMain.prototype.telerob = function() {
    switch(this.page) {
    case 'main':
        // telerob from nav screen
        var ships = this.getShips();
        if(!ships)
            return;

        var targets = this.scanForTargets(this.storage.targeting, ships);
        if(targets.included.length > 0) {
            var ship_pri = (this.page == 'main') ?
                this.getShipModelPriorities() : null;
            var best = this.chooseTarget(targets.included, ship_pri);
            this.postRequest( "main_ajax.php", "steal=" + best.id,
                              callback.bind(this) );
            // Next telerob we'll nav instead. Can't nav now because that'd
            // break the rule of one server request per user action.
            this.telerob = this.nav;
        }
        else
            this.nav();
        break;

    case 'ship2ship_combat':
        var m = this.TELEROB_RX.exec( this.doc.location.href );
        if( m )
            this.postRequest( "main_ajax.php", "steal=" + m[1],
                              callback.bind(this) );
        // XXX should we disable telerob here? Nav? Reload the combat page?
        break;

    default:
        this.nav();
    }

    function callback( status, responseText ) {
        if (status != 200)
            this.showNotification("TELEROB ERROR", 1000);
        else
            this.showNotification("Teleport attempt!", 1000);
    }
}

SGMain.prototype.PASSORBITER_RX = /[?&]playerid=(\d+)/;
SGMain.prototype.passOrbiter = function() {
    switch(this.page) {
    case 'main':
        // pass  from nav screen
        var ships = this.getShips();
        if(!ships)
            return;

        var targets = this.scanForTargets(this.storage.targeting, ships);
        if(targets.included.length > 0) {
            var ship_pri = (this.page == 'main') ?
                this.getShipModelPriorities() : null;
            var best = this.chooseTarget(targets.included, ship_pri);
            this.postRequest( "/overview_ship.php", "player=" + best.id + "&transferorb=Send Orbiter",
                              callback.bind(this) );
            // Next pass we'll nav instead. Can't nav now because that'd
            // break the rule of one server request per user action.
            this.passOrbiter = this.nav;
        }
        else
            this.nav();
        break;

    case 'ship2ship_combat':
        var m = this.PASSORBITER_RX.exec( this.doc.location.href );
        if( m )
            this.postRequest( "/overview_ship.php", "player=" + m[1] + "&transferorb=Send Orbiter",
                              callback.bind(this) );
        // XXX should we disable pass here? Nav? Reload the combat page?
        break;

    default:
        this.nav();
    }

    function callback( status, responseText ) {
        if (status != 200)
            this.showNotification("ORBITER ERROR", 1000);
        else
            this.showNotification("Orbiter passed?!", 1000);
    }
}
SGMain.prototype.BUY_MISSILE_PRIORITIES = {
    113: 5, // NN550
    27:  4, // NN500
    26:  3, // LV111
    25:  2, // KL760
    33:  1  // P80
};
SGMain.prototype.MISSILE_FREE_SPACE_RX = /Free Space: (\d+)/;
SGMain.prototype.buyMissile = function() {
    switch(this.page) {
    case 'ship_equipment':
        var openTab = this.doc.evaluate(
            '//td[contains(@style,"tabactive.png")]', this.doc, null,
            XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue;

        if (!openTab || openTab.textContent != "Weapons") {
            this.doc.location = 'ship_equipment.php?sort=weapon';
            return;
        }

        var available = scanMissiles.call(this),
            space = getFreeSpace.call(this);

        // Find the first entry in that fits in the available space, and submit
        // that form.
        for(var i = 0, end = available.length; i < end; i++) {
            var m = available[i];
            if(space >= m.size) {
                m.form.submit();
                return;
            }
        }

        // Still here?
        this.nav();
        break;

    case 'main':
        this.doc.location = 'ship_equipment.php?sort=weapon';
    }

    // End of execution, inner function definitions below

    function scanMissiles() {
        var r = [], trs, sizexp, formxp, tr, size, form, eqid, pri;

        // We will execute these two expressions repeatedly over many table
        // rows, so we compile them.
        //
        // First: get the second td element in the row.
        sizexp = this.doc.createExpression('td[position()=2]', null);

        // Second: find a form inside a td, where the form contains an input of
        // type "submit" and value "Buy"
        formxp = this.doc.createExpression(
            'td/form[input[@type="submit" and @value="Buy"]]', null);

        // Now, find the table that contains a row with a header in column 2
        // that contains the text "Space", and a header that contains the
        // text "Price (buy)"; iterate over each tr in this table that contains
        // a td element, that contains a form of action "ship_equipment.php",
        // that contains an input of type "submit" and value "Buy" which is not
        // disabled.
        trs = this.doc.evaluate(
            '//tbody[tr[th[position()=2 and contains(text(),"Space")]][th[contains(text(),"Price (buy)")]]]/tr[td/form[@action="ship_equipment.php"][input[@type="submit" and @value="Buy" and not(@disabled)]]]',
            this.doc, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);

        while((tr = trs.iterateNext()) != null) {
            form = formxp.evaluate(tr, XPathResult.ANY_UNORDERED_NODE_TYPE,
                                   null).singleNodeValue;
            eqid = form.elements['eq_id'];
            if(eqid) {
                pri = this.BUY_MISSILE_PRIORITIES[eqid.value];
                if(pri) {
                    size = sizexp.evaluate(
                        tr, XPathResult.ANY_UNORDERED_NODE_TYPE,
                        null).singleNodeValue;
                    r.push({ pri: pri,
                             form: form,
                             size: parseInt(size.textContent) });
                }
            }
        }

        return r.sort(function(a, b) { return b.pri - a.pri; });
    }

    function getFreeSpace() {
        var b = this.doc.evaluate(
            '//td/b[contains(text(), "Free Space:")]', this.doc, null,
            XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue;
        if(b) {
            var m = this.MISSILE_FREE_SPACE_RX.exec(b.textContent);
            if(m)
                return parseInt(m[1]);
        }
        return -1;
    }
}

SGMain.prototype.configure = function() {
    if(!this.sgpvpui)
        this.sgpvpui = new SGPvPUI(this, this.storage, this.doc);
    this.sgpvpui.open();
};

SGMain.prototype.activateBoost = function(boost) {
    var url = '/overview_advanced_skills.php',
        params = 'action=boost&boost=' + boost;
    this.postRequest(url, params, callback.bind(this));

    // Function returns here.

    function callback( status, responseText ) {
        // I copied this from above, but it shows the success notification even
        // if you don't have that boost or it's already on.
        // I'm leaving it in because some message is better than none ;-)
        // Agility boost has been tested & works.
        // - K.
        if (status != 200)
            this.showNotification("Error, can't activate", 1000);
        else
            this.showNotification('Activated ' + boost + ' boost', 1000);
    }
}

SGMain.prototype.setWaypoint = function() {
    if( this.userloc ) {
        var o = this.storage.wayp;
        if (o.len > 0 ) {
            //i don't like how it's done. 
            if(o.tid[o.currentIndex] == this.userloc) {
                //if it's wormhole, set it as wormhole jump
                if(this.doc.getElementById("aCmdWarp") && !(o.tid[o.currentIndex]=="wh") ) {
                    o.tid[o.len] = "wh";
                    o.currentIndex = o.len;
                    o.len ++;
                    this.storage.set( { wayp : o } );
                    this.showNotification( 'Waypoint #' + o.currentIndex + ' set: Wormhole', 1000 );
                    return;
                } else if (["/building.php","/building_trade.php","/starbase.php","/starbase_trade.php","/planet.php","/planet_trade.php"].includes(this.doc.location.pathname)) {
                    o.tid[o.len] = "trade";
                    o.currentIndex = o.len;
                    o.len++;
                    this.storage.set( { wayp : o } );
                    this.showNotification( 'Waypoint #' + o.currentIndex + ' set: Trade', 1000 );
                    return;
                }
                //if it's an xhole/yhole, set as xhole jump
                this.showNotification('Waypoint already set!', 750)
                return;
            } else if(o.tid[o.currentIndex-1] == this.userloc && typeof(o.tid[o.currentIndex]) == "string") {
                this.showNotification('Waypoint already set!', 750)
                return;
            }
        }
        o.tid[o.len] = this.userloc;
        o.currentIndex = o.len;
        o.len ++;
        this.storage.set( { wayp : o } );
        this.showNotification( `Waypoint #${o.currentIndex} set: ${this.storage.wayp.tid[this.storage.wayp.currentIndex]}`, 1000 );
    }
    else
        this.showNotification( 'Can not set waypoint!', 500 );
}


SGMain.prototype.travel = function() {
    var storage = this.storage,
        doc = this.doc,
        elt, form, destination, input;


    // no frantic keypressing.  but this means that, once we're in
    // this function, we *have* to reload, so watch this.
    this.disengage = this.nop;

    elt = doc.evaluate( '//input[@name="retreat" and @type="submit"]',
                        doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                        null ).singleNodeValue;


    //calculating next waypoint
    //if the pilot is where it should be
    // if the tid is a string, we do special stuff, trade/wormhole jump as appropriate
    if (storage.wayp.tid[storage.wayp.currentIndex]=="wh") {
        //advance index
        if ( storage.wayp.len > 1) {
            //if the pilot has reached the end of the path, turn around
            if ( (storage.wayp.currentIndex + storage.wayp.direction == storage.wayp.len) || (storage.wayp.currentIndex + storage.wayp.direction < 0) ) {
                storage.wayp.direction *= -1;
            }
            //set destination to the next tile on the path
            storage.wayp.currentIndex += storage.wayp.direction;
        }
        this.storage.set( { wayp : storage.wayp } );
     } else if (storage.wayp.tid[storage.wayp.currentIndex] == "trade") {
        //if we're already in trade screen and there's no more trading to be done, we advance

        //if we're able to click trade, enter building

    }
    if (this.userloc == storage.wayp.tid[storage.wayp.currentIndex]) {
        //if the path consists of more than one tile lol
        if ( storage.wayp.len > 1) {
            //if the pilot has reached the end of the path, turn around
            if ( (storage.wayp.currentIndex + storage.wayp.direction == storage.wayp.len) || (storage.wayp.currentIndex + storage.wayp.direction < 0) ) {
                storage.wayp.direction *= -1;
            }
            //set destination to the next tile on the path
            storage.wayp.currentIndex += storage.wayp.direction;
            this.storage.set( { wayp : storage.wayp } );
        } 
        else if (!elt) {
            //otherwise, we're at the one and only tile...
            this.showNotification( 'Arrived at waypoint.', 750 );
            this.nav()
            return;
        }
    }
    //if there is a retreat button, we click it.
    if( elt && elt.click &&
        !( elt.disabled || elt.classList.contains('disabled') ) ) {
        //reversing waypoint direction.

        elt.click(); // this reloads the page
        return;
    }

    // no retreat button...

    if( storage.wayp.len == 0 ) {
        this.showNotification( 'No waypoints set!', 750 );
        this.nav(); // this reloads the page
        return;
    }

    //doing string stuff.
    // first, if it's a wormhole and we're on one, jump
    if (storage.wayp.tid[storage.wayp.currentIndex]=="wh") {
        if(doc.getElementById("aCmdWarp")) {
            doc.getElementById("aCmdWarp").click()
            return;
        }
    } else if (storage.wayp.tid[storage.wayp.currentIndex]=="trade") {
        var autobuybutton = doc.getElementById("quickButtonSellAndBuy");
        //console.log(autobuybutton)
        if (!(autobuybutton)) {
            if (doc.location.pathname=="/main.php") {
                //try to enter trade
                var ele;
                var trades = ["aCmdBuildingTrade" , "aCmdPlanetTrade", "aCmdStarbaseTrade"];
                for (e in trades) {
                    ele = doc.getElementById(trades[e])
                    if (ele){
                        ele.click()
                        break;
                    }
                }
                //failing that, we advance.
                if (!ele) {
                    if ( storage.wayp.len > 1) {
                        //if the pilot has reached the end of the path, turn around
                        if ( (storage.wayp.currentIndex + storage.wayp.direction == storage.wayp.len) || (storage.wayp.currentIndex + storage.wayp.direction < 0) ) {
                            storage.wayp.direction *= -1;
                        }
                        //set destination to the next tile on the path
                        storage.wayp.currentIndex += storage.wayp.direction;
                        this.storage.set( { wayp : storage.wayp } );
                    }
                    return;
                }
            } else {
                this.showNotification("not on nav", 1000)
                this.nav();
            }
        }
        else if (autobuybutton.getAttribute("onclick").localeCompare("resetForm(); quickSell({}); quickBuy({}); submitTradeForm(); return false;") != 0 ) {
            autobuybutton.click();
            //console.log("trading")
        } else {
            //console.log("done trading");
            //done trading, we can advance
            if ( storage.wayp.len > 1) {
                //if the pilot has reached the end of the path, turn around
                if ( (storage.wayp.currentIndex + storage.wayp.direction == storage.wayp.len) || (storage.wayp.currentIndex + storage.wayp.direction < 0) ) {
                    storage.wayp.direction *= -1;
                }
                //set destination to the next tile on the path
                storage.wayp.currentIndex += storage.wayp.direction;
                this.storage.set( { wayp : storage.wayp } );
            }
            this.nav();
        }
        return;
    }
    form = doc.getElementById( 'navForm' );
    if ( form ) {
        destination = form.elements.destination;
        if( destination ) {
            destination.value = storage.wayp.tid[storage.wayp.currentIndex];
        }
        form.submit(); // this reloads the page
    }
    else {
        if(doc.location.pathname == "/main.php"){
            // No form, add one.
            form = doc.createElement( 'form' );
            form.name = 'navForm';
            form.method = 'post';
            form.action = '/main.php';
            form.style.display = 'none';
            input = doc.createElement( 'input' );
            input.type = 'hidden';
            input.name = 'destination';
            input.value = getDestination(storage.wayp.tid[storage.wayp.currentIndex]);//wtf is getdestination? only works on main.php?
            form.appendChild( input );
            input = doc.createElement( 'input' );
            input.type = 'hidden';
            input.name = 'ts';
            input.value = Date.now();
            doc.body.appendChild( form );
            //console.log("making form");
            form.submit(); // this reloads the page
        } else {
            this.nav();
        }
}
    //this.showNotification( "Moving to waypoint: " + storage.wayp.currentIndex , 500 );
};

SGMain.prototype.clearWaypoints = function() {
    this.showNotification( 'Waypoints cleared: ' + this.storage.wayp.len, 500);
    this.storage.set( { wayp : { len : 0, tid : {}, currentIndex : -1, direction : 1 } } );
    //console.log(wayp.len)
    //console.log(wayp.currentIndex)
    //console.log(wayp.direction)
}


SGMain.prototype.getVersion = function() {
    return chrome.runtime.getManifest().version_name;
};

// The following are here because the Firefox implementations have to
// deal with oddities introduced by "Mr Xyzzy's Pardus Helper".
// There's no such thing on Chrome, so we can simplify here.

SGMain.prototype.BUILDING_PLAYER_DETAIL_RX = /^building\.php\?detail_type=player&detail_id=(\d+)/;
SGMain.prototype.getShipsBuilding = function() {
    var doc = this.doc,
    xpr = doc.evaluate("//table[@class='messagestyle']/tbody/tr/th",
                       doc, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                       null);
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
SGMain.prototype.SHIP2SHIP_RX = /^ship2ship_combat\.php\?playerid=(\d+)/;
SGMain.prototype.getShipsCombat = function() {
    var doc = this.doc,
    xpr = doc.evaluate("//table[@class='messagestyle']/tbody/tr/th",
                       doc, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                       null);
    var th;
    while((th = xpr.iterateNext())) {
        var heading = th.textContent;
        if(heading == 'Other Ships')
            return this.parseOtherShipsTable(th.parentNode.parentNode,
                                             this.SHIP2SHIP_RX);
    }

    // Still here?
    return [];
};

// This gets the faction and ship type from a ship entry. It's a
// separate method to reuse it - we do it the same in all pages.
SGMain.prototype.SHIPBGIMAGE_RX = /^url\("[^"]+\/ships\/([^/.]+)(?:_paint\d+|xmas)?\.png"\)$/;
SGMain.prototype.SHIPIMSRC_RX = /ships\/([^/.]+)(?:_paint\d+|xmas)?\.png$/;
SGMain.prototype.FACTIONSIGN_RX = /factions\/sign_(fed|emp|uni)/;
SGMain.prototype.getShipEntryExtras = function(entry) {
    // find the ship type
    var itd = entry.td.previousElementSibling;
    if(itd) {
        var m = this.SHIPBGIMAGE_RX.exec(itd.style.backgroundImage);
        if(m)
            entry.shipModel = m[1];

        // see if we find a faction
        var xpr = this.doc.evaluate("img", itd, null,
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

SGMain.prototype.getResourceText = async function (resource) {
    let url = chrome.runtime.getURL(resource);
    let response = await fetch(url);
    if (!response.ok) {
        throw new Error(`getResourceText response status: ${response.status}`);
    }
    return response.text();
};
