// SGPvP object and a few functions. This code must run in Firefox and
// Google Chrome - no Greasemonkey calls and no chrome.extension stuff
// here.  localStorage should not be accessed from here either.

// V30

function SGPvP() {
    this.url = window.location.href;

    var m = this.LOCATION_RX.exec(this.url);
    if(!m)
        return;

    this.universe = m[1];
    this.page = m[2];

    if(this.page == 'main') {
        this.setupNavPage();
    }
    else if(this.page == 'ship2ship_combat') {
        this.setupCombatPage();
        this.selectHighestRounds();
        this.selectMissiles();
    }
    else if(this.page == 'building') {
        this.setupCombatPage();
        this.selectMissiles();
    }
    else if(this.page == 'ship2opponent_combat') {
        this.setupCombatPage();
    }

    // We wanted addEventListener, but need to use document.onkeydown,
    // because that's what pardus uses and we need to trap the cursor
    // keys while the info dialogue is open.

    var self = this;

    this.game_kbd_handler = document.onkeydown;
    document.onkeydown = function(event) { self.keyPressHandler(event); };
}

SGPvP.prototype.LOCATION_RX = /^https?:\/\/([^.]+)\.pardus\.at\/([^.]+)\.php/;

// CONFIGURABLE BITS, IF YOU KNOW WHAT YOU'RE DOING:

// the number is the keyCode, usually ASCII
SGPvP.prototype.ACTIONS = {
    /* Z */ 90: 'storeRP',
    /* X */ 88: 'engage',
    /* C */ 67: 'disengage',
    /* V */ 86: 'nav',
    /* B */ 66: 'bots',
    /* N */ 78: 'testBots',
    /* M */ 77: 'damageBuilding',
    /* A */ 65: 'bots1',
    /* S */ 83: 'bots4',
    /* D */ 68: 'bots8',
    /* F */ 70: 'fillUp',
    /* K */ 75: 'cloak',
    /* L */ 76: 'uncloak',
    /* T */ 84: 'highlightTargets',
    /* I */ 73: 'ui',
    /* ESC */ 27: 'closeUi',

    /* 1 */ 49: 'target',
    /* 2 */ 50: 'engage',
    /* 3 */ 51: 'nav',
    /* 4 */ 52: 'disengage',
    /* 5 */ 53: 'bots'
};

// ship priorities - all else being the same, first listed here are first shot
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

// END CONFIGURABLE BITS, no user serviceable parts below

SGPvP.prototype.keyPressHandler = function(event) {
    if(window.name == '' || event.ctrlKey || event.altKey || event.metaKey) {
        if(this.game_kbd_handler)
            this.game_kbd_handler(event);
        return;
    }

    if(event.target &&
       (event.target.nodeName == 'INPUT' || event.target.nodeName == 'TEXTAREA')) {
        // nop, and don't call the game's handler cause it may move the ship
        return;
    }

    var method_name = this.ACTIONS[event.keyCode];
    if(method_name) {
        var method = this[method_name];
        if(method) {
            event.preventDefault();
            event.stopPropagation();
            method.call(this);
        }
    }
    else if(this.game_kbd_handler) {
        this.game_kbd_handler(event);
    }
};

