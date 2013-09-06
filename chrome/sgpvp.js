// SGPvP object. This code must run on Firefox and Google Chrome - no
// Greasemonkey calls and no chrome.* stuff here.

// V32

function SGPvP(top) {
    this.top = top;
    this.doc = top.document;
    this.doc.addEventListener('DOMContentLoaded',
                              this.onTopReady.bind(this), false);
}

SGPvP.prototype.onTopReady = function() {
    this.frames = {
        main: this.doc.getElementById('main'),
        menu: this.doc.getElementById('menu'),
        msgframe: this.doc.getElementById('msgframe')
    };
    if(!this.frames.main || !this.frames.menu || !this.frames.msgframe)
        throw new Error('SGPvP cannot find Pardus frames');
    this.platformInit();
};

SGPvP.prototype.onFrameReady = function(frame_id) {
    var frame = this.frames[frame_id];
    if(!frame)
        return;

    if(frame_id == 'main')
        this.mainDriver = new SGMain(frame.contentDocument);

    // We handle keys in all three Pardus frames.  In menu and
    // msgframe we don't really do anything, but we want to listen for
    // keys anyway because focus may switch to those, and we don't
    // want the user to have to click on the main frame.
    frame.contentDocument.addEventListener('keydown',
                                           this.onKeyDown.bind(this), false);
};

SGPvP.prototype.onKeyDown = function(event) {
    if(!this.mainDriver || event.ctrlKey || event.altKey || event.metaKey ||
       (event.target && (event.target.nodeName == 'INPUT' ||
                         event.target.nodeName == 'TEXTAREA')))
        return;

    if(this.mainDriver.keyPressHandler(event.keyCode)) {
        event.preventDefault();
        event.stopPropagation();
    }
};

