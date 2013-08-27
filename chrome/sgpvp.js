// SGPvP object. This code must run on Firefox and Google Chrome - no
// Greasemonkey calls and no chrome.* stuff here.

// V31.4

function SGPvP() {
    this.url = window.location.href;

    var m = this.LOCATION_RX.exec(this.url);
    if(!m)
        return;

    this.universe = m[1];
    this.page = m[2];

    var self = this;
    switch(this.page) {
    case 'main':
        this.setupPageSpecific = this.setupNavPage;
        break;
    case 'ship2ship_combat':
    case 'building':
        this.setupPageSpecific = function() {
            self.setupCombatPage();
            self.setMissiles(true);
            // leave rounds alone for now. if the user engages with a
            // key, we'll set the proper option then
        };
        break;
    case 'ship2opponent_combat':
        this.setupPageSpecific = function() { this.setupCombatPage(); };
        break;
    default:
        // logout
        this.setupPageSpecific = function() {}; // nop
    }

    var keyHandler = function(event) { self.keyPressHandler(event); },
    setupHandler = function(event) { self.setupPage(event); },
    finishConfig = function() {
        if(!self.keymap)
            // load default keymap
            self.saveSettings({keymap: JSON.parse(self.getResourceText('default_keymap'))});
        document.addEventListener('keydown', keyHandler, false);

        // Insert a bit of script to execute in the page's context and
        // send us what we need. And add a listener to receive the call.
        window.addEventListener('message', setupHandler, false);
        var script = document.createElement('script');
        script.type = 'text/javascript';
        // window.location.origin is only available on FF 20
        script.textContent = "(function() {var fn=function(){window.postMessage({sgpvp:1,loc:userloc},window.location.protocol+'//'+window.location.host);};if(typeof(addUserFunction)=='function')addUserFunction(fn);fn();})();";
        document.body.appendChild(script);
    };

    this.loadSettings(['keymap', 'targeting', 'armour',
                       'lkap', 'lkba', 'rtid', 'rmsl'],
                      finishConfig);
}

SGPvP.prototype.LOCATION_RX = /^https?:\/\/([^.]+)\.pardus\.at\/([^.]+)\.php/;

// Ship priorities - all else being the same, first listed here are first shot
SGPvP.prototype.SHIPS = [
    // 1 - real traders and low level hybrids
    'leviathan', 'boa_ultimate_carrier', 'behemoth', 'extender', 'celeus',
    'lanner', 'blood_lanner', 'mantis', 'elpadre', 'constrictor', 'hercules',
    'babel_transporter', 'junkeriv', 'lanner_mini', 'slider', 'harrier',

    // 2 - possible traders relatively easy to kill
    'mooncrusher', 'war_nova',

    // 3 - fighters
    'dominator', 'liberator', 'liberator_eps', 'sudden_death', 'gauntlet',
    'scorpion', 'pantagruel', 'chitin', 'horpor', 'gargantua', 'reaper',
    'vulcan', 'piranha', 'venom', 'rover', 'mercury', 'trident', 'marauder',
    'shadow_stealth_craft',

    // 4 - breakers
    'phantom_advanced_stealth_craft', 'hawk', 'doomstar',
    'viper_defence_craft', 'nano', 'nighthawk_deluxe', 'nighthawk',

    // 5 - harmless noob ships that may still be under protection
    'thunderbird', 'spectre', 'interceptor', 'adder', 'tyrant', 'rustfire',
    'wasp', 'ficon', 'rustclaw', 'sabre'
];

// A specification of the stuff we keep in persistent storage.
// 'u' is true for parameters set once for all universes.
// 'd' is the default value.
SGPvP.prototype.CFGDEF = {
    keymap: { u:true, d:null },
    rtid: { u:false, d:null }, // retreat tile id
    lkap: { u:false, d:null }, // last known armour points
    lkba: { u:false, d:null }, // last known bots available
    rmsl: { u:false, d:null }, // raid with missiles
    ql: { u:false, d:'' },
    targeting: { u:false,
                 d:{ ql:{includeFactions:{},
                         excludeFactions:{},
                         includeAlliances:{},
                         excludeAlliances:{},
                         includeCharacters:{},
                         excludeCharacters:{}},
                     include:{ids:{},names:{}},
                     exclude:{ids:{},names:{}},
                     prioritiseTraders:false,
                     retreatTile:null } },
    armour: { u:false, d:{ points: null, level: 5 } }
};