SGPvP.prototype.showNotification = function(text, delay) {
    if(this.notification_timer)
        clearTimeout(this.notification_timer);
    this.hideNotification();
    this.notification =
        this.createElement('div',
                           { position: 'fixed', zIndex: '15', padding: '0.5em', textAlign: 'center',
                             fontSize: '18px', verticalAlign: 'middle',
                             top: '50%', left: '50%', width: '8em', height: 'auto',
                             marginLeft: '-4em', marginTop: '-2.2em',
                             border: 'ridge 2px #556', backgroundColor: 'rgb(0,0,28)' },
                           null, text, null);
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

SGPvP.prototype.createElement = function(tag, style, attributes, text_content, parent) {
    var e = document.createElement(tag);
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

SGPvP.prototype.ui = function() {
    if(typeof(SGPvPUI) != 'function') {
        // load the UI code
        eval(this.getResourceText('ui_js'));
    }
    if(!this.sgpvpui)
        this.sgpvpui = new SGPvPUI(this, document);
    this.sgpvpui.open();
};

SGPvP.prototype.closeUi = function() {
    if(this.sgpvpui)
        this.sgpvpui.close();
};

SGPvP.prototype.target = function() {
    var url = this.url;
    var page;
    var ships;

    if(this.page == 'building') {
        page = 'b';
        ships = this.getShipsBuilding();
    }
    else if(this.page == 'ship2ship_combat') {
        page = 'c';
        ships = this.getShipsCombat();
    }
    else {
        page = 'n';
        ships = this.getShipsNav();
    }

    if(ships) {
        var self = this;
        this.loadSettings(['targetingData'],
                          function(results) {
                              var targeting_data = results[0];
                              var targets = self.scanForTargets(targeting_data, ships);

                              if(targets.included.length > 0) {
                                  var ship_pri = (page == 'n') ? self.getShipModelPriorities() : null;
                                  var best = self.chooseTarget(targets.included, ship_pri);
                                  document.location = 'ship2ship_combat.php?playerid=' + best.id;
                                  return;
                              }

                              self.nav();
                          });
    }
};

SGPvP.prototype.highlightTargets = function() {
    var url = this.url;
    var page;
    var ships;

    if(this.page == 'building') {
        page = 'b';
        ships = this.getShipsBuilding();
    }
    else if(this.page == 'ship2ship_combat') {
        page = 'c';
        ships = this.getShipsCombat();
    }
    else {
        page = 'n';
        ships = this.getShipsNav();
    }

    var highlight_target = function(td, colour) {
        td.style.backgroundColor = colour;
        td.previousElementSibling.style.backgroundColor = colour;
    };

    if(ships) {
        for(var i = 0, end = ships.length; i < end; i++)
            highlight_target(ships[i].td, 'inherit');

        var self = this;
        this.loadSettings(['targetingData'],
                          function(results) {
                              var targeting_data = results[0];
                              var targets = self.scanForTargets(targeting_data, ships);

                              // turn the excluded ships green
                              for(var i = 0, end = targets.excluded.length; i < end; i++)
                                  highlight_target(targets.excluded[i].td, '#050');

                              if(targets.included.length > 0) {
                                  // turn the included ships red
                                  for(var i2 = 0, end2 = targets.included.length; i2 < end2; i2++)
                                      highlight_target(targets.included[i2].td, '#500');

                                  // highlight the chosen target
                                  var ship_pri = (page == 'n') ? self.getShipModelPriorities() : null;
                                  var best = self.chooseTarget(targets.included, ship_pri);
                                  highlight_target(best.td, '#900');
                              }
                          });
    }
};

SGPvP.prototype.scanForTargets = function(targeting_data, ships) {
    var exc = new Array();
    var inc = new Array();
    var ql = targeting_data.ql;
    var include = targeting_data.include;
    var exclude = targeting_data.exclude;

    for(var i = 0, end = ships.length; i < end; i++) {
        var ship = ships[i];
        var name = ship.name.toLowerCase();
        var n;

        if(exclude.ids[ship.id] || exclude.names[name]) {
            exc.push(ship);
        }
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

    return {
        excluded: exc,
        included: inc
    };
};

SGPvP.prototype.chooseTarget = function(ships, ship_pri) {
    var best;

    for(var i = 0, end = ships.length; i < end; i++) {
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
                        var sm = ship_pri[ship.shipModel];
                        var bm = ship_pri[best.shipModel];

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
    var a = this.SHIPS;
    var o = new Object();

    for(var i = 0, end = a.length; i < end; i++)
        o[a[i]] = i + 1;

    return o;
};

SGPvP.prototype.storeRP = function() {
    var userloc = this.getLocation();
    if(userloc) {
        this.storeSettings({ retreatTile: userloc });
        this.showNotification('Retreat tile set: ' + userloc, 500);
    }
    else
        this.showNotification('Can not set retreat tile', 500);
};

SGPvP.prototype.engage = function() {
    var elt = document.evaluate('//input[@name="ok" and @type="submit" and @value="Attack"]',
                                document, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return;
    }

    // no attack button?
    this.target();
};

SGPvP.prototype.nav = function() { document.location = 'main.php'; };

SGPvP.prototype.damageBuilding = function() {
    var elt = document.evaluate('//input[@name="destroy" and @type="submit"]',
                                document, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return;
    }

    // no destroy button?
    document.location = 'building.php';
};

SGPvP.prototype.disengage = function() {
    var elt = document.evaluate('//input[@name="retreat" and @type="submit"]',
                                document, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                                null).singleNodeValue;
    if(elt && elt.click) {
        elt.click();
        return;
    }

    // no retreat button?
    if(this.page != 'main') {
        // XXX - we probably could skip this nav, by inserting an invisible form and submitting it...
        this.nav();
        return;
    }

    var self = this;
    this.loadSettings(['retreatTile'],
                      function(results) {
                          var tile_id = results[0];
                          if(tile_id) {
                              var form = document.getElementById('navForm');
                              if(form) {
                                  var destination = form.elements.destination;
                                  if(destination) {
                                      destination.value = tile_id;
                                      form.submit();
                                      return;
                                  }
                              }
                          }
                          else
                              self.showNotification('NO RETREAT TILE SET', 500);

                          self.nav();
                      });
};

SGPvP.prototype.bots = function() { this.useBots(null); };
SGPvP.prototype.bots1 = function() { this.useBots(1); };
SGPvP.prototype.bots4 = function() { this.useBots(4); };
SGPvP.prototype.bots8 = function() { this.useBots(8); };
SGPvP.prototype.fillUp = function() { document.location = 'main.php?fillup=1'; };
//SGPvP.prototype.enterBuilding = function() { document.location = 'building.php'; };

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

// This if called every time the nav page is loaded.  It should run
// fast and report no errors.
SGPvP.prototype.setupNavPage = function() {
    var self = this;

    // We want this code to run now, and each time the cargo box
    // mutates, to keep track of our armour and how many bots we have.
    var updateLastKnown = function() {
        // we'll set these if found below
        self.useBotsAmountField = null;
        self.useBotsButton = null;

        var settings = new Object();

        // Get the current ship armour. It's in a properly ID'd span.
        var n = NaN;
        var elt = document.getElementById('spanShipArmor');
        if(elt)
            n = parseInt(elt.textContent);
        if(!isNaN(n))
            settings.lastKnownArmourPoints = n;

        // Get amount of bots in the cargo hold, from the Nav
        // screen. This information is always available, except when
        // the user clicked on the "[Use]" link for a resource other
        // than bots. In that case, the script will use the last known
        // value stored in the settings.
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
                    self.useResourceForm = elt;
                    self.useBotsAmountField = elt.elements.namedItem('amount');
                    self.useBotsButton = elt.elements.namedItem('useres');
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
            settings.lastKnownBotsAvailable = n;

        self.storeSettings(settings);
    };

    updateLastKnown();

    var cargo = document.getElementById("cargo_content");
    if(cargo) {
        var observer = new MutationObserver(updateLastKnown);
        observer.observe(cargo.parentNode, {childList:true});
    }
};

// This if called every time the ship2ship and building page is
// loaded. It should run fast and report no errors.
SGPvP.prototype.setupCombatPage = function() {
    var settings = new Object();
    var elt;

    elt = document.evaluate("//td/input[@name = 'resid' and @value = '8']",
                            document, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                            null).singleNodeValue;
    if(elt) {
        // Found the resid hidden element for bots. It is contained in a
        // td. The previous td contains the amount available; the next
        // input in the current td should be the amount to use field, and
        // the next input, the submit button.
        var available = parseInt(elt.parentNode.previousElementSibling.textContent);
        if(!isNaN(available))
            settings.lastKnownBotsAvailable = available;

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
            settings.lastKnownBotsAvailable = 0;
    }

    elt = document.evaluate("//font[starts-with(text(), 'Armor points:')]",
                            document, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
                            null).singleNodeValue;
    if(elt) {
        var armour = parseInt(elt.textContent.substring(13));
        if(!isNaN(armour))
            settings.lastKnownArmourPoints = armour;
    }

    this.storeSettings(settings);
};

SGPvP.prototype.useBots = function(thisMany) {
    var self = this;
    self.loadSettings(['armourData',
                       'lastKnownArmourPoints',
                       'lastKnownBotsAvailable'],
                      function(results) {
                          self.useBots2(results, thisMany);
                      });
};

SGPvP.prototype.testBots = function() {
    var self = this;
    self.loadSettings(['armourData',
                       'lastKnownArmourPoints',
                       'lastKnownBotsAvailable'],
                      function(results) {
                          self.showBotsNeeded(results);
                      });
};

// If thisMany is not supplied, compute the amount needed to the best
// of our knowledge.
SGPvP.prototype.useBots2 = function(storedParams, thisMany) {
    var armourData = storedParams[0];
    var lastKnownArmourPoints = storedParams[1];
    var lastKnownBotsAvailable = storedParams[2];
    var botRepair;

    if(thisMany)
        // dont bother trying to compute armour, use what we're told exactly
        botRepair = Math.floor(180 / armourData.level);
    else {
        var bots = this.computeBotsNeeded(armourData, lastKnownArmourPoints,
                                          lastKnownBotsAvailable);
        if(!bots)
            return;

        botRepair = bots.botRepair;
        thisMany = bots.available;
    }

    // Compute how much armour the bots will repair, and how many
    // we'll have left, and update last known values.
    var newSettings = {
        lastKnownArmourPoints: (lastKnownArmourPoints == null) ?
            null : lastKnownArmourPoints + thisMany * botRepair,
        lastKnownBotsAvailable: (lastKnownBotsAvailable > thisMany) ?
            lastKnownBotsAvailable - thisMany : 0
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

    this.storeSettings(newSettings);
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

    form = this.createElement('form',
                              { display: 'none' },
                              { id: 'sgpvp-useform', action: action,
                                method: method },
                              null, null);
    this.createElement('input', null,
                       { type: 'text', name: 'resid', value: 8 },
                       null, form);
    this.createElement('input', null,
                       { type: 'text', name: 'amount' },
                       null, form);
    this.createElement('input', null,
                       { type: 'submit', name: 'useres', value: 'Use',
                         onclick: 'useRes(document.getElementById("sgpvp-useform").elements["resid"].value, document.getElementById("sgpvp-useform").elements["amount"].value);return false;' },
                       null, form);
    document.body.appendChild(form);
    return form;
};

SGPvP.prototype.showBotsNeeded = function(storedParams) {
    var armourData = storedParams[0];
    var lastKnownArmourPoints = storedParams[1];
    var lastKnownBotsAvailable = storedParams[2];
    var bots = this.computeBotsNeeded(armourData, lastKnownArmourPoints, lastKnownBotsAvailable);
    if(!bots)
        return;

    if(this.useBotsAmountField)
        this.useBotsAmountField.value = bots.available;

    if(bots.needed == 1)
        this.showNotification('Need ' + bots.needed + ' robot, would use ' + bots.available, 1000);
    else
        this.showNotification('Need ' + bots.needed + ' robots, would use ' + bots.available, 1000);
};

// This function shows notifications. If it returns null, bots are not
// needed or can't be used, and the user already knows.
SGPvP.prototype.computeBotsNeeded = function(armourData, lastKnownArmourPoints, lastKnownBotsAvailable) {
    if(!(armourData.points > 0 && armourData.level > 0)) {
        this.showNotification('Ship armour not configured', 1500);
        return null;
    }

    if(lastKnownArmourPoints == null || lastKnownArmourPoints < 0) {
        // In the nav screen, we should always see the ship's armour
        this.showNotification("SGPvP error 5001: ship armour not found", 1500);
        return null;
    }

    if(!lastKnownBotsAvailable) {
        this.showNotification("No bots available!", 500);
        return null;
    }

    if(lastKnownArmourPoints >= armourData.points) {
        this.showNotification('Bots not needed', 500);
        return null;
    }

    var botRepair = Math.floor(180 / armourData.level);
    var needed = Math.floor((armourData.points - lastKnownArmourPoints + botRepair - 1) / botRepair);

    return {
        botRepair: botRepair,
        needed: needed,
        available: needed > lastKnownBotsAvailable ? lastKnownBotsAvailable : needed
    };
};

SGPvP.prototype.SCANID_RX =
    /^javascript:scanId\((\d+), "player"\)|^main\.php\?scan_details=(\d+)&scan_type=player/;
SGPvP.prototype.ALLYID_RX = /^alliance\.php\?id=(\d+)/;
SGPvP.prototype.getShipsNav = function() {
    var ships = [];
    var sbox = document.getElementById('otherships_content');
    if(sbox) {
        var xpr = document.evaluate('table/tbody/tr/td[position() = 2]/a', sbox, null,
                                    XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
        var a;
        while((a = xpr.iterateNext())) {
            var m = this.SCANID_RX.exec(a.getAttribute('href'));
            if(m) {
                var td = a.parentNode;
                var r;
                if(!(r = m[1]))
                    r = m[2];
                var entry = {
                    td: td,
                    id: parseInt(r),
                    name: a.textContent
                };
                var xpr2 = document.evaluate("font/b/a", td, null,
                                             XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
                var a2;
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
    var ships = [];
    var xpr = document.evaluate("tr/td/a", tbody, null,
                               XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    var a;
    while((a = xpr.iterateNext())) {
        var m = link_rx.exec(a.getAttribute('href'));
        if(m) {
            var td = a.parentNode;
            var entry = {
                td: td,
                id: parseInt(m[1]),
                name: a.textContent
            };
            var xpr2 = document.evaluate("font/b/a", td, null,
                                         XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
            var a2;
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

SGPvP.prototype.selectMissiles = function() {
    var inputs = document.getElementsByTagName('input');
    for(var i = 0, end = inputs.length; i < end; i++) {
        var input = inputs[i];
        if(input.type == 'checkbox' && /^\d+_missile$/.test(input.id))
            input.checked = true;
    }
};

SGPvP.prototype.selectHighestRounds = function() {
    var elts = document.getElementsByName('rounds');

    var selectHighestRoundsInSelectElement = function(elt) {
        var highest = 0, highestElt = null;
        var opts = elt.getElementsByTagName('option');
        for(var j = 0; j < opts.length; j++) {
            var opt = opts[j];
            var n = parseInt(opt.value);
            if(n > highest) {
                highest = n;
                highestElt = opt;
            }
        }
        if(highestElt)
            highestElt.selected = true;
    };

    for(var i = 0; i < elts.length; i++) {
        var elt = elts[i];
        if(elt.style.display == 'none') {
            // for some reason, Pardus now hides the rounds select,
            // and instead adds a second, visible select element, with
            // a gibberish name.
            elt = elt.nextElementSibling;
            if(elt && elt.tagName == 'SELECT')
                selectHighestRoundsInSelectElement(elt);
        }
        else
            selectHighestRoundsInSelectElement(elt);
    }
};