function SGMain(doc) {
    this.doc = doc;

    var url = doc.location.href, m = this.LOCATION_RX.exec(url);
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
        // ambush, logout
        this.setupPageSpecific = function() {}; // nop
    }

    var setupHandler = function(event) { self.setupPage(event); },
    finishConfig = function() {
        if(!self.keymap)
            // load default keymap
            self.saveSettings({keymap: JSON.parse(self.getResourceText('default_keymap'))});

        // Insert a bit of script to execute in the page's context and
        // send us what we need. And add a listener to receive the call.
        var window = self.doc.defaultView;
        window.addEventListener('message', setupHandler, false);
        var script = self.doc.createElement('script');
        script.type = 'text/javascript';
        // window.location.origin is only available on FF 20
        script.textContent = "(function() {var fn=function(){window.postMessage({sgpvp:1,loc:typeof(userloc)=='undefined'?null:userloc,ajax:typeof(ajax)=='undefined'?null:ajax},window.location.protocol+'//'+window.location.host);};if(typeof(addUserFunction)=='function')addUserFunction(fn);fn();})();";
        self.doc.body.appendChild(script);
    };

    this.loadSettings(['keymap', 'targeting', 'armour',
                       'lkap', 'lkba', 'rtid' ],
                      finishConfig);
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
SGMain.prototype.CFGDEF = {
    keymap: { u:true, d:null },
    rtid: { u:false, d:null }, // retreat tile id
    lkap: { u:false, d:null }, // last known armour points
    lkba: { u:false, d:null }, // last known bots available
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
SGMain.prototype.loadSettings = function(keys, callback) {
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

SGMain.prototype.saveSettings = function(settings) {
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
SGMain.prototype.setupPage = function(event) {
    if(!event.data || event.data.sgpvp != 1)
        return;
    this.userloc = parseInt(event.data.loc);
    this.ajax = event.data.ajax;
    this.setupPageSpecific();
};

SGMain.prototype.closeUi = function() {
    if(this.sgpvpui)
        this.sgpvpui.close();
};

// XXX - this will be removed in a few versions
SGMain.prototype.OLD_KEYMAP_ACTIONS = {
    bots1: 'forceBots,1',
    bots2: 'forceBots,2',
    bots3: 'forceBots,3',
    bots4: 'forceBots,4',
    bots5: 'forceBots,5',
    bots8: 'forceBots,8',
    bots12: 'forceBots,12',
    engage: 'engage,20,m',
    engage10: 'engage,10,m',
    engage15: 'engage,15,m',
    raid: 'raid,20,n',
    raid10: 'raid,10,n',
    raid15: 'raid,15,n',
    damageBuilding: 'damageBuilding,m'
};

SGMain.prototype.fixActionString = function(str) {
    var newstr = this.OLD_KEYMAP_ACTIONS[str];
    return newstr || str;
};

SGMain.prototype.keyPressHandler = function(keyCode) {
    if(keyCode == 27) {
        if(this.sgpvpui)
            this.sgpvpui.toggle();
        else
            this.configure();
        return;
    }

    var astr = this.fixActionString(this.keymap[keyCode]);
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
        clearTimeout(this.notification_timer);
    this.hideNotification();
    this.notification =
        this.createElement('div', this.NOTIFICATION_STYLE, null, text, null);
    this.doc.body.appendChild(this.notification);

    var self = this, window = this.doc.defaultView;
    this.notification_timer =
        window.setTimeout(function() {
                              self.notification_timer = null;
                              self.hideNotification();
                          }, delay);
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
    // we'll set these if found below
    this.useBotsAmountField = null;
    this.useBotsButton = null;

    var doc = this.doc, settings = new Object(), n = NaN, elt;

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
        var m = elt.textContent.match(/(\d+)/);
        if(m)
            n = parseInt(m[1]);
    }
    else {
        elt = doc.getElementById('useform');
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
SGMain.prototype.setupCombatPage = function() {
    var doc = this.doc, settings = new Object(), elt;

    elt = doc.evaluate("//td/input[@name = 'resid' and @value = '8']",
                       doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
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

    elt = doc.evaluate("//font[contains(text(), 'Armor points:')]",
                       doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
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
SGMain.prototype.useBots = function(thisMany) {
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

// This function shows notifications. If it returns null, bots are not
// needed or can't be used, and the user already knows.
SGMain.prototype.computeBotsNeeded = function() {
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

SGMain.prototype.getShips = function() {
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
    xpr = doc.evaluate('//select[@name = "rounds"]', doc, null,
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

SGMain.prototype.doEngage = function(rounds, missiles, raid) {
    var doc = this.doc,
    xpath = '//input[@name="ok" and @type="submit" and @value="Attack"]',
    elt = doc.evaluate(xpath, doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt && elt.click) {
        var surr = doc.getElementById('letsurrender');
        if(surr)
            surr.checked = raid;
        this.setMissiles(missiles != 'n');
        this.setRounds(rounds ? parseInt(rounds) : 20);
        elt.click();
        return;
    }

    // no attack button?
    this.target();
};

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
};

SGMain.prototype.clickById = function(id) {
    var elt = this.doc.getElementById(id);
    if(elt && elt.click)
        elt.click();
    else
        this.nav();
};


// Methods below are the actual actions we perform in response to key presses.
// Keep the method names in sync with the UI.


SGMain.prototype.setRetreatPoint = function() {
    if(this.userloc) {
        this.saveSettings({rtid: this.userloc});
        this.showNotification('Retreat tile set: ' + this.rtid, 500);
    }
    else
        this.showNotification('Can not set retreat tile', 500);
};

SGMain.prototype.engage = function(rounds, missiles) {
    this.doEngage(rounds, missiles, false);
};

SGMain.prototype.raid = function(rounds, missiles) {
    this.doEngage(rounds, missiles, true);
};

SGMain.prototype.disengage = function() {
    var doc = this.doc,
    elt = doc.evaluate('//input[@name="retreat" and @type="submit"]',
                       doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return;
    }

    // no retreat button?
    if(this.page != 'main') {
        // XXX - we may be able to skip this nav, by inserting an
        // invisible form and submitting it...
        this.nav();
        return;
    }

    if(!this.rtid) {
        this.showNotification('NO RETREAT TILE SET', 500);
        this.nav();
    }

    if(this.ajax) {
        var xpath = "//table[@id='navareatransition']/tbody/tr/td/a[@onclick='navAjax(" +
            this.rtid + ")']";
        var tile = doc.evaluate(xpath, doc, null,
                                XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
        if(tile) {
            tile.click();
            return;
        }
    }

    var form = doc.getElementById('navForm');
    if(form) {
        var destination = form.elements.destination;
        if(destination) {
            destination.value = this.rtid;
            form.submit();
            return;
        }
    }

    // still here? report...
    this.showNotification("Error 5002 cannot retreat, USE MOUSE and REPORT THIS", 1500);
};

SGMain.prototype.nav = function() { this.doc.location = 'main.php'; };
SGMain.prototype.bots = function() { this.useBots(null); };
SGMain.prototype.forceBots = function(n) { this.useBots(n); };
SGMain.prototype.testBots = function() {
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

SGMain.prototype.damageBuilding = function(missiles) {
    this.doAttackBuilding('destroy', missiles);
};
SGMain.prototype.raidBuilding = function(missiles) {
    this.doAttackBuilding('raid', missiles);
};
SGMain.prototype.flyClose = function() {
    this.doc.location = 'main.php?entersb=1';
};
SGMain.prototype.exitFlyClose = function() {
    this.doc.location = 'main.php?exitsb=1';
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

    // XXX this.targeting should not be needed for scan...
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

SGMain.prototype.target = function() {
    var ships = this.getShips();
    if(!ships)
        return;

    var targets = this.scanForTargets(this.targeting, ships);
    if(targets.included.length > 0) {
        var ship_pri = (this.page == 'main') ?
            this.getShipModelPriorities() : null;
        var best = this.chooseTarget(targets.included, ship_pri);
        this.doc.location = 'ship2ship_combat.php?playerid=' + best.id;
        return;
    }

    // no target?
    this.nav();
};

SGMain.prototype.cloak = function() { this.clickById('inputShipCloak'); };
SGMain.prototype.uncloak = function() { this.clickById('inputShipUncloak'); };
SGMain.prototype.fillTank = function() { this.clickById('aCmdTank'); };
SGMain.prototype.jumpWH = function() { this.clickById('aCmdWarp'); };

SGMain.prototype.setAmbushRP = function() {
    var doc = this.doc,
    xpath = '//div[@id="emsg"]//input[@name="retreat_point_set" and @type="submit"]',
    elt = doc.evaluate(xpath, doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt) { elt.click(); return; }

    elt = doc.getElementById('aCmdRetreatInfo');
    if(elt) { elt.click(); return; }

    this.nav();
};

SGMain.prototype.ambush = function() {
    if(this.page != 'ambush') {
        this.clickById('aCmdAmbush');
        return;
    }

    // Below we assume some elements are always found.  There's
    // nothing sensible to do here if they aren't.
    var doc = this.doc,
    xpath = '//b[contains(text(), "Quicklist parsed and applied")]',
    elt = doc.evaluate(xpath, doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                       null).singleNodeValue;
    if(elt) {
        // just parsed a QL - set!
        doc.evaluate('//input[@name="confirm" and @type="submit"]',
                     doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                     null).singleNodeValue.click();
        return;
    }

    elt = doc.getElementById('readlist');
    var ta = doc.evaluate('//textarea[@name="readlist"]',
                          elt, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                          null).singleNodeValue,
    apply = doc.evaluate('//input[@name="apply_ql"]',
                         elt, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                         null).singleNodeValue;
    if(ta.value == '') {
        // load the configured QL and apply
        var self = this,
        act = function() {
            ta.value = self.ql;
            apply.click();
        };
        this.loadSettings(['ql'], act);
        return;
    }

    // ta.value already has a QL, just apply
    apply.click();
};

SGMain.prototype.configure = function() {
    if(typeof(SGPvPUI) != 'function')
        // load the UI code
        eval(this.getResourceText('ui_js'));
    if(!this.sgpvpui)
        this.sgpvpui = new SGPvPUI(this, this.doc);
    this.sgpvpui.open();
};