// Load the specified keys from persistent storage into object properties.
SGPvP.prototype.loadSettings = function(keys, callback) {
    var self = this, skeys = new Object(), defs = this.CFGDEF,
        prefix = this.universe + '-';
    var act = function(r) {
        for(var skey in skeys) {
            var key = skeys[skey], def = defs[key], val = r[skey];
            if(typeof(val) == 'undefined')
                val = def.d;
            self[key] = val;
        }
        callback();
    };

    for(var i in keys) {
        var key = keys[i], def = defs[key], skey = def.u ? key : prefix + key;
        skeys[skey] = key;
    }

    this.getValues(Object.keys(skeys), act);
};

SGPvP.prototype.saveSettings = function(settings) {
    var o = new Object(), defs = this.CFGDEF, prefix = this.universe + '-';
    for(var key in settings) {
        var skey = defs[key].u ? key : prefix + key;
        this[key] = o[skey] = settings[key];
    }
    this.setValues(o);
};

// This is a handler for DOM messages coming from the game page.
// Arrival of a message means the page contents were updated. The
// message contains the value of the userloc variable, too.
//
// Doing things this way may seem a bit awkward to Firefox userscript
// writers, but it is the proper (only?) way to do it in Chrome.
// Plus, this spares us from using unsafeWindow at all, which is a
// Good Thing.
SGPvP.prototype.setupPage = function(event) {
    if(!event.data || event.data.sgpvp != 1)
        return;
    this.userloc = parseInt(event.data.loc);
    this.setupPageSpecific();
};

SGPvP.prototype.closeUi = function() {
    if(this.sgpvpui)
        this.sgpvpui.close();
};

SGPvP.prototype.keyPressHandler = function(event) {
    if(event.ctrlKey || event.altKey || event.metaKey)
        return;

    if(event.keyCode == 27) {
        this.closeUi();
        return;
    }

    if(event.target &&
       (event.target.nodeName == 'INPUT' || event.target.nodeName == 'TEXTAREA'))
        return;

    var method_name = this.keymap[event.keyCode];
    if(method_name) {
        event.preventDefault();
        event.stopPropagation();
        this[method_name].call(this);
    }
};

SGPvP.prototype.NOTIFICATION_STYLE = {
    background: '#00002C', border: '2px outset #335', fontSize: '18px',
    left: '50%', margin: '-2.2em 0 0 -4em', padding: '0.5em',
    position: 'fixed', textAlign: 'center', top: '50%', width: '8em',
    zIndex: '15'
};
SGPvP.prototype.showNotification = function(text, delay) {
    if(this.notification_timer)
        clearTimeout(this.notification_timer);
    this.hideNotification();
    this.notification =
        this.createElement('div', this.NOTIFICATION_STYLE, null, text, null);
    document.body.appendChild(this.notification);

    var self = this;
    this.notification_timer =
        window.setTimeout(function() {
                              self.notification_timer = null;
                              self.hideNotification();
                          }, delay);
};

SGPvP.prototype.hideNotification = function() {
    if(this.notification)
        document.body.removeChild(this.notification);
    this.notification = null;
};

SGPvP.prototype.createElement = function(tag, style, attributes,
                                         text_content, parent) {
    var e = document.createElement(tag), property;
    if(attributes)
        for(property in attributes)
            e[property] = attributes[property];
    if(style)
        for(property in style)
            e.style[property] = style[property];
    if(text_content)
        e.appendChild(document.createTextNode(text_content));
    if(parent)
        parent.appendChild(e);
    return e;
};

SGPvP.prototype.scanForTargets = function(targeting_data, ships) {
    var exc = new Array(), inc = new Array(),
    ql = targeting_data.ql,
    include = targeting_data.include,
    exclude = targeting_data.exclude;

    for(var i in ships) {
        var ship = ships[i], name = ship.name.toLowerCase(), n;

        if(exclude.ids[ship.id] || exclude.names[name])
            exc.push(ship);
        else if((n = include.ids[ship.id]) || (n = include.names[name])) {
            ship.includePriority = n;
            inc.push(ship);
        }
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

SGPvP.prototype.chooseTarget = function(ships, ship_pri) {
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

SGPvP.prototype.getShipModelPriorities = function() {
    var a = this.SHIPS, o = new Object(), i;
    for(i in a)
        o[a[i]] = i + 1;
    return o;
};

// This if called every time the nav page is loaded or a partial
// refresh completes.  It should run fast and report no errors.
SGPvP.prototype.setupNavPage = function() {
    // we'll set these if found below
    this.useBotsAmountField = null;
    this.useBotsButton = null;

    var settings = new Object(), n = NaN, elt;

    // Get the current ship armour. It's in a properly ID'd span.
    elt = document.getElementById('spanShipArmor');
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
    elt = document.getElementById('tdCargoRes8');
    if(elt) {
        var m = elt.textContent.match(/(\d+)/);
        if(m)
            n = parseInt(m[1]);
    }
    else {
        elt = document.getElementById('useform');
        if(elt) {
            var resid = elt.elements.namedItem('resid');
            if(resid && resid.value == 8) {
                // The useres form is open for bots. Remember this...
                this.useResourceForm = elt;
                this.useBotsAmountField = elt.elements.namedItem('amount');
                this.useBotsButton = elt.elements.namedItem('useres');
                // ... and get the amount of bots available:
                var m = elt.textContent.match(/On board:[\s:]*(\d+)/);
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

    this.saveSettings(settings);
};

// This if called every time the ship2ship or building pages are
// loaded. It should run fast and report no errors.
SGPvP.prototype.setupCombatPage = function() {
    var settings = new Object(), elt;

    elt = document.evaluate("//td/input[@name = 'resid' and @value = '8']",
                            document, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                            null).singleNodeValue;
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

    elt = document.evaluate("//font[contains(text(), 'Armor points:')]",
                            document, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                            null).singleNodeValue;
    if(elt) {
        var armour = parseInt(elt.textContent.substring(13));
        if(!isNaN(armour))
            settings.lkap = armour;
    }

    this.saveSettings(settings);
};

// If thisMany is not supplied, compute the amount needed to the best
// of our knowledge.
SGPvP.prototype.useBots = function(thisMany) {
    var botRepair;

    if(thisMany)
        // dont bother trying to compute armour, use what we're told exactly
        botRepair = Math.floor(180 / this.armour.level);
    else {
        var bots = this.computeBotsNeeded();
        if(!bots) {
            this.nav();
            return;
        }

        botRepair = bots.botRepair;
        thisMany = bots.available;
    }

    // Compute how much armour the bots will repair, and how many
    // we'll have left, and update last known values.
    var newSettings = {
        lkap: typeof(this.lkap) == 'number' ?
            this.lkap + thisMany * botRepair : null,
        lkba: this.lkba > thisMany ? this.lkba - thisMany : 0
    };

    var amount, submit;
    if(this.useBotsAmountField) {
        amount = this.useBotsAmountField;
        submit = this.useBotsButton;
    }
    else {
        // This really should only happen in the nav and building
        // screens, but it should work on any page...
        var form = this.getMadeUpBotsForm();
        amount = form.elements['amount'];
        submit = form.elements['useres'];
    }

    this.saveSettings(newSettings);
    amount.value = thisMany;
    submit.click();
};

SGPvP.prototype.getMadeUpBotsForm = function() {
    var form = document.getElementById('sgpvp-useform');
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
    document.body.appendChild(form);
    return form;
};

// This function shows notifications. If it returns null, bots are not
// needed or can't be used, and the user already knows.
SGPvP.prototype.computeBotsNeeded = function() {
    var armour = this.armour, lkap = this.lkap, lkba = this.lkba;
    if(!(armour.points > 0 && armour.level > 0)) {
        this.showNotification('Ship armour not configured', 1500);
        return null;
    }

    if(typeof(lkap) != 'number' || lkap < 0) {
        // In the nav screen, we should always see the ship's armour
        this.showNotification("SGPvP error 5001: ship armour not found", 1500);
        return null;
    }

    if(!lkba) {
        this.showNotification("No bots available!", 500);
        return null;
    }

    if(lkap >= armour.points) {
        this.showNotification('Bots not needed', 500);
        return null;
    }

    var botRepair = Math.floor(180 / armour.level);
    var needed = Math.floor((armour.points - lkap + botRepair - 1) / botRepair);
    return {
        botRepair: botRepair,
        needed: needed,
        available: needed > lkba ? lkba : needed
    };
};

SGPvP.prototype.getShips = function() {
    switch(this.page) {
    case 'building':
        return this.getShipsBuilding();
    case 'ship2ship_combat':
        return this.getShipsCombat();
    case 'main':
        return this.getShipsNav();
    }
    return null;
};

SGPvP.prototype.SCANID_RX =
    /^javascript:scanId\((\d+), "player"\)|^main\.php\?scan_details=(\d+)&scan_type=player/;
SGPvP.prototype.ALLYID_RX = /^alliance\.php\?id=(\d+)/;
SGPvP.prototype.getShipsNav = function() {
    var ships = [];
    var sbox = document.getElementById('otherships_content');
    if(sbox) {
        var a,
        xpr = document.evaluate('table/tbody/tr/td[position() = 2]/a', sbox,
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
                xpr2 = document.evaluate("font/b/a", td, null,
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

SGPvP.prototype.parseOtherShipsTable = function(tbody, link_rx) {
    var a, ships = [],
    xpr = document.evaluate("tr/td/a", tbody, null,
                            XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((a = xpr.iterateNext())) {
        var m = link_rx.exec(a.getAttribute('href'));
        if(m) {
            var a2, td = a.parentNode,
            entry = { td: td, id: parseInt(m[1]), name: a.textContent },
            xpr2 = document.evaluate("font/b/a", td, null,
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

SGPvP.prototype.setMissiles = function(fire) {
    // ends-with() would be better, but not supported on FF
    var ck,
    xpr = document.evaluate("//input[@type='checkbox' and contains(@name,'_missile')]",
                            document, null,
                            XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((ck = xpr.iterateNext()))
        ck.checked = fire;
};

// Find in the given select element the option with the largest
// numeric value that is less than or equal to limit, and select it.
// Don't assume options are in any specific order, because some people
// use round reversers.
SGPvP.prototype.selectMaxValue = function(select, limit) {
    var opts = select.options, max = -1, maxindex = -1;
    for(var i = 0, end = opts.length; i < end; i++) {
        var n = parseInt(opts[i].value);
        if(n <= limit && n > max)
            maxindex = i;
    }
    if(maxindex >= 0)
        select.selectedIndex = maxindex;
};

SGPvP.prototype.setRounds = function(limit) {
    var sel,
    xpr = document.evaluate('//select[@name = "rounds"]', document, null,
                            XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((sel = xpr.iterateNext())) {
        if(sel.style.display == 'none' &&
           sel.nextElementSibling.tagName == 'SELECT') {
            // for some reason, Pardus now hides the rounds select,
            // and instead adds a second, visible select element, with
            // a gibberish name.
            sel.selectedIndex = 0; // XXX - review
            sel = sel.nextElementSibling;
        }
        this.selectMaxValue(sel, limit);
    }
};

SGPvP.prototype.doEngage = function(rounds, raid) {
    var elt = document.evaluate('//input[@name="ok" and @type="submit" and @value="Attack"]',
                                document, null,
                                XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
    if(elt && elt.click) {
        var missiles;
        if(this.page == 'ship2opponent_combat')
            missiles = false;
        else if(raid) {
            var surr = document.getElementById('letsurrender'); 
            if(surr) {
                surr.checked = true;
                missiles = this.rmsl ? true : false;
            }
            else
                missiles = true;
        }
        else
            missiles = true;
        this.setRounds(rounds);
        this.setMissiles(missiles);
        elt.click();
        return;
    }

    // no attack button?
    this.target();
};


// Methods below are the actual actions we perform in response to key presses.
// Keep the method names in sync with the UI.


SGPvP.prototype.setRetreatPoint = function() {
    if(this.userloc) {
        this.saveSettings({rtid: this.userloc});
        this.showNotification('Retreat tile set: ' + this.rtid, 500);
    }
    else
        this.showNotification('Can not set retreat tile', 500);
};

SGPvP.prototype.engage = function() { this.doEngage(1000, false); };
SGPvP.prototype.engage15 = function() { this.doEngage(15, false); };
SGPvP.prototype.engage10 = function() { this.doEngage(10, false); };
SGPvP.prototype.raid = function() { this.doEngage(1000, true); };
SGPvP.prototype.raid15 = function() { this.doEngage(15, true); };
SGPvP.prototype.raid10 = function() { this.doEngage(10, true); };

SGPvP.prototype.disengage = function() {
    var elt = document.evaluate('//input[@name="retreat" and @type="submit"]',
                                document, null,
                                XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return;
    }

    // no retreat button?
    if(this.page != 'main') {
        // XXX - we probably could skip this nav, by inserting an
        // invisible form and submitting it...
        this.nav();
        return;
    }

    if(this.rtid) {
        var form = document.getElementById('navForm');
        if(form) {
            var destination = form.elements.destination;
            if(destination) {
                destination.value = this.rtid;
                form.submit();
                return;
            }
        }
        // still here? report...
        this.showNotification("SGPvP error 5002: cannot retreat, USE MOUSE and REPORT THIS", 1500);
    }
    else
        this.showNotification('NO RETREAT TILE SET', 500);

    this.nav();
};

SGPvP.prototype.nav = function() { document.location = 'main.php'; };
SGPvP.prototype.bots = function() { this.useBots(null); };

SGPvP.prototype.testBots = function() {
    var msg, bots = this.computeBotsNeeded();
    if(!bots)
        return;

    if(this.useBotsAmountField)
        this.useBotsAmountField.value = bots.available;

    if(bots.needed == 1)
        msg = 'Need ' + bots.needed + ' robot, would use ' + bots.available;
    else
        msg = 'Need ' + bots.needed + ' robots, would use ' + bots.available;
    this.showNotification(msg, 1000);
};

SGPvP.prototype.damageBuilding = function() {
    var elt = document.evaluate('//input[@name="destroy" and @type="submit"]',
                                document, null,
                                XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return;
    }
    // no destroy button?
    document.location = 'building.php';
};

SGPvP.prototype.bots1 = function() { this.useBots(1); };
SGPvP.prototype.bots2 = function() { this.useBots(2); };
SGPvP.prototype.bots3 = function() { this.useBots(3); };
SGPvP.prototype.bots4 = function() { this.useBots(4); };
SGPvP.prototype.bots5 = function() { this.useBots(5); };
SGPvP.prototype.bots8 = function() { this.useBots(8); };
SGPvP.prototype.bots12 = function() { this.useBots(12); };
SGPvP.prototype.fillTank = function() {
    document.location = 'main.php?fillup=1';
};
SGPvP.prototype.enterBuilding = function() {
    document.location = 'building.php';
};
SGPvP.prototype.flyClose = function() {
    document.location = 'main.php?entersb=1';
};
SGPvP.prototype.exitFlyClose = function() {
    document.location = 'main.php?exitsb=1';
};
SGPvP.prototype.dockUndock = function() { this.undock() || this.dock(); };
SGPvP.prototype.dock = function() { top.location = 'game.php?logout=1'; };

SGPvP.prototype.undock = function() {
    var elt = document.evaluate('//input[@value="Launch Ship" and @type="submit"]',
                                document, null,
                                XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return true;
    }
    return false;
};

SGPvP.prototype.cloak = function() {
    var elt = document.getElementById('inputShipCloak');
    if(elt && elt.click)
        elt.click();
    else
        this.nav();
};

SGPvP.prototype.uncloak = function() {
    var elt = document.getElementById('inputShipUncloak');
    if(elt && elt.click)
        elt.click();
    else
        this.nav();
};

SGPvP.prototype.testTargeting = function() {
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

    // XXX this.targeting not needed for scan...
    var targets = this.scanForTargets(this.targeting, ships);
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

SGPvP.prototype.target = function() {
    var ships = this.getShips();
    if(!ships)
        return;

    var targets = this.scanForTargets(this.targeting, ships);
    if(targets.included.length > 0) {
        var ship_pri = (this.page == 'main') ?
            this.getShipModelPriorities() : null;
        var best = this.chooseTarget(targets.included, ship_pri);
        document.location = 'ship2ship_combat.php?playerid=' + best.id;
        return;
    }

    // no target?
    this.nav();
};

SGPvP.prototype.jumpWH = function() {
    var warp = document.getElementById('aCmdWarp');
    if(warp)
        warp.click();
    else
        this.nav();
};

SGPvP.prototype.configure = function() {
    if(typeof(SGPvPUI) != 'function')
        // load the UI code
        eval(this.getResourceText('ui_js'));
    if(!this.sgpvpui)
        this.sgpvpui = new SGPvPUI(this, document);
    this.sgpvpui.open();
};
